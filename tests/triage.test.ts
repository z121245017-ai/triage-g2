import { describe, expect, it } from 'vitest';
import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import {
  applyProposalToState,
  buildActionProposal,
  computeTriageMetrics,
  createInitialTriageState,
  getActiveItems,
} from '../src/services/triageEngine';
import { parseWorkVoiceCommand } from '../src/services/voiceIntent';
import { renderTriageGaugePng, renderVoiceWaveformPng } from '../src/render/microLedWidgets';
import {
  buildTriagePageSpec,
  toRebuildPayload,
  toStartUpPayload,
} from '../src/glasses/pageBuilders';

const encoder = new TextEncoder();

describe('TriageG2 — 30-Second AI Work HUD & Even Hub SDK Safety', () => {
  it('shifts next calendar meeting by +30m cleanly and produces undoable receipt', () => {
    const state = createInitialTriageState();
    const prop = buildActionProposal({
      kind: 'MOVE_MEETING_30M',
      state,
      itemId: 'cal-q4-sync',
      source: 'glasses',
      now: 1_700_000_000_000,
    });
    expect('error' in prop).toBe(false);
    if ('error' in prop) return;

    expect(prop.targetApp).toBe('Google Calendar');
    expect(prop.afterSummary).toContain('15:30-16:00');
    const { nextState, receipt, undoSnapshot } = applyProposalToState(state, prop);
    const shifted = nextState.items.find((i) => i.id === 'cal-q4-sync')!;
    expect(shifted.timeLabel).toBe('15:30-16:00');
    expect(receipt.undoable).toBe(true);
    expect(undoSnapshot.items.find((i) => i.id === 'cal-q4-sync')!.timeLabel).toBe('15:00-15:30');
  });

  it('saves safe Gmail draft and clears unread counter deterministically', () => {
    const state = createInitialTriageState();
    const before = computeTriageMetrics(state);
    const prop = buildActionProposal({
      kind: 'SAVE_GMAIL_DRAFT',
      state,
      itemId: 'mail-elena-redline',
      source: 'glasses',
    });
    if ('error' in prop) throw new Error(prop.error);

    const { nextState, receipt } = applyProposalToState(state, prop);
    const after = computeTriageMetrics(nextState);
    expect(after.unreadMailCount).toBe(before.unreadMailCount - 1);
    expect(receipt.headline).toContain('GMAIL DRAFT');
  });

  it('creates a structured Notion task from voice capture and increments open count', () => {
    const state = createInitialTriageState();
    const before = computeTriageMetrics(state);
    const prop = buildActionProposal({
      kind: 'CREATE_NOTION_TASK',
      state,
      customText: 'Ship SDK docs',
      dueLabel: 'Friday',
      source: 'voice',
    });
    if ('error' in prop) throw new Error(prop.error);

    const { nextState, receipt } = applyProposalToState(state, prop);
    const after = computeTriageMetrics(nextState);
    expect(after.openNotionCount).toBe(before.openNotionCount + 1);
    expect(receipt.headline).toContain('NOTION TASK CREATED');
  });

  it('parses hands-free work voice commands across Calendar, Gmail, Notion, and Undo', () => {
    const state = createInitialTriageState();
    const active = getActiveItems(state);

    const v1 = parseWorkVoiceCommand('Move next meeting by 30 minutes', active);
    expect(v1.kind).toBe('PROPOSAL');
    expect(v1.actionKind).toBe('MOVE_MEETING_30M');

    const v2 = parseWorkVoiceCommand('Reply to Elena approved sending redline', active);
    expect(v2.kind).toBe('PROPOSAL');
    expect(v2.actionKind).toBe('SEND_GMAIL_REPLY');
    expect(v2.itemId).toBe('mail-elena-redline');

    const v3 = parseWorkVoiceCommand('Add Notion task ship SDK docs by Friday', active);
    expect(v3.kind).toBe('PROPOSAL');
    expect(v3.actionKind).toBe('CREATE_NOTION_TASK');
    expect(v3.dueLabel).toBe('Friday');

    const v4 = parseWorkVoiceCommand('Undo last action', active);
    expect(v4.kind).toBe('UNDO');
  });

  it('renders valid grayscale PNG micro-LED triage gauge and voice waveform buffers', () => {
    const gPng = renderTriageGaugePng({
      width: 266,
      height: 86,
      clearRatio: 0.4,
      calCount: 1,
      mailCount: 3,
      notionCount: 1,
      totalItems: 5,
    });
    expect(Array.from(gPng.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const wPng = renderVoiceWaveformPng({
      width: 256,
      height: 96,
      levels: Array.from({ length: 24 }, () => 0.55),
      active: true,
    });
    expect(Array.from(wPng.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it('enforces all EvenHub SDK 0.0.16 firmware invariants & Default-NO gate across all 5 views', () => {
    const state = createInitialTriageState();
    const prop = buildActionProposal({
      kind: 'MOVE_MEETING_30M',
      state,
      itemId: 'cal-q4-sync',
      source: 'glasses',
    });
    if ('error' in prop) throw new Error(prop.error);
    const { receipt } = applyProposalToState(state, prop);

    const views = ['radar', 'detail', 'confirm', 'receipt', 'voice'] as const;
    for (const view of views) {
      const spec = buildTriagePageSpec({
        view,
        state,
        focusedItem: state.items[0],
        activeProposal: prop,
        lastReceipt: receipt,
        canUndo: true,
        statusBanner: '',
        voiceListening: view === 'voice',
        voiceTranscript: 'G2 mic active',
        voiceParsedLabel: 'Default-NO',
      });
      const payload = view === 'radar' ? toStartUpPayload(spec) : toRebuildPayload(spec);
      expect(validateEvenHubPageContainer(payload).valid).toBe(true);

      const captures =
        spec.listObject.filter((l) => l.isEventCapture === 1).length +
        spec.textObject.filter((t) => t.isEventCapture === 1).length;
      expect(captures).toBe(1);

      for (const im of spec.imageObject) {
        expect(im.width!).toBeGreaterThanOrEqual(20);
        expect(im.width!).toBeLessThanOrEqual(288);
        expect(im.height!).toBeGreaterThanOrEqual(20);
        expect(im.height!).toBeLessThanOrEqual(144);
      }

      for (const l of spec.listObject) {
        for (const name of l.itemContainer?.itemName ?? []) {
          expect(encoder.encode(name).length).toBeLessThanOrEqual(63);
        }
      }
      for (const t of spec.textObject) {
        expect(encoder.encode(t.content ?? '').length).toBeLessThanOrEqual(999);
      }

      if (view === 'confirm') {
        expect((spec.listObject[0].itemContainer?.itemName?.[0] ?? '').toUpperCase()).toContain('NO');
      }
    }
  });
});
