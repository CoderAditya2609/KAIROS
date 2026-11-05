/**
 * The C text bar. One input for typed commands, the note answer and the name.
 * Enter sends, Esc closes. Keys are ignored while it is open except for the
 * ones handled here.
 */
export function createBar({ onSubmit }) {
  const wrap = document.getElementById("bar");
  const input = document.getElementById("barInput");
  let onEscape = () => {};
  let expect = null;

  function open(options = {}) {
    expect = options.expect || null;
    input.placeholder = options.placeholder || "type a command...";
    wrap.classList.add("open");
    input.focus();
    onEscape = options.onEscape || close;
  }

  function close() {
    wrap.classList.remove("open");
    input.value = "";
    expect = null;
    if (document.activeElement === input) input.blur();
  }

  function isOpen() {
    return wrap.classList.contains("open");
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    // Close first: while the bar holds focus every hotkey is typing, and the
    // flow can reopen it for the next text answer.
    close();
    onSubmit(text, expect);
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      send();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  });

  wrap.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
  });

  return { open, close, isOpen, focus: () => input.focus() };
}
