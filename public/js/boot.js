const PHASES = [
  { name: "IGNITION", ms: 1100 },
  { name: "CORE", ms: 1300 },
  { name: "RINGS", ms: 1600 },
  { name: "STABILISING", ms: 2000 },
  { name: "ONLINE", ms: 1000 },
];

const TOTAL_MS = PHASES.reduce((sum, p) => sum + p.ms, 0);
const TYPE_MS_PER_CHAR = 22;

/**
 * Each log line appears when its check finishes or at its timed slot,
 * whichever is later. A failed check is still a line, marked OFFLINE.
 */
const STEPS = [
  { text: "INITIALISING CORE", slot: 0 },
  { text: "CALIBRATING VOICE ENGINE", slot: 1600, check: "voice" },
  { text: "LINKING PROVIDERS", slot: 3000, check: "providers" },
  { text: "LOADING MEMORY", slot: 4200, check: "memory" },
  { text: "STABILISING", slot: 5300 },
  { text: "KAIROS ONLINE", slot: 6300 },
];

function phaseAt(elapsed) {
  let acc = 0;
  for (let i = 0; i < PHASES.length; i += 1) {
    if (elapsed < acc + PHASES[i].ms) {
      return { index: i + 1, t: (elapsed - acc) / PHASES[i].ms };
    }
    acc += PHASES[i].ms;
  }
  return { index: PHASES.length, t: 1 };
}

export function startBoot({ orb, hud, checks = {}, onOnline, onPhase }) {
  const startedAt = performance.now();
  const pending = new Map();
  const done = new Set();
  let finished = false;
  let lastPhase = 0;

  for (const step of STEPS) {
    if (!step.check) continue;
    pending.set(step.text, { state: "waiting", at: null });
    const run = checks[step.check];
    if (typeof run !== "function") {
      pending.set(step.text, { state: "skipped", at: 0 });
      continue;
    }
    Promise.resolve()
      .then(run)
      .then(
        () => pending.set(step.text, { state: "ok", at: performance.now() - startedAt }),
        () => pending.set(step.text, { state: "failed", at: performance.now() - startedAt }),
      );
  }

  function typeLine(text, offline) {
    const li = hud.bootLine("", offline);
    let i = 0;
    const tick = () => {
      if (finished) {
        li.textContent = text;
        return;
      }
      i += 1;
      li.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(tick, TYPE_MS_PER_CHAR);
    };
    setTimeout(tick, TYPE_MS_PER_CHAR);
  }

  function emit(step, now) {
    if (done.has(step.text)) return false;
    if (now < step.slot) return false;
    const result = step.check ? pending.get(step.text) : null;
    // A check that has not reported yet holds its line, but never the boot:
    // the timeout in the check itself resolves or rejects it.
    if (result && result.state === "waiting") return false;
    const failed = result && result.state === "failed";
    typeLine(step.text, failed);
    done.add(step.text);
    return true;
  }

  function complete() {
    if (finished) return;
    finished = true;
    window.removeEventListener("keydown", skip);
    window.removeEventListener("pointerdown", skip);
    for (const step of STEPS) {
      if (!done.has(step.text)) hud.bootLine(step.text, false);
    }
    orb.setBootPhase(null);
    orb.setState("standby");
    hud.bootDone();
    hud.goOnline();
    hud.setStatus("STANDBY - PRESS SPACE");
    if (onOnline) onOnline();
  }

  function skip() {
    complete();
  }

  window.addEventListener("keydown", skip);
  window.addEventListener("pointerdown", skip);

  function tick() {
    if (finished) return;
    const elapsed = performance.now() - startedAt;
    const phase = phaseAt(elapsed);
    orb.setBootPhase(phase.index, phase.t);
    if (phase.index !== lastPhase) {
      lastPhase = phase.index;
      if (onPhase) onPhase(phase.index, elapsed);
    }
    for (const step of STEPS) emit(step, elapsed);
    if (elapsed >= TOTAL_MS && done.size === STEPS.length) {
      complete();
      return;
    }
    // Hard deadline: a check that never reports is offline, the boot is not.
    if (elapsed >= TOTAL_MS + 1500) {
      for (const result of pending.values()) {
        if (result.state === "waiting") result.state = "failed";
      }
      complete();
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return { skip: complete, totalMs: TOTAL_MS };
}
