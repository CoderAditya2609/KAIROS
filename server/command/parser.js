/**
 * Deterministic text-command parser (kprompt 9.5). No AI here: a command that
 * changes data must be predictable. Anything unrecognised is returned as
 * kind "chat" so the caller can route it to the AI layer later.
 */

const PIPE = /\s*\|\s*/;

export function parseCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return { kind: "empty" };
  const line = raw.toLowerCase().replace(/[?.!]+$/, "");

  let m = line.match(/^add\s+backlog\s+(.+)$/);
  if (m) return parseBacklog(raw.slice(raw.length - m[1].length));

  m = line.match(/^add\s+exam\s+(.+)$/);
  if (m) {
    const parts = raw
      .slice(raw.length - m[1].length)
      .split(PIPE)
      .map((p) => p.trim());
    const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
    const subject = parts.find((p) => p !== date);
    if (!subject || !date) return { kind: "error", message: "Format: add exam <subject> | YYYY-MM-DD" };
    return { kind: "add_exam", subject, date };
  }

  m = line.match(/^done(?:\s+(\d+))?$/);
  if (m) return { kind: "done", count: m[1] ? Number(m[1]) : 1 };

  m = line.match(/^mood\s+([1-5])$/);
  if (m) return { kind: "set_mood", value: Number(m[1]) };

  m = line.match(/^energy\s+([1-5])$/);
  if (m) return { kind: "set_energy", value: Number(m[1]) };

  if (/^vacation$/.test(line)) return { kind: "vacation" };
  if (/^skip(\s+today)?$/.test(line)) return { kind: "skip_today" };
  if (/^evening$/.test(line) || /^done\s+for\s+today$/.test(line)) return { kind: "evening" };

  m = line.match(/^show\s+(plan|backlog|exams)$/);
  if (m) return { kind: "show", what: m[1] };

  if (/^(check\s*in|start|plan\s+my\s+day)$/.test(line)) return { kind: "checkin" };

  return { kind: "chat", text: raw };
}

function parseBacklog(rest) {
  const parts = rest.split(PIPE).map((p) => p.trim());
  const subject = parts[0];
  const chapter = parts[1];
  if (!subject) return { kind: "error", message: "Format: add backlog <subject> | <chapter> | lectures 3 to 7" };

  const lecturePart = (parts[2] || "").toLowerCase();
  const range = lecturePart.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/);
  const single = lecturePart.match(/^lecture\s+(\d+)/);
  let from;
  let to;
  if (range) {
    from = Number(range[1]);
    to = Number(range[2]);
  } else if (single) {
    from = Number(single[1]);
    to = from;
  } else if (/^\d+$/.test(lecturePart)) {
    from = Number(lecturePart);
    to = from;
  } else {
    from = 1;
    to = 1;
  }
  if (to < from) [from, to] = [to, from];
  if (to - from > 99) return { kind: "error", message: "That is too many at once. Keep a range under 100." };

  return { kind: "add_backlog", subject, chapter, from, to };
}
