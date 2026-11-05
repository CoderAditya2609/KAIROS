/**
 * Plan engine. Pure functions, no I/O, no AI.
 * Rules come from kprompt.txt section 9.3; constants are exported so they are
 * easy to change without touching the logic.
 */

export const RULES = {
  baseCapacity: {
    school_day: 3,
    off_day: 6,
    exam_week: 4,
    vacation: 0,
    sick: 0,
  },
  backlogPerDay: 3,
  blockMinutes: 50,
  vacationOptInBlocks: 2,
  breakEveryBlocks: 2,
};

export const DAY_TYPES = Object.keys(RULES.baseCapacity);

const RESET_VARIANTS = [
  "Go for a walk, no phone",
  "Put on music for ten minutes",
  "Take a shower and restart",
  "Talk to a friend",
];

const REST_BLOCK = { kind: "rest", label: "Do something that is not study" };
const RECOVER_BLOCK = { kind: "recover", label: "Recover. Sleep, water, nothing else" };
const DEFAULT_STAPLES = ["Revise today's live class"];

function ceil(x) {
  return Math.ceil(x);
}

function isStudy(kind) {
  return kind === "backlog" || kind === "staple" || kind === "revision";
}

function makeBlock(kind, label, extra) {
  return { kind, label, minutes: RULES.blockMinutes, ...extra };
}

/** True when the two most recently logged days both had mood 2 or below. */
export function consecutiveLowMood(moodHistory = []) {
  const recent = moodHistory.slice(-2);
  return recent.length === 2 && recent.every((day) => day && Number(day.mood) <= 2);
}

function pickReset(dayKey) {
  const index = Math.abs([...String(dayKey)].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % RESET_VARIANTS.length;
  return RESET_VARIANTS[index];
}

function pendingLectures(backlog) {
  return (backlog || []).filter((item) => !item.done);
}

function studyBlocks(capacity, ctx) {
  const blocks = [];
  const { dayType, backlog, staples, exams } = ctx;

  if (dayType === "exam_week") {
    const sorted = [...exams].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (let i = 0; i < capacity; i += 1) {
      const exam = sorted[i % Math.max(1, sorted.length)];
      if (!exam) break;
      blocks.push(makeBlock("revision", `Revise ${exam.subject} for ${exam.date}`, { exam }));
    }
    return blocks;
  }

  const queue = pendingLectures(backlog);
  const perDay = ctx.backlogPerDay ?? RULES.backlogPerDay;
  const lectureCount = Math.min(perDay, queue.length, capacity);
  for (let i = 0; i < lectureCount; i += 1) {
    const lecture = queue[i];
    blocks.push(
      makeBlock("backlog", `${lecture.subject} | ${lecture.chapter} | lecture ${lecture.lecture}`, {
        lectureId: lecture.id,
      }),
    );
  }

  // Leftover capacity goes to the configured staples only. No invented filler,
  // and unused capacity stays unused.
  for (const label of staples || []) {
    if (blocks.length >= capacity) break;
    blocks.push(makeBlock("staple", label));
  }

  return blocks;
}

function withBreaks(blocks, dayType) {
  if (dayType !== "off_day") return blocks;
  const out = [];
  let studyRun = 0;
  for (const block of blocks) {
    if (isStudy(block.kind)) {
      studyRun += 1;
      out.push(block);
      if (studyRun % RULES.breakEveryBlocks === 0) {
        out.push(makeBlock("break", "Break", { minutes: 15 }));
      }
    } else {
      out.push(block);
    }
  }
  return out;
}

export function buildPlan(input = {}) {
  const {
    dayType,
    energy = 3,
    mood = 3,
    backlog = [],
    exams = [],
    moodHistory = [],
    staples = DEFAULT_STAPLES,
    dayKey = new Date().toISOString().slice(0, 10),
    wantsToStudy = false,
  } = input;

  const base = RULES.baseCapacity[dayType];
  if (base === undefined) {
    throw new Error(`unknown day type: ${dayType}`);
  }

  const perDay = input.backlogPerDay ?? RULES.backlogPerDay;
  const lines = [];
  let capacity = base;

  if (energy <= 2) {
    capacity -= 1;
    if (dayType === "school_day" || dayType === "off_day") capacity = Math.max(1, capacity);
    capacity = Math.max(0, capacity);
  }

  const lowMood = mood <= 2;
  if (lowMood) capacity = ceil(capacity / 2);
  if (consecutiveLowMood(moodHistory)) {
    capacity = Math.min(capacity, 1);
    lines.push("Two rough days in a row. Talk to someone you trust today.");
  }

  const ctx = { dayType, backlog, exams, staples, backlogPerDay: perDay };
  let blocks = [];

  if (dayType === "vacation") {
    if (!wantsToStudy) {
      lines.push("Vacation. Enjoy it. No study today.");
      return finish({ dayType, dayKey, blocks: [], capacity: 0, lines, mood, backlog, perDay, energy });
    }
    const queue = pendingLectures(backlog);
    const count = Math.min(RULES.vacationOptInBlocks, queue.length);
    for (let i = 0; i < count; i += 1) {
      const lecture = queue[i];
      blocks.push(
        makeBlock("backlog", `${lecture.subject} | ${lecture.chapter} | lecture ${lecture.lecture}`, {
          lectureId: lecture.id,
        }),
      );
    }
    lines.push("Light day by choice. Stop whenever you want.");
    return finish({ dayType, dayKey, blocks, capacity: count, lines, mood, backlog, perDay, energy });
  }

  if (dayType === "sick") {
    lines.push("No study today. Rest is the plan.");
    return finish({
      dayType,
      dayKey,
      blocks: [makeBlock(RECOVER_BLOCK.kind, RECOVER_BLOCK.label, { minutes: 0 })],
      capacity: 0,
      lines,
      mood,
      backlog,
      perDay,
      energy,
    });
  }

  blocks = studyBlocks(capacity, ctx);

  if (lowMood) {
    blocks.push(makeBlock("reset", pickReset(dayKey), { minutes: 25 }));
  } else if (mood <= 3) {
    blocks.push(makeBlock(REST_BLOCK.kind, REST_BLOCK.label, { minutes: 30 }));
  }

  if (dayType === "exam_week" && exams.length === 0) {
    lines.push("Exam week but no exams listed. Tell me the subject and date.");
  }

  blocks = withBreaks(blocks, dayType);

  return finish({ dayType, dayKey, blocks, capacity, lines, mood, backlog, perDay, energy });
}

function finish({ dayType, dayKey, blocks, capacity, lines, mood, backlog, perDay, energy }) {
  const queue = pendingLectures(backlog);
  const planned = blocks.filter((b) => b.kind === "backlog").length;
  const days = planned > 0 ? Math.ceil(queue.length / Math.max(1, perDay)) : 0;

  if (dayType !== "vacation" && dayType !== "sick" && queue.length > 0) {
    const dayWord = days === 1 ? "day" : "days";
    lines.push(`Backlog: ${queue.length} left. At ${perDay} per day that clears in ${days} ${dayWord}.`);
  }
  if (energy <= 2 && (dayType === "school_day" || dayType === "off_day")) {
    lines.push("Low energy day. One block fewer, not zero.");
  }
  if (mood <= 2) {
    lines.push("Mood is low. The plan is small on purpose.");
  }

  return {
    dayType,
    date: dayKey,
    capacity,
    blocks,
    studyBlocks: blocks.filter((b) => isStudy(b.kind)).length,
    lines,
    plannedLectureIds: blocks.filter((b) => b.lectureId).map((b) => b.lectureId),
  };
}
