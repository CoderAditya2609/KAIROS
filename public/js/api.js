const JSON_HEADERS = { "content-type": "application/json" };

async function call(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { ...JSON_HEADERS, ...(options.headers || {}) },
    });
  } catch {
    throw new Error("offline");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok && !body.error) throw new Error("offline");
  if (body.error) throw new Error(body.error);
  return body;
}

export const api = {
  state: () => call("/api/state"),
  checkinQuestion: (step) => call(`/api/checkin${step ? `?step=${step}` : ""}`),
  setName: (name) => call("/api/profile", { method: "POST", body: JSON.stringify({ name }) }),
  checkin: (payload) => call("/api/checkin", { method: "POST", body: JSON.stringify(payload) }),
  planToday: () => call("/api/plan/today"),
  backlog: () => call("/api/backlog"),
  addBacklog: (items) => call("/api/backlog", { method: "POST", body: JSON.stringify({ items }) }),
  evening: (payload) => call("/api/evening", { method: "POST", body: JSON.stringify(payload) }),
  command: (text) => call("/api/command", { method: "POST", body: JSON.stringify({ text }) }),
};
