# KAIROS

**The right moment, planned.** A local, JARVIS-style daily planner for a Class XI JEE student.
A glowing orb, a cinematic boot, a morning check-in that reads the day type plus energy and mood,
and a plan that covers both the study backlog and the rest he actually needs.

Everything runs on his own machine. Data stays in `data/`. The plan is computed by code, never by an AI,
so KAIROS still works with no internet and no API keys.

## Status

Sitting 2 of 5 done — shell, orb, boot, launcher, data store, plan engine, check-in, text commands
and voice input/output. Still to come: the AI phrasing layer (sitting 3) and backlog polish (sitting 5).
See `PROGRESS.md`.

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

## Hotkeys

| Key | What it does |
| --- | --- |
| `SPACE` | Hold to talk, release to send. If the mic is blocked, KAIROS says so and the text bar still works. |
| `C` | Open the text bar. Enter sends, Esc closes. |
| `B` | Slide-in panel: pending backlog and today's plan. Click a lecture to mark it done; click a block for the evening tick. |
| `V` | Cycle the Windows voices; the name shows in the hotkey row. |
| `M` | Mute or unmute spoken replies. |
| `Esc` | Skip the boot animation, close the bar or panel, or stop a check-in. |

Typed commands, all handled by code with no AI: `add backlog Physics | Rotational Motion | lectures 3 to 7`,
`done 2`, `mood 3`, `energy 4`, `vacation`, `skip today`, `add exam Maths | 2026-11-20`,
`show plan`, `show backlog`, `evening`.

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
