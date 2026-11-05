# KAIROS — PROGRESS

Build prompt: `../kprompt.txt` (outside this repo). Visual reference: `../init.png`.
One sitting per session. Stop after each sitting until the user types `next sitting`.

## Sitting 1 — shell, look, orb, boot
- [x] 1. Folder layout, package.json, .gitignore, PROGRESS.md, README stub, .env.example, config.json, data.example/
- [x] 2. Express server on port 4747, serves public/, GET /api/health
- [x] 3. index.html + CSS: background, scanlines, corner brackets, HUD text
- [x] 4. orb.js: canvas orb, 7 states, eased colors, debug keys 1-7
- [x] 5. boot.js: five-phase boot with status log and skip
- [x] 6. kairos.bat launcher

## Sitting 2 — data + plan engine + check-in (no AI)
- [x] 1. store/ atomic JSON, first-run copy, corrupt-file recovery
- [x] 2. plan/ pure functions per section 9.3
- [x] 3. node:test unit tests, at least 12 cases (31 cases: plan engine + command parser)
- [x] 4. Routes: checkin, plan/today, backlog, evening, command
- [x] 5. Frontend check-in flow, chips, name capture, text bar, side panel
- [x] 6. Template-based messages (no AI)

## Sitting 3 — AI layer
- [ ] 1. providers/ client, model discovery, cool-down, fallback chain
- [ ] 2. Chat route + chat.js, 6-turn memory, privacy summary
- [ ] 3. SYSTEMS panel + status dot from real provider state
- [ ] 4. Distress check before any AI call
- [ ] 5. Tests with a fake local provider server

## Sitting 4 — voice (pulled forward: the reported dead keys)
- [x] 1. voice.js: speechSynthesis, voice list, V cycle, M mute, speaking state
- [x] 2. Push-to-talk with webkitSpeechRecognition, interim text, fallbacks
- [x] 3. Mic level analyser driving orb ripples and SIGNAL bar
- [x] 4. Echo guard
- [ ] 5. Live microphone QA with permission granted (needs one SPACE hold at the machine)

NEXT: Sitting 3 task 1 — providers/ client with the free fallback chain, so free
text gets a real answer instead of the "comes in sitting 3" placeholder.

## Sitting 5 — backlog polish, evening, finish
- [ ] 1. Backlog panel: add/edit/reorder/delete, mark done, range import
- [ ] 2. Exams UI and exam-week behaviour
- [ ] 3. Evening check-in flow and day logs
- [ ] 4. Weekly summary line
- [ ] 5. Error/empty/loading states, README, remove debug leftovers
- [ ] 6. Final full run-through against every acceptance list
