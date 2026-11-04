# KAIROS

**The right moment, planned.** A local, JARVIS-style daily planner for a Class XI JEE student.
A glowing orb, a cinematic boot, a morning check-in that reads the day type plus energy and mood,
and a plan that covers both the study backlog and the rest he actually needs.

Everything runs on his own machine. Data stays in `data/`. The plan is computed by code, never by an AI,
so KAIROS still works with no internet and no API keys.

## Status

Sitting 1 of 5 — shell, look, orb, boot animation. The daily check-in, plan engine, AI layer and voice
arrive in the sittings after this one (see `PROGRESS.md`).

## Run it

```
npm install
npm start          # starts the local server on http://localhost:4747
```

Or double-click `kairos.bat`, which starts the server and opens the app in an Edge app-mode window.

## Stopping it

Closing the KAIROS window does not stop the server. Close the minimised **KAIROS SERVER** taskbar
window, or run:

```
taskkill /FI "WINDOWTITLE eq KAIROS SERVER"
```

`npm start` in a terminal stops with Ctrl+C.

## Keys

Copy `.env.example` to `.env` and fill in any provider key you have. KAIROS works with none of them.
`.env` and `data/` are gitignored and must never be committed.

## Debug

With `"debug": true` in `config.json`, keys 1-7 force the orb states
(boot, standby, listening, thinking, analysing, speaking, error) so the colors can be checked.
Set it to `false` when the look is approved.

## Layout

```
server/       Node + Express
public/       plain HTML/CSS/JS, canvas orb
data/         runtime personal data — gitignored, never committed
data.example/ sample JSON copied into data/ on first run
config.json   non-secret settings
.env          API keys only — gitignored
```
