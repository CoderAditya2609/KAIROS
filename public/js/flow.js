import { api } from "./api.js";

/**
 * The check-in state machine (kprompt 9.1). Works entirely with clicks and
 * typed answers, so no microphone and no AI is ever required.
 */
export function createFlow({ hud, orb, onPlan, onDoneQuestion, openBar, closeBar }) {
  let active = false;
  let step = null;
  let answers = {};

  function ask(question) {
    hud.showMessage(question.text);
    hud.renderChips(question.chips || [], (value) => answer(value));
    if (question.input === "text") {
      hud.setSuggestion("type your answer, then Enter");
      openBar?.({ placeholder: "type here, Enter to send", expect: "answer" });
      return;
    }
    closeBar?.();
    hud.setSuggestion(question.hint || "click a chip, or press C and type it");
  }

  async function begin() {
    active = true;
    answers = {};
    orb.setState("thinking");
    const data = await api.checkinQuestion().catch(() => null);
    if (!data) {
      orb.setState("error");
      hud.showMessage("Server is not answering. Close the KAIROS SERVER window and run kairos.bat again.");
      active = false;
      return;
    }
    step = data.step;
    if (step === "done") {
      active = false;
      step = null;
      hud.showMessage(data.question.text);
      onPlan(data.plan, null);
      onDoneQuestion(data.question.chips);
      return;
    }
    orb.setState("speaking");
    ask(data.question);
  }

  function isNumericStep() {
    return step === "energy" || step === "mood";
  }

  async function answer(value) {
    if (!active || !step) return false;
    if (step === "name") {
      await api.setName(value).catch(() => {});
      return advanceFrom("daytype");
    }
    if (step === "daytype") {
      answers.dayType = value;
      if (value === "sick") return finish();
      if (value === "vacation") return advanceFrom("vacation");
      return advanceFrom("energy");
    }
    if (step === "vacation") {
      answers.wantsToStudy = value === "yes";
      return answers.wantsToStudy ? advanceFrom("energy") : finish();
    }
    if (step === "energy") {
      answers.energy = Number(value) || 3;
      return advanceFrom("mood");
    }
    if (step === "mood") {
      answers.mood = Number(value) || 3;
      return advanceFrom("note");
    }
    if (step === "note") {
      answers.note = value === "skip" ? "" : String(value);
      return finish();
    }
    return false;
  }

  async function advanceFrom(next) {
    if (!next) return finish();
    const data = await api.checkinQuestion(next).catch(() => null);
    if (!data) return finish();
    step = data.step;
    ask(data.question);
    return true;
  }

  async function finish() {
    active = false;
    step = null;
    hud.clearChips();
    closeBar?.();
    orb.setState("analysing");
    const result = await api.checkin(answers).catch(() => null);
    if (!result) {
      orb.setState("error");
      hud.showMessage("Could not build the plan. Check the server window.");
      return false;
    }
    hud.showMessage(result.text);
    hud.showLines(result.lines);
    hud.setSuggestion("press B for the panel, C for commands");
    onPlan(result.plan, result.text);
    return true;
  }

  const DAY_ALIASES = [
    ["school_day", /school|class\s*day|mon-fri|college/],
    ["off_day", /off|holiday|free\s*day|day\s*off/],
    ["vacation", /vacation|break/],
    ["exam_week", /exam/],
    ["sick", /sick|low|bad|awful|tired/],
  ];

  function dayTypeFromText(text) {
    const lower = text.toLowerCase();
    const hit = DAY_ALIASES.find(([, pattern]) => pattern.test(lower));
    return hit ? hit[0] : null;
  }

  /** Text from the bar or the microphone: the flow gets first claim on it. */
  async function handleText(text) {
    if (!active) return false;
    if (step === "name") return answer(text);
    if (isNumericStep() && /^[1-5]$/.test(text.trim())) return answer(text.trim());
    if (step === "note") return answer(text);
    if (step === "daytype") {
      const mapped = dayTypeFromText(text);
      if (mapped) return answer(mapped);
      hud.setSuggestion("say school, off, vacation, exam or sick");
      return true;
    }
    if (step === "vacation") {
      if (/^y/.test(text.trim().toLowerCase())) return answer("yes");
      if (/^n/.test(text.trim().toLowerCase())) return answer("no");
      return true;
    }
    return false;
  }

  function isActive() {
    return active;
  }

  function stepName() {
    return step;
  }

  function cancel() {
    active = false;
    step = null;
    hud.clearChips();
  }

  return { begin, answer, handleText, isActive, stepName, cancel };
}
