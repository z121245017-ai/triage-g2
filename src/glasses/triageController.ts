import {
  AudioInputSource,
  ImageRawDataUpdate,
  OsEventTypeList,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import type {
  ActionProposal,
  ActionReceipt,
  TriageItem,
  TriageState,
  TriageView,
  WorkActionKind,
  WorkspaceBridgeSettings,
} from '../types';
import {
  applyProposalToState,
  buildActionProposal,
  computeTriageMetrics,
  createInitialTriageState,
  dispatchOptionalWorkspaceBridge,
  getActiveItems,
  requestOptionalAiDraft,
} from '../services/triageEngine';
import { parseWorkVoiceCommand } from '../services/voiceIntent';
import { renderTriageGaugePng, renderVoiceWaveformPng } from '../render/microLedWidgets';
import {
  TRIAGE_MENU_IDS,
  WORK_VOICE_PRESETS,
  buildTriagePageSpec,
  toRebuildPayload,
  toStartUpPayload,
  type TriagePageSpec,
} from './pageBuilders';

const STORAGE_KEY = 'triage_g2_state_v1';

export interface TriageSnapshot {
  runtimeMode: 'even_bridge' | 'browser_preview';
  view: TriageView;
  focusedItemId: string | null;
  selectedIndex: number;
  state: TriageState;
  activeProposal: ActionProposal | null;
  lastReceipt: ActionReceipt | null;
  canUndo: boolean;
  statusBanner: string;
  voiceListening: boolean;
  voiceTranscript: string;
  voiceParsedLabel: string;
  currentPage: TriagePageSpec | null;
  currentImagePng: Uint8Array | null;
  eventLog: string[];
}

export type SimInputAction =
  | 'up'
  | 'down'
  | 'click'
  | 'double_click'
  | 'long_press'
  | 'long_press_release'
  | 'context_menu';

function hasNativeFlutterBridge(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(
    w.flutter_inappwebview ||
      w._evenAppBridge ||
      w.EvenAppBridgeNative ||
      navigator.userAgent.includes('EvenHub'),
  );
}

export class TriageController {
  private bridge: EvenAppBridge | null = null;
  private startupCreated = false;
  private runtimeMode: 'even_bridge' | 'browser_preview' = 'browser_preview';

  private view: TriageView = 'radar';
  private state: TriageState = createInitialTriageState();
  private focusedIndex = 0;
  private selectedIndex = 0;
  private activeProposal: ActionProposal | null = null;
  private lastReceipt: ActionReceipt | null = null;
  private undoStack: TriageState[] = [];
  private statusBanner = '';
  private voiceListening = false;
  private voiceTranscript = '';
  private voiceParsedLabel = '';
  private voiceLevels: number[] = Array.from({ length: 24 }, (_, i) => 0.16 + (i % 4) * 0.1);
  private currentPage: TriagePageSpec | null = null;
  private currentImagePng: Uint8Array | null = null;
  private eventLog: string[] = [];

  private listeners = new Set<(snap: TriageSnapshot) => void>();
  private renderInFlight = false;
  private renderPending = false;

  subscribe(fn: (snap: TriageSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  private getFocusedItem(): TriageItem | undefined {
    const active = getActiveItems(this.state);
    return active[this.focusedIndex] ?? active[0];
  }

  getSnapshot(): TriageSnapshot {
    return {
      runtimeMode: this.runtimeMode,
      view: this.view,
      focusedItemId: this.getFocusedItem()?.id ?? null,
      selectedIndex: this.selectedIndex,
      state: this.state,
      activeProposal: this.activeProposal,
      lastReceipt: this.lastReceipt,
      canUndo: this.undoStack.length > 0,
      statusBanner: this.statusBanner,
      voiceListening: this.voiceListening,
      voiceTranscript: this.voiceTranscript,
      voiceParsedLabel: this.voiceParsedLabel,
      currentPage: this.currentPage,
      currentImagePng: this.currentImagePng,
      eventLog: this.eventLog.slice(0, 14),
    };
  }

  private log(msg: string): void {
    const ts = new Date().toTimeString().slice(0, 8);
    this.eventLog = [`[${ts}] ${msg}`, ...this.eventLog].slice(0, 20);
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }

  async init(): Promise<void> {
    const fresh = new URLSearchParams(window.location.search).get('fresh') === '1';
    if (!fresh) this.loadLocal();
    this.log('Booting TriageG2 Executive HUD...');

    try {
      const bridgePromise = waitForEvenAppBridge();
      const timeoutMs = hasNativeFlutterBridge() ? 2800 : 350;
      const bridge = await Promise.race<EvenAppBridge | null>([
        bridgePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (bridge && (await this.attachBridge(bridge, fresh))) {
        this.runtimeMode = 'even_bridge';
        this.log('Connected to Even Hub SDK bridge (0.0.16)');
      }
    } catch (err) {
      this.log(`Standalone browser preview mode (${String(err).slice(0, 48)})`);
    }

    await this.renderFullPage(true);
  }

  private async attachBridge(bridge: EvenAppBridge, skipRestore: boolean): Promise<boolean> {
    this.bridge = bridge;
    try {
      const saved = await bridge.getLocalStorage(STORAGE_KEY);
      if (saved && !skipRestore) this.restoreJson(saved);
    } catch {
      if (!hasNativeFlutterBridge()) {
        this.bridge = null;
        return false;
      }
    }

    bridge.onLaunchSource((src) => {
      this.log(`Launch source: ${src}`);
      this.emit();
    });
    bridge.onEvenHubEvent((event) => {
      void this.handleBridgeEvent(event);
    });
    return true;
  }

  private loadLocal(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) this.restoreJson(raw);
    } catch {
      // ignore
    }
  }

  private restoreJson(raw: string): void {
    try {
      const p = JSON.parse(raw) as Partial<TriageState>;
      if (Array.isArray(p.items)) {
        this.state = {
          ...this.state,
          ...p,
          settings: { ...this.state.settings, ...(p.settings ?? {}) },
        };
      }
    } catch {
      // ignore
    }
  }

  private persist(): void {
    const json = JSON.stringify(this.state);
    try {
      window.localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // ignore
    }
    if (this.bridge) {
      void this.bridge.setLocalStorage(STORAGE_KEY, json).catch(() => undefined);
    }
  }

  private composeSpec(): TriagePageSpec {
    return buildTriagePageSpec({
      view: this.view,
      state: this.state,
      focusedItem: this.getFocusedItem(),
      activeProposal: this.activeProposal,
      lastReceipt: this.lastReceipt,
      canUndo: this.undoStack.length > 0,
      statusBanner: this.statusBanner,
      voiceListening: this.voiceListening,
      voiceTranscript: this.voiceTranscript,
      voiceParsedLabel: this.voiceParsedLabel,
    });
  }

  private async renderFullPage(isBoot: boolean): Promise<void> {
    if (this.renderInFlight) {
      this.renderPending = true;
      return;
    }
    this.renderInFlight = true;
    try {
      const spec = this.composeSpec();
      this.currentPage = spec;

      if (this.bridge) {
        try {
          if (!this.startupCreated || isBoot) {
            const res = await this.bridge.createStartUpPageContainer(toStartUpPayload(spec));
            if (res === StartUpPageCreateResult.success) {
              this.startupCreated = true;
              this.runtimeMode = 'even_bridge';
            }
          } else {
            await this.bridge.rebuildPageContainer(toRebuildPayload(spec));
          }
        } catch (err) {
          if (!this.startupCreated) {
            this.bridge = null;
            this.runtimeMode = 'browser_preview';
          }
          this.log(`Bridge fallback: ${String(err).slice(0, 50)}`);
        }
      }

      await this.pushImage(spec);
      this.emit();
    } finally {
      this.renderInFlight = false;
      if (this.renderPending) {
        this.renderPending = false;
        void this.renderFullPage(false);
      }
    }
  }

  private async pushImage(spec: TriagePageSpec): Promise<void> {
    const target = spec.imageContainerTarget;
    if (!target) {
      this.currentImagePng = null;
      return;
    }

    let png: Uint8Array;
    if (spec.view === 'voice') {
      png = renderVoiceWaveformPng({
        width: target.width,
        height: target.height,
        levels: this.voiceLevels,
        active: this.voiceListening,
      });
    } else {
      const active = getActiveItems(this.state);
      const metrics = computeTriageMetrics(this.state);
      png = renderTriageGaugePng({
        width: target.width,
        height: target.height,
        clearRatio: metrics.clearRatio,
        calCount: active.filter((i) => i.source === 'calendar').length,
        mailCount: metrics.unreadMailCount,
        notionCount: metrics.openNotionCount,
        totalItems: this.state.totalSessionItems,
      });
    }
    this.currentImagePng = png;

    if (this.bridge && this.startupCreated) {
      await this.bridge
        .updateImageRawData(
          new ImageRawDataUpdate({
            containerID: target.containerID,
            containerName: target.containerName,
            imageData: Array.from(png),
          }),
        )
        .catch(() => undefined);
    }
  }

  async handleBridgeEvent(event: EvenHubEvent): Promise<void> {
    if (event.audioEvent) {
      this.handleAudioFrame(event.audioEvent.audioPcm);
      return;
    }
    if (event.menuItemClickEvent?.itemID) {
      await this.handleMenuId(event.menuItemClickEvent.itemID);
      return;
    }
    if (event.sysEvent) {
      const et = event.sysEvent.eventType;
      if (et === OsEventTypeList.LONG_PRESS_EVENT) {
        await this.startVoiceCapture();
        return;
      }
      if (et === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
        await this.stopVoiceCapture();
        return;
      }
      if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        await this.navigateBack();
        return;
      }
    }
    if (event.listEvent) {
      const idx = event.listEvent.currentSelectItemIndex ?? this.selectedIndex;
      const et = event.listEvent.eventType;
      if (et === OsEventTypeList.LONG_PRESS_EVENT) {
        await this.startVoiceCapture();
        return;
      }
      if (et === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
        await this.stopVoiceCapture();
        return;
      }
      if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        await this.navigateBack();
        return;
      }
      if (et === OsEventTypeList.SCROLL_TOP_EVENT || et === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        this.selectedIndex = idx;
        if (this.view === 'radar') {
          this.focusedIndex = idx;
          await this.renderFullPage(false);
        } else {
          this.emit();
        }
        return;
      }
      if (et === undefined || et === OsEventTypeList.CLICK_EVENT) {
        this.selectedIndex = idx;
        await this.activateIndex(idx);
      }
    }
  }

  async simulateInput(action: SimInputAction): Promise<void> {
    const count = this.currentPage?.listObject[0]?.itemContainer?.itemCount ?? 1;
    if (action === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      if (this.view === 'radar') {
        this.focusedIndex = this.selectedIndex;
        await this.renderFullPage(false);
      } else {
        this.emit();
      }
      return;
    }
    if (action === 'down') {
      this.selectedIndex = Math.min(Math.max(0, count - 1), this.selectedIndex + 1);
      if (this.view === 'radar') {
        this.focusedIndex = this.selectedIndex;
        await this.renderFullPage(false);
      } else {
        this.emit();
      }
      return;
    }
    if (action === 'click') {
      await this.activateIndex(this.selectedIndex);
      return;
    }
    if (action === 'double_click') {
      await this.navigateBack();
      return;
    }
    if (action === 'long_press') {
      await this.startVoiceCapture();
      return;
    }
    if (action === 'long_press_release') {
      await this.stopVoiceCapture();
      return;
    }
    if (action === 'context_menu') {
      await this.handleMenuId(TRIAGE_MENU_IDS.MOVE_MEETING_30M);
    }
  }

  async handleMenuId(itemID: number): Promise<void> {
    if (itemID === TRIAGE_MENU_IDS.MOVE_MEETING_30M) {
      await this.openProposal('MOVE_MEETING_30M', undefined, undefined, undefined, 'menu');
    } else if (itemID === TRIAGE_MENU_IDS.SAVE_DRAFT_TOP_MAIL) {
      const mail = getActiveItems(this.state).find((i) => i.source === 'gmail');
      await this.openProposal('SAVE_GMAIL_DRAFT', mail?.id, mail?.aiDraft, undefined, 'menu');
    } else if (itemID === TRIAGE_MENU_IDS.ADD_NOTION_VOICE) {
      await this.openProposal('CREATE_NOTION_TASK', undefined, 'Follow up on G2 launch notes', 'Tomorrow', 'menu');
    } else if (itemID === TRIAGE_MENU_IDS.OPEN_VOICE_HUD) {
      this.view = 'voice';
      this.selectedIndex = 0;
      await this.renderFullPage(false);
    } else if (itemID === TRIAGE_MENU_IDS.UNDO_LAST) {
      await this.undoLastAction();
    } else if (itemID === TRIAGE_MENU_IDS.RESET_DEMO) {
      await this.resetDemo();
    }
  }

  private async activateIndex(idx: number): Promise<void> {
    if (this.view === 'radar') {
      const active = getActiveItems(this.state);
      if (active.length === 0) {
        await this.resetDemo();
        return;
      }
      this.focusedIndex = Math.max(0, Math.min(active.length - 1, idx));
      this.view = 'detail';
      this.selectedIndex = 0;
      this.statusBanner = '';
      const focused = this.getFocusedItem();
      this.log(`Opened brief: ${focused?.title ?? ''}`);
      await this.renderFullPage(false);

      // Optional live OpenRouter AI draft enhancement in background
      if (focused && this.state.settings.useOpenRouter) {
        const ai = await requestOptionalAiDraft(focused, this.state.settings);
        if (ai) {
          this.state = {
            ...this.state,
            items: this.state.items.map((it) =>
              it.id === focused.id ? { ...it, aiDraft: ai } : it,
            ),
          };
          this.emit();
        }
      }
      return;
    }

    if (this.view === 'detail') {
      const item = this.getFocusedItem();
      if (!item) {
        await this.navigateBack();
        return;
      }
      if (item.source === 'calendar') {
        if (idx === 0) await this.openProposal('MOVE_MEETING_30M', item.id, undefined, undefined, 'glasses');
        else if (idx === 1) await this.openProposal('PING_LATE_5M', item.id, item.aiDraft, undefined, 'glasses');
        else if (idx === 2) await this.openProposal('CREATE_NOTION_TASK', item.id, `Prep: ${item.title}`, 'Today', 'glasses');
        else if (idx === 3) await this.openProposal('ARCHIVE_ITEM', item.id, undefined, undefined, 'glasses');
        else await this.navigateBack();
      } else if (item.source === 'gmail') {
        if (idx === 0) await this.openProposal('SAVE_GMAIL_DRAFT', item.id, item.aiDraft, undefined, 'glasses');
        else if (idx === 1) await this.openProposal('SEND_GMAIL_REPLY', item.id, item.aiDraft, undefined, 'glasses');
        else if (idx === 2) await this.openProposal('CREATE_NOTION_TASK', item.id, `Follow up: ${item.title}`, 'Tomorrow', 'glasses');
        else if (idx === 3) await this.openProposal('ARCHIVE_ITEM', item.id, undefined, undefined, 'glasses');
        else await this.navigateBack();
      } else {
        if (idx === 0) await this.openProposal('COMPLETE_NOTION_TASK', item.id, undefined, undefined, 'glasses');
        else if (idx === 1) await this.openProposal('SNOOZE_ITEM', item.id, undefined, undefined, 'glasses');
        else if (idx === 2) {
          this.view = 'voice';
          this.selectedIndex = 0;
          await this.renderFullPage(false);
        } else await this.navigateBack();
      }
      return;
    }

    if (this.view === 'confirm') {
      if (idx === 0) {
        this.activeProposal = null;
        this.view = 'radar';
        this.focusedIndex = 0;
        this.selectedIndex = 0;
        this.statusBanner = 'Cancelled safely (Default NO).';
        this.log('Safety gate: cancelled safely');
        await this.renderFullPage(false);
      } else if (idx === 1 && this.activeProposal) {
        await this.commitActiveProposal();
      }
      return;
    }

    if (this.view === 'receipt') {
      if (idx === 1 && this.undoStack.length > 0) {
        await this.undoLastAction();
      } else {
        this.view = 'radar';
        this.focusedIndex = 0;
        this.selectedIndex = 0;
        await this.renderFullPage(false);
      }
      return;
    }

    if (this.view === 'voice') {
      if (idx >= 0 && idx < WORK_VOICE_PRESETS.length) {
        await this.submitVoiceText(WORK_VOICE_PRESETS[idx]);
      } else {
        await this.navigateBack();
      }
    }
  }

  async openProposal(
    kind: WorkActionKind,
    itemId?: string,
    customText?: string,
    dueLabel?: string,
    source: ActionProposal['source'] = 'glasses',
  ): Promise<void> {
    const built = buildActionProposal({
      kind,
      state: this.state,
      itemId,
      customText,
      dueLabel,
      source,
    });
    if ('error' in built) {
      this.statusBanner = built.error;
      this.log(`Notice: ${built.error}`);
      await this.renderFullPage(false);
      return;
    }
    this.activeProposal = built;
    this.view = 'confirm';
    this.selectedIndex = 0; // ALWAYS default to [ NO ] safe choice!
    this.log(`Safety Gate: ${built.title} (Default NO)`);
    await this.renderFullPage(false);
  }

  async commitActiveProposal(): Promise<void> {
    const proposal = this.activeProposal;
    if (!proposal) return;
    if (Date.now() > proposal.expiresAt) {
      this.activeProposal = null;
      this.view = 'radar';
      this.focusedIndex = 0;
      this.selectedIndex = 0;
      this.statusBanner = 'Proposal expired (45s safety TTL).';
      await this.renderFullPage(false);
      return;
    }

    const meta = await dispatchOptionalWorkspaceBridge(proposal, this.state.settings);
    const { nextState, receipt, undoSnapshot } = applyProposalToState(
      this.state,
      proposal,
      meta,
    );
    this.undoStack = [undoSnapshot, ...this.undoStack].slice(0, 10);
    this.state = nextState;
    this.activeProposal = null;
    this.lastReceipt = receipt;
    this.view = 'receipt';
    this.selectedIndex = 0;
    this.statusBanner = receipt.headline;
    this.log(`Committed ${receipt.id}: ${receipt.headline}`);
    this.persist();
    await this.renderFullPage(false);
  }

  async undoLastAction(): Promise<void> {
    const prev = this.undoStack.shift();
    if (!prev) {
      this.statusBanner = 'Nothing to undo.';
      await this.renderFullPage(false);
      return;
    }
    this.state = prev;
    this.lastReceipt = null;
    this.view = 'radar';
    this.focusedIndex = 0;
    this.selectedIndex = 0;
    this.statusBanner = 'Undid last action cleanly.';
    this.log('Reverted last action via Undo stack');
    this.persist();
    await this.renderFullPage(false);
  }

  async navigateBack(): Promise<void> {
    if (this.voiceListening) await this.stopVoiceCapture();
    this.activeProposal = null;
    if (this.view !== 'radar') {
      this.view = 'radar';
      this.focusedIndex = 0;
      this.selectedIndex = 0;
      await this.renderFullPage(false);
    }
  }

  async startVoiceCapture(): Promise<void> {
    this.view = 'voice';
    this.voiceListening = true;
    this.selectedIndex = 0;
    this.voiceTranscript = 'G2 mic active';
    this.voiceParsedLabel = 'Default-NO';
    this.log('Long-press start -> G2 MIC opened (16kHz PCM)');
    if (this.bridge) {
      await this.bridge.audioControl(true, AudioInputSource.Glasses).catch(() => undefined);
    }
    await this.renderFullPage(false);
  }

  async stopVoiceCapture(): Promise<void> {
    this.voiceListening = false;
    this.log('Long-press release -> G2 MIC closed');
    if (this.bridge) {
      await this.bridge.audioControl(false).catch(() => undefined);
    }
    if (this.voiceTranscript === 'G2 mic active') {
      this.voiceTranscript = 'Pick command';
    }
    await this.renderFullPage(false);
  }

  private handleAudioFrame(pcm: Uint8Array): void {
    if (!pcm || pcm.length < 2) return;
    let sumSq = 0;
    const samples = Math.floor(pcm.length / 2);
    const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < samples; i += 1) {
      const s = dv.getInt16(i * 2, true) / 32768;
      sumSq += s * s;
    }
    const rms = Math.min(1, Math.sqrt(sumSq / Math.max(1, samples)) * 4.5);
    this.voiceLevels = [...this.voiceLevels.slice(1), Math.max(0.08, rms)];
    if (this.view === 'voice' && this.currentPage) {
      void this.pushImage(this.currentPage);
      this.emit();
    }
  }

  async submitVoiceText(phrase: string): Promise<void> {
    const active = getActiveItems(this.state);
    const parsed = parseWorkVoiceCommand(phrase, active, this.getFocusedItem());
    this.voiceTranscript = phrase;
    this.voiceParsedLabel = parsed.label;
    this.log(`Voice: "${phrase}" -> ${parsed.label}`);

    if (parsed.kind === 'UNDO') {
      await this.undoLastAction();
      return;
    }
    if (parsed.kind === 'BRIEF') {
      this.focusedIndex = 0;
      this.view = 'detail';
      this.selectedIndex = 0;
      await this.renderFullPage(false);
      return;
    }
    if (parsed.kind === 'PROPOSAL' && parsed.actionKind) {
      await this.openProposal(
        parsed.actionKind,
        parsed.itemId,
        parsed.customText,
        parsed.dueLabel,
        'voice',
      );
      return;
    }
    await this.renderFullPage(false);
  }

  updateSettings(patch: Partial<WorkspaceBridgeSettings>): void {
    this.state = {
      ...this.state,
      settings: { ...this.state.settings, ...patch },
    };
    this.persist();
    this.log('Updated workspace bridge settings');
    void this.renderFullPage(false);
  }

  async resetDemo(): Promise<void> {
    this.state = {
      ...createInitialTriageState(),
      settings: this.state.settings,
    };
    this.undoStack = [];
    this.activeProposal = null;
    this.lastReceipt = null;
    this.view = 'radar';
    this.focusedIndex = 0;
    this.selectedIndex = 0;
    this.statusBanner = '30-second demo session reset.';
    this.log('Demo session reset');
    this.persist();
    await this.renderFullPage(false);
  }
}
