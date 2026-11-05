import { createOrb, colorCss } from "./orb.js";
import { hud } from "./hud.js";
import { startBoot } from "./boot.js";
import { api } from "./api.js";
import { createBar } from "./bar.js";
import { createPanel } from "./panel.js";
import { createFlow } from "./flow.js";
import { createVoice } from "./voice.js";
import { installKeys } from "./keys.js";

const STATUS_LABELS = {
  standby: "STANDBY - PRESS SPACE",
  listening: "LISTENING",
  thinking: "THINKING",
  analysing: "ANALYSING",
  speaking: "SPEAKING",
  error: "SIGNAL LOST",
};

const canvas = document.getElementById("stage");
const PHASE_NAMES = ["", "IGNITION", "CORE", "RINGS", "STABILISING", "ONLINE"];

// Dev hook used by the sitting acceptance checks; removed in sitting 5.
const trace = { phases: [], fps: 0, orb: null };
window.__kairos = trace;

function sampleFps() {
  let frames = 0;
  let windowStart = performance.now();
  const tick = () => {
    frames += 1;
    const now = performance.now();
    if (now - windowStart >= 1000) {
      trace.fps = Math.round((frames * 1000) / (now - windowStart));
      frames = 0;
      windowStart = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const orb = createOrb(canvas);
let booted = false;
let debug = true;
let plannerName = "Blaze";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return Promise.reject(new Error("no speech engine"));
  const waiting = new Promise((resolve) => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) resolve(voices);
    };
    pick();
    if (!window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener("voiceschanged", pick, { once: true });
    }
  });
  return withTimeout(waiting, 2500, "voice engine").then((voices) => {
    const english =
      voices.find((v) => /^en[-_]IN/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
    if (english) hud.setVoiceName(english.name.replace(/^Microsoft\s+/i, ""));
    return voices;
  });
}

function pingServer() {
  return withTimeout(fetch("/api/health"), 4000, "server")
    .then((res) => res.json())
    .then((meta) => {
      debug = meta.debug !== false;
      plannerName = meta.plannerName || plannerName;
      if (!meta.ok) throw new Error("unhealthy");
      return meta;
    });
}

function greeting() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${plannerName}.`;
}

function applyState(name) {
  orb.setState(name);
  hud.setStatus(STATUS_LABELS[name] || name.toUpperCase(), colorCss(name));
  hud.setSignalColor(colorCss(name));
}

function idleSignal(time) {
  const state = orb.getState();
  if (state === "standby") return 0.72 + 0.06 * Math.sin(time * 0.5);
  if (state === "boot") return 0.1 + 0.1 * Math.sin(time * 2);
  return 0.35 + 0.3 * Math.abs(Math.sin(time * 1.6));
}

function installVisibilityPause() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) orb.stop();
    else orb.start();
  });
}

// One view of the orb for every module, so state colour and status text always
// change together.
const orbView = { setState: applyState, setLevel: (value) => orb.setLevel(value) };

// Set after installKeys() exists; the voice module calls it on release.
let submit = () => {};

const voice = createVoice({
  hud,
  orb: orbView,
  language: "en-IN",
  onInterim: (text) => hud.setSuggestion(text ? `heard: ${text}` : ""),
  onResult: (text) => submit(text),
  onIdle: () => {
    if (!voice.listen.isListening() && !flow.isActive()) applyState("standby");
  },
  onError: (kind) => {
    if (kind === "not-allowed" || kind === "service-not-allowed") {
      hud.showMessage("Microphone blocked. Press C and type instead.");
    } else if (kind === "no-speech") {
      hud.setSuggestion("nothing heard. Press SPACE again, or press C to type");
    } else {
      hud.showMessage("Voice is busy. Press C and type instead.");
    }
    applyState("standby");
  },
});

const panel = createPanel({
  api,
  onPickBlock: async (blockId) => {
    if (blockId === "replanned") {
      applyState("analysing");
      const result = await api.planToday().catch(() => null);
      if (result?.plan) {
        panel.setPlan(result.plan);
        hud.showLines(result.lines);
      }
      applyState("standby");
      return;
    }
    const state = await api.state().catch(() => null);
    const plan = state?.today;
    if (!plan) return;
    const done = new Set(plan.done || []);
    if (done.has(blockId)) done.delete(blockId);
    else done.add(blockId);
    const result = await api.evening({ status: "some", doneIds: [...done] }).catch(() => null);
    if (!result) return;
    panel.setPlan(result.plan);
    hud.showMessage(result.text);
    voice.speak(result.text);
  },
});

const flow = createFlow({
  hud,
  orb: orbView,
  openBar: (options) => bar.open(options),
  closeBar: () => bar.close(),
  onPlan: (plan, text) => {
    panel.setPlan(plan);
    applyState("standby");
    voice.speak(text || "");
  },
  onDoneQuestion: (chips) => hud.renderChips(chips, (value) => keys.sendEvening(value)),
});

const bar = createBar({
  onSubmit: (text) => submit(text),
  onEscape: () => {
    bar.close();
    if (flow.isActive()) {
      flow.cancel();
      hud.showMessage("Stopped. Press SPACE to start again.");
      applyState("standby");
    }
  },
});

const keys = installKeys({
  orb: orbView,
  hud,
  flow,
  bar,
  panel,
  voice,
  booted: () => booted,
  isDebug: () => debug,
});
submit = keys.submitText;

async function loadInitialState() {
  const state = await api.state().catch(() => null);
  if (!state) {
    hud.showMessage("Server not reachable. Close the KAIROS SERVER window and run kairos.bat again.");
    applyState("error");
    return;
  }
  plannerName = state.name || plannerName;
  panel.setPlan(state.today);
  hud.showMessage(state.today ? `${greeting()} Plan is ready. Press B to see it.` : greeting());
  if (state.today) {
    hud.showLines(state.today.lines || []);
    hud.setSuggestion("press B for the panel, C for commands");
  } else {
    hud.setSuggestion("press SPACE, or C then say check in");
    flow.begin();
  }
}

function main() {
  trace.orb = orb;
  trace.keys = keys;
  orb.start();
  sampleFps();
  installVisibilityPause();

  let signalClock = 0;
  setInterval(() => {
    signalClock += 0.2;
    if (voice.listen.isListening()) return; // the mic owns the bar
    hud.setSignal(idleSignal(signalClock));
  }, 200);

  startBoot({
    orb,
    hud,
    checks: { voice: loadVoices, providers: pingServer },
    onPhase: (index, elapsed) => trace.phases.push([PHASE_NAMES[index], Math.round(elapsed)]),
    onOnline: () => {
      booted = true;
      applyState("standby");
      loadInitialState();
    },
  });
}

main();
