const el = (id) => document.getElementById(id);

const dom = {
  statusDot: el("statusDot"),
  statusText: el("statusText"),
  systems: el("systems"),
  signalFill: el("signalFill"),
  signalValue: el("signalValue"),
  message: el("message"),
  suggestion: el("suggestion"),
  voiceName: el("voiceName"),
  bootlog: el("bootlog"),
  chips: el("chips"),
  lines: el("lines"),
};

function showMessage(text) {
  if (!text) return;
  dom.message.classList.add("fading");
  setTimeout(() => {
    dom.message.textContent = text;
    dom.message.classList.remove("fading");
  }, 260);
}

function bootLine(text, offline) {
  const line = document.createElement("li");
  line.textContent = offline ? `${text} - OFFLINE` : text;
  if (offline) line.classList.add("offline");
  dom.bootlog.appendChild(line);
  return line;
}

function renderSystems(providers) {
  const linked = (providers || []).filter((p) => p.linked);
  dom.systems.textContent = "";
  if (linked.length === 0) {
    const none = document.createElement("li");
    none.className = "systems-none";
    none.textContent = "None linked";
    dom.systems.appendChild(none);
    return;
  }
  for (const p of linked) {
    const item = document.createElement("li");
    item.textContent = p.label;
    if (p.active) item.classList.add("active");
    if (p.cooling) item.classList.add("cooling");
    dom.systems.appendChild(item);
  }
}

function renderChips(chips, onPick) {
  dom.chips.textContent = "";
  for (const chip of chips || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = chip.label;
    button.addEventListener("click", () => onPick(chip.value));
    dom.chips.appendChild(button);
  }
}

function showLines(lines) {
  dom.lines.textContent = "";
  for (const line of lines || []) {
    const p = document.createElement("p");
    p.className = "line";
    p.textContent = line;
    dom.lines.appendChild(p);
  }
}

export const hud = {
  setStatus(text, accent) {
    dom.statusText.textContent = text;
    if (accent) {
      dom.statusDot.style.background = accent;
      dom.statusDot.style.color = accent;
    }
  },
  setSignal(level) {
    const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
    dom.signalFill.style.height = `${pct}%`;
    dom.signalValue.textContent = `${pct}%`;
  },
  setSignalColor(cssColor) {
    dom.signalFill.style.background = cssColor;
  },
  setSuggestion(text) {
    dom.suggestion.textContent = text;
  },
  setVoiceName(name) {
    dom.voiceName.textContent = name || "\u2014";
  },
  showMessage,
  renderChips,
  clearChips: () => renderChips([], () => {}),
  showLines,
  bootLine,
  bootDone() {
    dom.bootlog.classList.add("done");
  },
  renderSystems,
  goOnline() {
    document.body.classList.add("online");
  },
};
