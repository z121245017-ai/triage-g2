import { TriageController, type TriageSnapshot } from '../glasses/triageController';
import { TRIAGE_MENU_IDS, WORK_VOICE_PRESETS } from '../glasses/pageBuilders';
import { computeTriageMetrics, getActiveItems } from '../services/triageEngine';
import { drawG2EmulatorCanvas } from './browserEmulator';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function mountCompanionApp(root: HTMLElement, controller: TriageController): void {
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="dot"></span>
          <div>
            <h1>TriageG2</h1>
            <p class="sub">30-Second Hands-Free Executive HUD · Calendar · Gmail · Notion · Claude/OpenRouter</p>
          </div>
        </div>
        <div class="badges" id="status-badges"></div>
      </header>

      <section class="g2-stage">
        <div class="stage-head">
          <span class="pill" id="runtime-pill">LIVE 576×288 G2 PREVIEW</span>
          <span class="hint-text" id="view-pill">VIEW: RADAR</span>
        </div>
        <div class="lens-frame">
          <canvas id="g2-canvas" width="576" height="288"></canvas>
        </div>
        <div class="ring-controls">
          <button data-sim="up" class="btn">▲ Ring Up</button>
          <button data-sim="down" class="btn">▼ Ring Down</button>
          <button data-sim="click" class="btn btn-primary">● Tap / Open</button>
          <button data-sim="double_click" class="btn">●● Double-Tap (Back)</button>
          <button id="btn-ptt" class="btn btn-accent">🎙 Hold Voice</button>
          <button data-menu="${TRIAGE_MENU_IDS.MOVE_MEETING_30M}" class="btn">⏱ Shift Sync +30m</button>
        </div>
      </section>

      <main class="grid">
        <section class="card">
          <div class="card-head">
            <h2>Active Executive Stream</h2>
            <button id="btn-reset" class="btn btn-sm">Reset 30s Demo</button>
          </div>
          <div id="stream-list"></div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Voice Intent & Quick Commands</h2>
            <span class="mini">Every write passes Default-NO Safety Gate</span>
          </div>
          <form id="voice-form" class="voice-row">
            <input id="voice-input" type="text" placeholder='Try: "Move next meeting by 30 minutes" or "Add Notion task..."' />
            <button type="submit" class="btn btn-primary">Parse</button>
          </form>
          <div class="chip-row">
            ${WORK_VOICE_PRESETS.map(
              (c) => `<button type="button" class="chip" data-voice="${esc(c)}">${esc(c)}</button>`,
            ).join('')}
          </div>
          <div class="summary-grid" id="metrics-box"></div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Optional Live Workspace Bridge</h2>
            <button id="btn-undo" class="btn btn-sm">↺ Undo Last</button>
          </div>
          <p class="note">
            Zero-key standalone judge sandbox by default. Run <code>npm run server</code> to connect real <strong>OpenRouter/Claude</strong>, <strong>Notion API</strong>, and <strong>Google Workspace (Gmail Drafts & Calendar)</strong> without exposing keys or OAuth inside WebView.
          </p>
          <div class="settings-grid">
            <label>
              <span>Local Bridge URL</span>
              <input id="cfg-url" type="text" />
            </label>
            <label>
              <span>OpenRouter / Claude Model</span>
              <input id="cfg-model" type="text" />
            </label>
            <label class="toggle"><input id="cfg-ai" type="checkbox" /><span>Live OpenRouter / Claude AI drafts</span></label>
            <label class="toggle"><input id="cfg-notion" type="checkbox" /><span>Sync tasks to Notion Database API</span></label>
            <label class="toggle"><input id="cfg-gws" type="checkbox" /><span>Sync Gmail Drafts & Google Calendar</span></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Committed Receipts & Hardware Trace</h2>
            <span class="mini">Before → After proof + Undo</span>
          </div>
          <div id="receipts-box"></div>
          <div id="trace-box" class="trace-box"></div>
        </section>
      </main>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('#g2-canvas')!;
  const badgesEl = root.querySelector<HTMLElement>('#status-badges')!;
  const runtimePill = root.querySelector<HTMLElement>('#runtime-pill')!;
  const viewPill = root.querySelector<HTMLElement>('#view-pill')!;
  const streamEl = root.querySelector<HTMLElement>('#stream-list')!;
  const metricsEl = root.querySelector<HTMLElement>('#metrics-box')!;
  const receiptsEl = root.querySelector<HTMLElement>('#receipts-box')!;
  const traceEl = root.querySelector<HTMLElement>('#trace-box')!;

  const cfgUrl = root.querySelector<HTMLInputElement>('#cfg-url')!;
  const cfgModel = root.querySelector<HTMLInputElement>('#cfg-model')!;
  const cfgAi = root.querySelector<HTMLInputElement>('#cfg-ai')!;
  const cfgNotion = root.querySelector<HTMLInputElement>('#cfg-notion')!;
  const cfgGws = root.querySelector<HTMLInputElement>('#cfg-gws')!;

  root.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach((b) => {
    b.addEventListener('click', () => {
      void controller.simulateInput(b.dataset.sim as Parameters<TriageController['simulateInput']>[0]);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((b) => {
    b.addEventListener('click', () => void controller.handleMenuId(Number(b.dataset.menu)));
  });

  const ptt = root.querySelector<HTMLButtonElement>('#btn-ptt')!;
  ptt.addEventListener('mousedown', () => void controller.simulateInput('long_press'));
  ptt.addEventListener('mouseup', () => void controller.simulateInput('long_press_release'));
  ptt.addEventListener('click', () => {
    if (!controller.getSnapshot().voiceListening) {
      void controller.handleMenuId(TRIAGE_MENU_IDS.OPEN_VOICE_HUD);
    }
  });

  root.querySelector('#btn-reset')!.addEventListener('click', () => void controller.resetDemo());
  root.querySelector('#btn-undo')!.addEventListener('click', () => void controller.undoLastAction());

  const voiceForm = root.querySelector<HTMLFormElement>('#voice-form')!;
  const voiceInput = root.querySelector<HTMLInputElement>('#voice-input')!;
  voiceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = voiceInput.value.trim();
    if (!t) return;
    voiceInput.value = '';
    void controller.submitVoiceText(t);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-voice]').forEach((chip) => {
    chip.addEventListener('click', () => void controller.submitVoiceText(chip.dataset.voice || ''));
  });

  const syncCfg = () => {
    controller.updateSettings({
      bridgeUrl: cfgUrl.value.trim() || 'http://127.0.0.1:8788',
      aiModel: cfgModel.value.trim() || 'anthropic/claude-3.5-haiku',
      useOpenRouter: cfgAi.checked,
      useNotionBridge: cfgNotion.checked,
      useGoogleBridge: cfgGws.checked,
    });
  };
  cfgUrl.addEventListener('change', syncCfg);
  cfgModel.addEventListener('change', syncCfg);
  cfgAi.addEventListener('change', syncCfg);
  cfgNotion.addEventListener('change', syncCfg);
  cfgGws.addEventListener('change', syncCfg);

  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (e.key === 'ArrowUp') { e.preventDefault(); void controller.simulateInput('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); void controller.simulateInput('down'); }
    if (e.key === 'Enter') { e.preventDefault(); void controller.simulateInput('click'); }
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); void controller.simulateInput('double_click'); }
  });

  const render = (snap: TriageSnapshot) => {
    drawG2EmulatorCanvas(canvas, snap);
    const m = computeTriageMetrics(snap.state);
    const active = getActiveItems(snap.state);

    runtimePill.textContent =
      snap.runtimeMode === 'even_bridge'
        ? 'EVEN HUB BRIDGE ACTIVE (G2 / SIMULATOR)'
        : 'STANDALONE BROWSER G2 EMULATOR (576×288)';
    viewPill.textContent = `VIEW: ${snap.view.toUpperCase()} · CLEARED: ${m.clearedCount}/${snap.state.totalSessionItems}`;

    badgesEl.innerHTML = `
      <span class="badge ok">${m.clearedCount}/${snap.state.totalSessionItems} Cleared</span>
      <span class="badge">${m.unreadMailCount} Gmail · ${m.openNotionCount} Notion</span>
      <span class="badge">${snap.state.settings.useOpenRouter ? 'Live OpenRouter' : 'Zero-Key Sandbox'}</span>
    `;

    streamEl.innerHTML = active.length
      ? active
          .map(
            (it) => `<div class="stream-row ${it.id === snap.focusedItemId ? 'active-row' : ''}">
              <div><strong>[${esc(it.tag)}] ${esc(it.title)}</strong><div class="mini">${esc(it.senderOrHost)} · ${esc(it.timeLabel)}</div></div>
              <span class="mini">${esc(it.source.toUpperCase())}</span>
            </div>`,
          )
          .join('')
      : '<p class="ok-msg">Inbox Zero achieved in hands-free mode!</p>';

    metricsEl.innerHTML = `
      <div class="stat"><span>Next Meeting</span><strong>${esc(m.nextMeetingLabel.slice(0, 22))}</strong></div>
      <div class="stat"><span>Inbox Clear %</span><strong>${Math.round(m.clearRatio * 100)}%</strong></div>
      <div class="stat"><span>Unread Gmail</span><strong>${m.unreadMailCount}</strong></div>
      <div class="stat"><span>Open Notion</span><strong>${m.openNotionCount}</strong></div>
    `;

    if (document.activeElement !== cfgUrl) cfgUrl.value = snap.state.settings.bridgeUrl;
    if (document.activeElement !== cfgModel) cfgModel.value = snap.state.settings.aiModel;
    cfgAi.checked = snap.state.settings.useOpenRouter;
    cfgNotion.checked = snap.state.settings.useNotionBridge;
    cfgGws.checked = snap.state.settings.useGoogleBridge;

    receiptsEl.innerHTML = snap.state.receipts.length
      ? snap.state.receipts
          .slice(0, 5)
          .map(
            (r) => `<div class="log-item">
              <strong>${esc(r.id)} · ${esc(r.headline)}</strong>
              <div>${esc(r.beforeSummary)} → ${esc(r.afterSummary)}</div>
            </div>`,
          )
          .join('')
      : '<p class="mini">No commits yet. Tap an item or click "Shift Sync +30m" above.</p>';

    traceEl.innerHTML = snap.eventLog
      .map((line) => `<div class="trace-line">${esc(line)}</div>`)
      .join('');
  };

  controller.subscribe(render);
}
