/**
 * Template messages for the no-AI path (sitting 2). Sentences are built from
 * fixed fragments only, so KAIROS works with zero keys and zero internet.
 */

const RESET_LINES = [
  "Small plan today. That is on purpose.",
  "One thing, done slowly, still counts.",
];

export function greeting(name, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name || "there"}.`;
}

export function dayTypeQuestion() {
  return {
    text: "What kind of day is it?",
    hint: "click a chip, or type school, off, vacation, exam or sick",
    chips: [
      { value: "school_day", label: "School day" },
      { value: "off_day", label: "Off day" },
      { value: "vacation", label: "Vacation" },
      { value: "exam_week", label: "Exam week" },
      { value: "sick", label: "Sick / low" },
    ],
  };
}

export function energyQuestion() {
  return {
    text: "Energy, 1 flat to 5 charged?",
    hint: "click 1 to 5, or type the number",
    chips: scoreChips(),
  };
}

export function moodQuestion() {
  return {
    text: "Mood, 1 rough to 5 great?",
    hint: "click 1 to 5, or type the number",
    chips: scoreChips(),
  };
}

export function noteQuestion() {
  return { text: "Anything on your mind? Type it, or skip.", chips: [{ value: "skip", label: "Skip" }] };
}

export function vacationQuestion() {
  return {
    text: "Vacation. Enjoy it. No study today. Want a light session anyway?",
    chips: [
      { value: "no", label: "No, resting" },
      { value: "yes", label: "Yes, one or two" },
    ],
  };
}

export function nameQuestion(fallback) {
  return {
    text: "First time. What should I call you?",
    chips: fallback ? [{ value: fallback, label: fallback }] : [],
    input: "text",
  };
}

function scoreChips() {
  return [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
}

/** Short spoken summary of a plan. Three sentences at most. */
export function planSummary(plan, name) {
  const studies = plan.blocks.filter((b) => ["backlog", "staple", "revision"].includes(b.kind));
  const spoken = [name ? `I have it, ${name}.` : "I have it."];

  if (plan.dayType === "sick") {
    spoken.push("No study today. Rest is the plan.");
    return spoken.join(" ");
  }
  if (plan.dayType === "vacation" && studies.length === 0) {
    spoken.push("Nothing scheduled. The day is yours.");
    return spoken.join(" ");
  }

  spoken.push(`${studies.length} study block${studies.length === 1 ? "" : "s"} today.`);
  if (studies.length) {
    spoken.push(`First up: ${studies[0].label}.`);
  }
  const other = plan.blocks.filter((b) => !["backlog", "staple", "revision"].includes(b.kind));
  if (other.length) {
    spoken.push(`Plus ${other.map((b) => b.label.toLowerCase()).join(", ")}.`);
  }
  return spoken.join(" ");
}

/** The lines rendered under the orb after a plan is built. */
export function planLines(plan) {
  const out = [];
  if (plan.mood <= 2) out.push(RESET_LINES[0]);
  for (const line of plan.lines || []) out.push(line);
  const studies = plan.blocks.filter((b) => ["backlog", "staple", "revision"].includes(b.kind));
  out.push(
    studies.length
      ? `${studies.length} focused block${studies.length === 1 ? "" : "s"}. Untimed on purpose.`
      : "No study blocks."
  );
  return out;
}

export function eveningQuestion() {
  return {
    text: "Evening check. How did the day go?",
    chips: [
      { value: "all", label: "All done" },
      { value: "some", label: "Some" },
      { value: "none", label: "None" },
    ],
  };
}

export function honestEveningLine({ done, total, carriedLectures }) {
  if (total === 0) return "Nothing was scheduled. That is fine.";
  if (done === 0) return "Nothing done today. The queue remembers, so start with one block tomorrow.";
  const parts = [`${done} of ${total} done.`];
  if (carriedLectures > 0) parts.push(`${carriedLectures} lecture${carriedLectures === 1 ? "" : "s"} carried forward.`);
  else parts.push("Queue is clear for today.");
  return parts.join(" ");
}
