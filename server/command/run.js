import { honestEveningLine, planLines, planSummary } from "../messages/templates.js";

/**
 * Runs a parsed command against the data layer. Everything here is local and
 * reversible; the AI layer is never needed for a command to work.
 */
export function createCommandRunner({ data, config }) {
  const name = async () => (await data.getProfile()).name || config.name || "";

  /** Rebuilds today's plan from the values already on disk, plus overrides. */
  async function replan(overrides) {
    const today = await data.getTodayPlan();
    const plan = await data.planToday({
      dayType: today?.dayType || "school_day",
      energy: today?.energy ?? 3,
      mood: today?.mood ?? 3,
      note: today?.note || "",
      date: today?.date,
      done: today?.done,
      ...overrides,
    });
    return { plan };
  }

  return async function runCommand(parsed) {
    const displayName = await name();

    switch (parsed.kind) {
      case "add_backlog": {
        const entries = [];
        for (let n = parsed.from; n <= parsed.to; n += 1) {
          entries.push({ subject: parsed.subject, chapter: parsed.chapter, lecture: n });
        }
        const created = await data.addBacklog(entries);
        const queue = (await data.getBacklog()).filter((i) => !i.done).length;
        const text = `Added ${created.length} lecture${created.length === 1 ? "" : "s"} to the queue. ${queue} pending.`;
        const today = await data.getTodayPlan();
        if (!today || !created.length) return reply(text, { refresh: true });
        const { plan } = await replan({ done: today.done });
        return reply(text, { plan, lines: planLines(plan), refresh: true });
      }

      case "add_exam": {
        await data.addExam({ subject: parsed.subject, date: parsed.date });
        return reply(`Exam noted: ${parsed.subject} on ${parsed.date}.`);
      }

      case "done": {
        const touched = await data.markNextDone(parsed.count);
        if (!touched.length) return reply("Queue is already empty. Nothing to mark.");
        const list = touched.map((t) => `${t.subject} lecture ${t.lecture}`).join(", ");
        const remaining = (await data.getBacklog()).filter((i) => !i.done).length;
        const today = await data.getTodayPlan();
        if (!today) return reply(`Marked done: ${list}. ${remaining} left in the queue.`, { refresh: true });
        const { plan } = await replan({ done: today.done });
        return reply(`Marked done: ${list}. ${remaining} left in the queue.`, {
          plan,
          lines: planLines(plan),
          refresh: true,
        });
      }

      case "set_mood": {
        const { plan } = await replan({ mood: parsed.value });
        return reply(`Mood ${parsed.value}. ${planSummary(plan, displayName)}`, {
          plan,
          lines: planLines(plan),
          refresh: true,
        });
      }

      case "set_energy": {
        const { plan } = await replan({ energy: parsed.value });
        return reply(`Energy ${parsed.value}. ${planSummary(plan, displayName)}`, {
          plan,
          lines: planLines(plan),
          refresh: true,
        });
      }

      case "vacation": {
        const { plan } = await replan({ dayType: "vacation" });
        return reply("Vacation. Enjoy it. No study today.", { plan, lines: planLines(plan), refresh: true });
      }

      case "skip_today": {
        const plan = await data.skipToday();
        return reply("Skipping today. The queue waits, nothing is lost.", {
          plan,
          lines: ["No study blocks today."],
          refresh: true,
        });
      }

      case "evening": {
        const today = await data.getTodayPlan();
        if (!today) return reply("No plan for today yet, so nothing to check off.");
        return reply("Evening check. Tell me how the day went.", {
          evening: true,
          plan: today,
        });
      }

      case "show": {
        if (parsed.what === "backlog") {
          const items = (await data.getBacklog()).filter((i) => !i.done);
          if (!items.length) return reply("Backlog is empty.");
          return reply(items.slice(0, 10).map((i, n) => `${n + 1}. ${i.subject} | ${i.chapter} | lecture ${i.lecture}`).join("  "), {
            openPanel: "backlog",
          });
        }
        if (parsed.what === "exams") {
          const exams = await data.getExams();
          if (!exams.length) return reply("No exams listed yet.");
          return reply(exams.map((e) => `${e.subject} on ${e.date}`).join("  "));
        }
        const today = await data.getTodayPlan();
        if (!today) return reply("No plan yet. Say check in and I will ask three quick things.", { startCheckin: true });
        return reply(planSummary(today, displayName), { plan: today, lines: planLines(today), openPanel: "plan" });
      }

      case "checkin":
        return reply("Three quick questions then.", { startCheckin: true });

      case "empty":
        return reply("Say something and I will act on it.");

      case "error":
        return reply(parsed.message);

      default:
        return reply("Not wired yet. The AI chat answer comes in sitting 3.", { unmatched: parsed.text });
    }
  };
}

function reply(text, extra = {}) {
  return { text, ...extra };
}
