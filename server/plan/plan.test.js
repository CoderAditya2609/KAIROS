import test from "node:test";
import assert from "node:assert/strict";
import { buildPlan, consecutiveLowMood, RULES } from "./index.js";

function backlog(n, start = 1) {
  return Array.from({ length: n }, (_, i) => ({
    id: `l${start + i}`,
    subject: "Physics",
    chapter: "Rotational Motion",
    lecture: start + i,
    done: false,
  }));
}

const EXAMS = [
  { subject: "Physics", date: "2026-11-12" },
  { subject: "Maths", date: "2026-11-09" },
];

const kinds = (plan) => plan.blocks.map((b) => b.kind);
const countOf = (plan, kind) => plan.blocks.filter((b) => b.kind === kind).length;

test("school day uses three study blocks from the front of the backlog", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: backlog(5) });
  assert.equal(plan.capacity, 3);
  assert.equal(plan.studyBlocks, 3);
  assert.deepEqual(plan.blocks.map((b) => b.lectureId), ["l1", "l2", "l3"]);
});

test("off day gets six capacity and a break after every two study blocks", () => {
  const plan = buildPlan({ dayType: "off_day", energy: 3, mood: 4, backlog: backlog(10) });
  assert.equal(plan.capacity, 6);
  assert.equal(countOf(plan, "backlog"), 3);
  assert.equal(countOf(plan, "break"), 2);
  const seq = kinds(plan);
  assert.equal(seq[2], "break");
});

test("exam week plans revision and pauses the backlog", () => {
  const plan = buildPlan({
    dayType: "exam_week",
    energy: 3,
    mood: 4,
    backlog: backlog(5),
    exams: EXAMS,
  });
  assert.equal(countOf(plan, "backlog"), 0);
  assert.equal(countOf(plan, "revision"), 4);
  assert.match(plan.blocks[0].label, /Maths/, "nearest exam first");
});

test("vacation gives no study blocks and tells him to enjoy it", () => {
  const plan = buildPlan({ dayType: "vacation", energy: 3, mood: 4, backlog: backlog(5) });
  assert.deepEqual(plan.blocks, []);
  assert.ok(plan.lines.includes("Vacation. Enjoy it. No study today."));
});

test("vacation opt-in adds at most two light backlog blocks", () => {
  const plan = buildPlan({
    dayType: "vacation",
    energy: 5,
    mood: 4,
    backlog: backlog(8),
    wantsToStudy: true,
  });
  assert.equal(countOf(plan, "backlog"), RULES.vacationOptInBlocks);
  assert.equal(plan.studyBlocks, 2);
});

test("sick day has no study and one recover block", () => {
  const plan = buildPlan({ dayType: "sick", energy: 1, mood: 3, backlog: backlog(5) });
  assert.equal(plan.studyBlocks, 0);
  assert.deepEqual(kinds(plan), ["recover"]);
});

test("energy 2 or below removes one block", () => {
  const low = buildPlan({ dayType: "school_day", energy: 2, mood: 4, backlog: backlog(5) });
  const ok = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: backlog(5) });
  assert.equal(low.capacity, ok.capacity - 1);
  assert.ok(low.lines.some((l) => l.startsWith("Low energy day")));
});

test("energy 5 does not add blocks", () => {
  const charged = buildPlan({ dayType: "school_day", energy: 5, mood: 4, backlog: backlog(9) });
  assert.equal(charged.capacity, RULES.baseCapacity.school_day);
});

test("low energy on a school day never drops below one block", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 1, mood: 2, backlog: backlog(5) });
  assert.ok(plan.capacity >= 1);
});

test("mood 2 or below halves capacity and adds a mandatory reset block", () => {
  const plan = buildPlan({ dayType: "off_day", energy: 3, mood: 2, backlog: backlog(10) });
  assert.equal(plan.capacity, 3);
  assert.equal(countOf(plan, "reset"), 1);
  assert.ok(plan.lines.some((l) => l.startsWith("Mood is low")));
});

test("two consecutive low-mood days cap capacity at one and suggest talking", () => {
  const history = [{ date: "2026-11-03", mood: 2 }, { date: "2026-11-04", mood: 1 }];
  assert.equal(consecutiveLowMood(history), true);
  const plan = buildPlan({
    dayType: "school_day",
    energy: 3,
    mood: 3,
    backlog: backlog(5),
    moodHistory: history,
  });
  assert.equal(plan.capacity, 1);
  assert.ok(
    plan.lines.includes("Two rough days in a row. Talk to someone you trust today."),
  );
});

test("only the last two logged days count towards the low-mood streak", () => {
  const history = [{ mood: 1 }, { mood: 5 }, { mood: 1 }];
  assert.equal(consecutiveLowMood(history), false);
});

test("mood 3 or below adds exactly one non-study block", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 3, backlog: backlog(5) });
  const nonStudy = plan.blocks.filter((b) => !["backlog", "staple", "revision"].includes(b.kind));
  assert.equal(nonStudy.length, 1);
  assert.equal(nonStudy[0].kind, "rest");
});

test("empty backlog fills with staples and never invents filler", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: [] });
  assert.equal(countOf(plan, "backlog"), 0);
  assert.equal(countOf(plan, "staple"), 1);
  assert.equal(plan.blocks.length, 1);
});

test("a backlog smaller than capacity takes only what exists", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: backlog(1) });
  assert.equal(countOf(plan, "backlog"), 1);
  assert.equal(countOf(plan, "staple"), 1);
});

test("backlog per day caps the lectures even when capacity is larger", () => {
  const plan = buildPlan({ dayType: "off_day", energy: 3, mood: 4, backlog: backlog(20) });
  assert.equal(countOf(plan, "backlog"), RULES.backlogPerDay);
});

test("done lectures are skipped, so carry-forward is automatic", () => {
  const items = backlog(4);
  items[0].done = true;
  items[1].done = true;
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: items });
  assert.deepEqual(
    plan.blocks.filter((b) => b.kind === "backlog").map((b) => b.lectureId),
    ["l3", "l4"],
  );
  assert.equal(plan.blocks.some((b) => b.lectureId === "l1" || b.lectureId === "l2"), false);
});

test("exam week with no exams asks for one instead of inventing a plan", () => {
  const plan = buildPlan({ dayType: "exam_week", energy: 3, mood: 4, exams: [] });
  assert.equal(countOf(plan, "revision"), 0);
  assert.ok(plan.lines.some((l) => l.startsWith("Exam week but no exams listed")));
});

test("backlog summary line reports the queue and the days to clear", () => {
  const plan = buildPlan({ dayType: "school_day", energy: 3, mood: 4, backlog: backlog(7) });
  assert.ok(plan.lines.includes("Backlog: 7 left. At 3 per day that clears in 3 days."));
});

test("an unknown day type is rejected", () => {
  assert.throws(() => buildPlan({ dayType: "holiday" }), /unknown day type/);
});
