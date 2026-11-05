import { parseCommand } from "../command/parser.js";
import { createCommandRunner } from "../command/run.js";
import {
  dayTypeQuestion,
  energyQuestion,
  eveningQuestion,
  greeting,
  honestEveningLine,
  moodQuestion,
  nameQuestion,
  noteQuestion,
  planLines,
  planSummary,
  vacationQuestion,
} from "../messages/templates.js";
import { DAY_TYPES } from "../plan/index.js";
import { localDayKey, STUDY_KINDS } from "../data/index.js";

/** Everything the frontend needs on load, in one call. */
async function state(data, config) {
  const profile = await data.getProfile();
  const name = profile.name || config.name || "";
  const backlog = await data.getBacklog();
  return {
    name,
    needsName: !profile.name,
    greeting: greeting(name),
    today: await data.getTodayPlan(),
    backlog: backlog.filter((item) => !item.done),
    backlogTotal: backlog.length,
    exams: await data.getExams(),
  };
}

const QUESTIONS = {
  name: nameQuestion,
  daytype: () => dayTypeQuestion(),
  energy: () => energyQuestion(),
  mood: () => moodQuestion(),
  note: () => noteQuestion(),
  vacation: () => vacationQuestion(),
  evening: () => eveningQuestion(),
};

async function checkinQuestions(data, config, requested) {
  const profile = await data.getProfile();
  if (!profile.name) {
    return { step: "name", question: nameQuestion(config.name) };
  }
  const today = await data.getTodayPlan();
  if (requested && QUESTIONS[requested]) {
    return { step: requested, question: QUESTIONS[requested](config.name), plan: today };
  }
  if (!today) return { step: "daytype", question: dayTypeQuestion() };
  return { step: "done", question: eveningQuestion(), plan: today };
}

export function registerRoutes(app, { data, config }) {
  const runCommand = createCommandRunner({ data, config });
  const json = (res, payload, status = 200) => res.status(status).json(payload);

  app.get("/api/state", async (_req, res, next) => {
    try {
      json(res, await state(data, config));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/checkin", async (req, res, next) => {
    try {
      json(res, await checkinQuestions(data, config, req.query.step));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/profile", async (req, res, next) => {
    try {
      const profile = await data.setName(req.body?.name);
      if (!profile.name) return json(res, { error: "Empty name" }, 400);
      json(res, { name: profile.name, greeting: greeting(profile.name) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/checkin", async (req, res, next) => {
    try {
      const body = req.body || {};
      if (!DAY_TYPES.includes(body.dayType)) {
        return json(res, { error: `dayType must be one of ${DAY_TYPES.join(", ")}` }, 400);
      }
      const plan = await data.planToday(body);
      const name = (await data.getProfile()).name || config.name || "";
      json(res, {
        plan,
        name,
        text: planSummary(plan, name),
        lines: planLines(plan),
        eveningQuestion: eveningQuestion(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/plan/today", async (_req, res, next) => {
    try {
      const plan = await data.getTodayPlan();
      if (!plan) return json(res, { plan: null, text: "No plan for today yet." });
      const name = (await data.getProfile()).name || config.name || "";
      json(res, { plan, text: planSummary(plan, name), lines: planLines(plan) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/backlog", async (_req, res, next) => {
    try {
      json(res, { items: await data.getBacklog() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/backlog", async (req, res, next) => {
    try {
      const body = req.body || {};
      const entries = Array.isArray(body.items)
        ? body.items
        : [{ subject: body.subject, chapter: body.chapter, lecture: body.lecture ?? 1 }];
      const created = await data.addBacklog(entries);
      json(res, { created, items: await data.getBacklog() }, 201);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/evening", async (req, res, next) => {
    try {
      const body = req.body || {};
      const plan = await data.getTodayPlan();
      if (!plan) return json(res, { error: "No plan for today yet" }, 409);

      const wanted =
        body.status === "all"
          ? plan.blocks.filter((b) => STUDY_KINDS.includes(b.kind)).map((b) => b.id)
          : body.status === "none"
            ? []
            : Array.isArray(body.doneIds)
              ? body.doneIds
              : (plan.done || []);

      const result = await data.applyEvening({ doneIds: wanted, eveningMood: body.eveningMood });
      const text = honestEveningLine(result);
      json(res, { ...result, text, lines: [text] });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/command", async (req, res, next) => {
    try {
      const parsed = parseCommand(req.body?.text);
      if (parsed.kind === "chat") {
        return json(res, {
          kind: "chat",
          text: "Chat replies come with the AI layer in sitting 3. Commands work now.",
          unmatched: parsed.text,
        });
      }
      const result = await runCommand(parsed);
      json(res, { kind: parsed.kind, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/plan/date/:date", async (req, res, next) => {
    try {
      const key = String(req.params.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return json(res, { error: "use YYYY-MM-DD" }, 400);
      json(res, { plan: await data.getTodayPlan(key), todayKey: localDayKey() });
    } catch (error) {
      next(error);
    }
  });
}
