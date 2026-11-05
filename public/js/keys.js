import { api } from "./api.js";
import { STATE_ORDER } from "./orb.js";

/**
 * One place for every key. A key is only "dead" if nothing claims it, so each
 * binding here either does something or says why it cannot.
 */
export function installKeys({ orb, hud, flow, bar, panel, voice, booted, isDebug }) {
  let spaceHeld = false;
  let hintIsListening = false;

  function isTyping(event) {
    const tag = event.target?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  }

  async function submitText(text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    if (await flow.handleText(clean)) return;

    orb.setState("thinking");
    let result;
    try {
      result = await api.command(clean);
    } catch {
      hud.showMessage("Server not reachable. Run kairos.bat again.");
      orb.setState("error");
      return;
    }
    if (result.error) {
      hud.showMessage(result.error);
      orb.setState("error");
      return;
    }
    hud.showMessage(result.text);
    if (result.lines) hud.showLines(result.lines);
    if (result.plan) panel.setPlan(result.plan);
    if (result.openPanel && !panel.isOpen()) panel.toggle();
    if (result.startCheckin) flow.begin();
    if (result.evening) {
      panel.setPlan(result.plan);
      hud.renderChips(result.eveningQuestion?.chips || [
        { value: "all", label: "All done" },
        { value: "some", label: "Some" },
        { value: "none", label: "None" },
      ], (value) => sendEvening(value));
    }
    if (result.kind === "chat") hud.setSuggestion("ai replies arrive in sitting 3");
    voice.speak(result.text);
    orb.setState("standby");
    panel.refresh().catch(() => {});
  }

  async function sendEvening(status) {
    const plan = await api.state().then((s) => s.today).catch(() => null);
    if (!plan) return;
    let doneIds = [];
    if (status === "some") {
      hud.showMessage("Click the finished blocks in the panel, then press Enter.");
      panel.toggle();
      return;
    }
    if (status === "all") doneIds = plan.blocks.filter((b) => ["backlog", "staple", "revision"].includes(b.kind)).map((b) => b.id);
    const result = await api.evening({ status, doneIds }).catch(() => null);
    if (!result) return hud.showMessage("Evening check failed. Is the server running?");
    hud.showMessage(result.text);
    hud.showLines(result.lines);
    hud.clearChips();
    voice.speak(result.text);
    panel.refresh().catch(() => {});
  }

  window.addEventListener("keydown", (event) => {
    if (isTyping(event)) return;

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (event.repeat || spaceHeld) return;
      spaceHeld = true;
      if (!voice.listen.isAvailable) {
        hud.showMessage("Speech recognition needs Edge or Chrome. Press C and type instead.");
        if (!flow.isActive()) flow.begin();
        return;
      }
      voice.listen.start().then((started) => {
        if (!started) return;
        hintIsListening = true;
        hud.setSuggestion("listening... release space to send");
      });
      return;
    }

    if (event.key === "Escape") {
      if (bar.isOpen()) return; // the bar handles its own Escape
      if (panel.isOpen()) {
        panel.close();
        return;
      }
      if (flow.isActive()) {
        flow.cancel();
        hud.showMessage("Check-in stopped. Press SPACE to start again.");
        orb.setState("standby");
      }
      return;
    }

    if (!booted()) return;

    switch (event.key.toLowerCase()) {
      case "c":
        event.preventDefault();
        if (bar.isOpen()) bar.close();
        else bar.open({ placeholder: flow.isActive() ? "type your answer" : "command: show plan, done 2, mood 3..." });
        break;
      case "b":
        event.preventDefault();
        panel.toggle();
        break;
      case "v":
        event.preventDefault();
        if (!voice.hasSynthesis) hud.showMessage("No speech engine in this browser.");
        else if (!voice.cycleVoice()) hud.showMessage("No voices available.");
        break;
      case "m": {
        event.preventDefault();
        const muted = voice.toggleMute();
        hud.setSuggestion(muted ? "spoken replies muted" : "spoken replies on");
        hud.showMessage(muted ? "Muted." : "Sound on.");
        break;
      }
      default: {
        if (!isDebug()) return;
        const index = Number(event.key);
        if (!Number.isInteger(index) || index < 1 || index > 7) return;
        if (flow.isActive()) return; // 1-5 are chip answers first
        event.preventDefault();
        orb.setState(STATE_ORDER[index - 1]);
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code !== "Space" && event.key !== " ") return;
    if (!spaceHeld) return;
    spaceHeld = false;
    const wasListening = voice.listen.isListening();
    voice.listen.stop(wasListening);
    if (hintIsListening) {
      hintIsListening = false;
      hud.setSuggestion("");
    }
  });

  return { submitText, sendEvening };
}
