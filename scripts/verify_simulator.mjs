#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_DIR = process.cwd();
const OUT_DIR = path.join(PROJECT_DIR, 'release', 'sim_frames');
const PREVIEW_PORT = 4174;
const AUTO_PORT = 9899;
const AUTO_BASE = `http://127.0.0.1:${AUTO_PORT}`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function sendInput(action, delayAfterMs = 950) {
  const res = await fetch(`${AUTO_BASE}/api/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Input ${action} failed: HTTP ${res.status}`);
  await sleep(delayAfterMs);
}

async function saveShot(endpoint, filename) {
  const res = await fetch(`${AUTO_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`Screenshot ${endpoint} failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT_DIR, filename), buf);
  console.log(`Captured ${filename} (${buf.length} bytes)`);
}

function killGroup(child) {
  if (!child || !child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {
    try { child.kill('SIGTERM'); } catch {}
  }
}

async function main() {
  const viteBin = path.join(PROJECT_DIR, 'node_modules', '.bin', 'vite');
  const simBin = path.join(PROJECT_DIR, 'node_modules', '.bin', 'evenhub-simulator');

  const preview = spawn(viteBin, ['preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: PROJECT_DIR,
    detached: true,
    stdio: 'ignore',
  });

  let sim;
  try {
    await waitForUrl(`http://127.0.0.1:${PREVIEW_PORT}/`, 12000);
    console.log(`Preview server live on http://127.0.0.1:${PREVIEW_PORT}`);

    sim = spawn(
      simBin,
      [`http://127.0.0.1:${PREVIEW_PORT}/?fresh=1`, '--automation-port', String(AUTO_PORT), '--glow'],
      { cwd: PROJECT_DIR, detached: true, stdio: 'ignore' },
    );

    await waitForUrl(`${AUTO_BASE}/api/ping`, 25000);
    console.log('EvenHub Simulator responded: pong');
    await sleep(3000);

    // 1. Focus Radar Overview (Next Meeting + Inbox + Notion + Micro-LED Progress Ring)
    await saveShot('/api/screenshot/glasses', '01_radar_overview.png');
    await saveShot('/api/screenshot/webview', '00_companion_webview.png');

    // 2. Tap "[CAL 12m] Q4 API Launch Sync" -> Pre-Meeting 3-Bullet Brief & Actions
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '02_meeting_brief.png');

    // 3. Tap "> Move Meeting +30m" -> Safety Gate (Default = NO)
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '03_confirm_move_meeting.png');

    // 4. Swipe Down to [ YES ] + Tap -> Action Receipt (15:00 -> 15:30) with Undo Option!
    await sendInput('down', 600);
    await sendInput('click', 1000);
    await saveShot('/api/screenshot/glasses', '04_receipt_meeting_moved.png');

    // 5. Tap Return -> Updated Radar showing "[CAL +30m] Q4 API Launch Sync"
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '05_radar_after_shift.png');

    // 6. Swipe Down to "[MAIL!] Elena: MSA Redline" + Tap -> Gmail AI Draft Card
    await sendInput('down', 600);
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '06_gmail_elena_brief.png');

    // 7. Tap "> Save Gmail Draft" -> Safety Gate (Default = NO)
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '07_confirm_gmail_draft.png');

    // 8. Swipe Down to [ YES ] + Tap -> Gmail Draft Saved Receipt
    await sendInput('down', 600);
    await sendInput('click', 1000);
    await saveShot('/api/screenshot/glasses', '08_receipt_gmail_draft.png');

    // 9. Return to Radar -> Long-Press Temple -> Voice Command HUD (16kHz PCM Waveform)
    await sendInput('click', 950);
    await sendInput('long_press', 1100);
    await saveShot('/api/screenshot/glasses', '09_voice_hud_mic.png');

    // 10. Release -> Select index 2 ("Add Notion task ship SDK docs by Friday") -> Confirm -> Receipt -> Final Radar
    await sendInput('long_press_release', 800);
    await sendInput('down', 500);
    await sendInput('down', 500);
    await sendInput('click', 950);
    await saveShot('/api/screenshot/glasses', '10_confirm_notion_voice.png');

    await sendInput('down', 600);
    await sendInput('click', 1000);
    await saveShot('/api/screenshot/glasses', '11_receipt_notion_created.png');

    const consoleRes = await fetch(`${AUTO_BASE}/api/console`);
    const consoleJson = await consoleRes.json();
    const errors = (consoleJson.entries || []).filter((e) => e.level === 'error');
    console.log(`Simulator console total=${(consoleJson.entries || []).length}, errors=${errors.length}`);
    if (errors.length > 0) console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2));
  } finally {
    killGroup(sim);
    killGroup(preview);
    await sleep(500);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  });
