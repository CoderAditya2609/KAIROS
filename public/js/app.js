import { createOrb, STATE_ORDER, colorCss } from "./orb.js";
import { hud } from "./hud.js";
import { startBoot } from "./boot.js";

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

function installDebugKeys() {
  window.addEventListener("keydown", (event) => {
    if (!booted || !debug) return;
    const index = Number(event.key);
    if (!Number.isInteger(index) || index < 1 || index > STATE_ORDER.length) return;
    event.preventDefault();
    applyState(STATE_ORDER[index - 1]);
  });
}

function installVisibilityPause() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) orb.stop();
    else orb.start();
  });
}

function main() {
  trace.orb = orb;
  orb.start();
  sampleFps();
  installDebugKeys();
  installVisibilityPause();

  let signalClock = 0;
  setInterval(() => {
    signalClock += 0.2;
    hud.setSignal(idleSignal(signalClock));
  }, 200);

  startBoot({
    orb,
    hud,
    checks: { voice: loadVoices, providers: pingServer },
    onPhase: (index, elapsed) => trace.phases.push([PHASE_NAMES[index], Math.round(elapsed)]),
    onOnline: () => {
      booted = true;
      hud.setStatus(STATUS_LABELS.standby, colorCss("standby"));
      hud.showMessage(greeting());
    },
  });
}

main();
