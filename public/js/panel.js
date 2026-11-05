/**
 * The B side panel: pending backlog on the left list, today's plan on the
 * right. Clicking a backlog item marks it done, which re-plans through the
 * command endpoint so the panel and the orb never disagree.
 */
export function createPanel({ api, onPickBlock }) {
  const panel = document.getElementById("panel");
  const backlogList = document.getElementById("panelBacklog");
  const planList = document.getElementById("panelPlan");
  const backlogCount = document.getElementById("panelBacklogCount");
  let state = { backlog: [], plan: null };

  function render() {
    backlogList.textContent = "";
    const pending = state.backlog.filter((item) => !item.done);
    backlogCount.textContent = String(pending.length);

    if (!pending.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Queue is empty";
      backlogList.appendChild(empty);
    }

    for (const item of pending.slice(0, 40)) {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "row";
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = `${item.subject} | ${item.chapter}`;
      const num = document.createElement("span");
      num.className = "row-num";
      num.textContent = `L${item.lecture}`;
      const tick = document.createElement("span");
      tick.className = "row-tick";
      tick.textContent = "done";
      button.append(label, num, tick);
      button.title = "Mark this lecture done";
      button.addEventListener("click", async () => {
        await api.command(`done 1`).catch(() => {});
        await refresh();
        onPickBlock("replanned");
      });
      row.appendChild(button);
      backlogList.appendChild(row);
    }

    planList.textContent = "";
    const blocks = state.plan?.blocks || [];
    if (!blocks.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = state.plan ? "No study blocks" : "No plan yet - press SPACE or say check in";
      planList.appendChild(empty);
    }
    for (const block of blocks) {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `row block ${state.plan.done?.includes(block.id) ? "is-done" : ""}`;
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = block.label;
      const num = document.createElement("span");
      num.className = "row-num";
      num.textContent = block.minutes ? `${block.minutes}m` : "open";
      button.append(label, num);
      button.addEventListener("click", () => onPickBlock(block.id, button.classList.contains("is-done")));
      row.appendChild(button);
      planList.appendChild(row);
    }
  }

  async function refresh() {
    state = await api.state().catch(() => state);
    render();
    return state;
  }

  function toggle() {
    const open = panel.classList.toggle("open");
    panel.setAttribute("aria-hidden", String(!open));
    if (open) refresh();
    return open;
  }

  function close() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  function isOpen() {
    return panel.classList.contains("open");
  }

  function setPlan(plan) {
    state.plan = plan;
    render();
  }

  document.getElementById("panelClose").addEventListener("click", close);

  render();
  return { toggle, close, isOpen, refresh, setPlan, render };
}
