# TriageG2 — 30-Second Hands-Free Executive Work HUD for Even Realities G2

**Track:** `04 · AI Assistants & Work` (Primary)  
**Built for:** *Heads Up: Even Realities Hackathon by TVM Ventures & Daos Hub* (100% written fresh during Nov 23–29, 2026 build week; zero pre-existing code).

- **Live Interactive Demo (G2 Simulator + Browser Emulator):** https://z121245017-ai.github.io/triage-g2/
- **Demo Video (78s, Official EvenHub Simulator 0.9.5 Captures):** https://cdn.jsdelivr.net/gh/z121245017-ai/triage-g2@gh-pages/demo.mp4
- **Packaged `.ehpk` Build (`min_app_version 2.2.10`, SDK `0.0.16`):** https://github.com/z121245017-ai/triage-g2/releases/download/v1.0.0/triage-g2.ehpk

TriageG2 turns Even Realities G2 glasses (`576 × 288` 4-bit green micro-LED) and the R1 Ring into a **30-second hands-free morning & pre-meeting executive loop** unifying **Google Calendar, Gmail, Notion, and OpenRouter/Claude/ChatGPT AI drafts** — with a **Default-NO confirmation gate** and **1-tap Undo stack** on every write.

---

## Verified Captures from Official `@evenrealities/evenhub-simulator@0.9.5` (0 Console Errors)

| Executive Focus Radar & Micro-LED Progress Ring | Pre-Meeting 3-Bullet Executive Brief |
| :---: | :---: |
| ![Radar Overview](release/sim_frames/01_radar_overview.png) | ![Meeting Brief](release/sim_frames/02_meeting_brief.png) |

| Default-NO Safety Gate (Move Meeting +30m) | Committed Receipt with 1-Tap Hardware Undo |
| :---: | :---: |
| ![Move Meeting Safety Gate](release/sim_frames/03_confirm_move_meeting.png) | ![Receipt with Undo](release/sim_frames/04_receipt_meeting_moved.png) |

| Push-to-Talk Voice HUD (16kHz PCM Waveform) | Voice-to-Notion Structured Task Confirmation |
| :---: | :---: |
| ![Voice HUD](release/sim_frames/09_voice_hud_mic.png) | ![Voice Notion Confirm](release/sim_frames/10_confirm_notion_voice.png) |

---

## Core Capabilities

1. **Glanceable Executive Radar (`576 × 288`):** Combines next Calendar meeting, urgent Gmail threads, and active Notion tasks alongside a pure-TypeScript **4-bit grayscale micro-LED Inbox-Zero progress ring + source workload bars** pushed via `updateImageRawData`.
2. **Pre-Meeting 3-Bullet Brief & AI Smart Drafts:** Single tap shows 3 distilled bullets + a 1-sentence AI reply/action draft (`Save Gmail Draft` safe-by-default, `Send AI Reply`, `Move Meeting +30m`, `Ping Running 5m Late`, `Add/Complete Notion Task`).
3. **Safety-First Default-NO Gate + 1-Tap Undo:** Every external write previews exact before -> after diffs (`15:00-15:30 -> 15:30-16:00`, Gmail Draft copy, Notion task title & due date) with Option 0 ALWAYS set to `[ NO ] Cancel & keep untouched`. Committed receipts include a 1-tap `Undo Last Action` option.
4. **Push-to-Talk Voice Capture (`LONG_PRESS_EVENT` + `audioControl(true, Glasses)`):** Streams live 16kHz PCM audio from G2 into a 24-bar micro-LED waveform and parses natural work commands (`"Move next meeting by 30 minutes"`, `"Reply to Elena approved sending redline"`, `"Add Notion task ship SDK docs by Friday"`).
5. **Zero-Key Judge Sandbox + Optional Server Bridge (`server/workspace-bridge.mjs`):** Runs out of the box with zero API keys in the simulator or Chrome. Optional local zero-dependency Node bridge keeps `OPENROUTER_API_KEY`, `NOTION_API_KEY`, and `GOOGLE_ACCESS_TOKEN` strictly server-side — cleanly respecting EvenHub's no-frontend-keys & WebView Google Sign-In rules.

---

## Quick Start

```bash
npm install
npm test          # Vitest unit + EvenHub SDK 0.0.16 firmware invariant suite
npm run dev       # Start local app on http://127.0.0.1:5174
npm run build     # Typecheck + Vite production build
npm run pack      # Pack release/triage-g2.ehpk via @evenrealities/evenhub-cli
```

### Run in Official EvenHub Simulator

```bash
npx evenhub-simulator http://127.0.0.1:5174 --automation-port 9899
```

### Optional Live OpenRouter / Notion / Google Workspace Server Bridge

```bash
OPENROUTER_API_KEY=... \
NOTION_API_KEY=... \
NOTION_DATABASE_ID=... \
GOOGLE_ACCESS_TOKEN=... \
npm run server
```

---

## API Feature Requests for Integrated Work Apps (Even G2 UX)

1. **Google Workspace (Gmail & Calendar):** Scoped device-flow / pairing-code OAuth tokens with draft-only Gmail + reschedule-only Calendar scopes so smart glasses WebViews can pair without embedded Google Sign-In popups.
2. **Notion:** Single-endpoint quick-capture webhook supporting natural due-date parsing (`"by Friday"`) with idempotent `Undo/Archive` tokens for hands-free voice capture.
3. **OpenRouter / Claude / ChatGPT:** Built-in low-latency `max_chars` wearable formatting mode tailored to 4-line monochrome micro-LED viewports (`<= 22` chars/line).
