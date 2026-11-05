import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "./parser.js";

test("add backlog with a lecture range becomes one entry per lecture", () => {
  const parsed = parseCommand("add backlog Physics | Rotational Motion | lectures 3 to 6");
  assert.deepEqual(parsed, {
    kind: "add_backlog",
    subject: "Physics",
    chapter: "Rotational Motion",
    from: 3,
    to: 6,
  });
});

test("the parser is case insensitive but keeps the subject text", () => {
  const parsed = parseCommand("ADD BACKLOG Chemistry | thermo DYNAMICS | lecture 7");
  assert.equal(parsed.kind, "add_backlog");
  assert.equal(parsed.subject, "Chemistry");
  assert.equal(parsed.chapter, "thermo DYNAMICS");
  assert.deepEqual([parsed.from, parsed.to], [7, 7]);
});

test("a reversed range is normalised", () => {
  const parsed = parseCommand("add backlog Maths | vectors | lectures 9 to 5");
  assert.deepEqual([parsed.from, parsed.to], [5, 9]);
});

test("a huge range is rejected instead of queued", () => {
  const parsed = parseCommand("add backlog Maths | vectors | lectures 1 to 500");
  assert.equal(parsed.kind, "error");
});

test("done without a number means one", () => {
  assert.deepEqual(parseCommand("done"), { kind: "done", count: 1 });
  assert.deepEqual(parseCommand("done 3"), { kind: "done", count: 3 });
});

test("mood and energy only accept 1 to 5", () => {
  assert.deepEqual(parseCommand("mood 2"), { kind: "set_mood", value: 2 });
  assert.deepEqual(parseCommand("energy 5"), { kind: "set_energy", value: 5 });
  assert.equal(parseCommand("mood 9").kind, "chat");
});

test("add exam keeps the subject case and requires a date", () => {
  assert.deepEqual(parseCommand("add exam Physics | 2026-11-20"), {
    kind: "add_exam",
    subject: "Physics",
    date: "2026-11-20",
  });
  assert.equal(parseCommand("add exam Physics").kind, "error");
});

test("vacation, skip today and evening are recognised", () => {
  assert.deepEqual(parseCommand("vacation"), { kind: "vacation" });
  assert.deepEqual(parseCommand("skip today"), { kind: "skip_today" });
  assert.deepEqual(parseCommand("done for today"), { kind: "evening" });
});

test("show covers plan, backlog and exams", () => {
  assert.deepEqual(parseCommand("show plan"), { kind: "show", what: "plan" });
  assert.deepEqual(parseCommand("show backlog"), { kind: "show", what: "backlog" });
});

test("anything else is handed to the chat layer with the original text", () => {
  const parsed = parseCommand("Why is rotational motion so hard?");
  assert.equal(parsed.kind, "chat");
  assert.equal(parsed.text, "Why is rotational motion so hard?");
});

test("empty input is not a command", () => {
  assert.deepEqual(parseCommand("   "), { kind: "empty" });
});
