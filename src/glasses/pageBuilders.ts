import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  RebuildPageContainer,
  TextContainerProperty,
  validateEvenHubPageContainer,
} from '@evenrealities/even_hub_sdk';
import type {
  ActionProposal,
  ActionReceipt,
  TriageItem,
  TriageState,
  TriageView,
} from '../types';
import { computeTriageMetrics, getActiveItems } from '../services/triageEngine';

const encoder = new TextEncoder();

export function clampUtf8(input: string, maxBytes: number): string {
  if (encoder.encode(input).length <= maxBytes) return input;
  let out = '';
  for (const ch of input) {
    if (encoder.encode(out + ch).length > maxBytes - 1) break;
    out += ch;
  }
  return `${out}~`;
}

export const TRIAGE_MENU_IDS = {
  MOVE_MEETING_30M: 1,
  SAVE_DRAFT_TOP_MAIL: 2,
  ADD_NOTION_VOICE: 3,
  OPEN_VOICE_HUD: 4,
  UNDO_LAST: 5,
  RESET_DEMO: 6,
} as const;

export function buildContextMenu(): MenuContainerProperty {
  return new MenuContainerProperty({
    menuItems: [
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.MOVE_MEETING_30M, itemName: clampUtf8('Move Meeting +30m', 32) }),
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.SAVE_DRAFT_TOP_MAIL, itemName: clampUtf8('Save AI Gmail Draft', 32) }),
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.ADD_NOTION_VOICE, itemName: clampUtf8('New Notion Task', 32) }),
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.OPEN_VOICE_HUD, itemName: clampUtf8('Voice Capture (PTT)', 32) }),
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.UNDO_LAST, itemName: clampUtf8('Undo Last Action', 32) }),
      new MenuItemProperty({ itemID: TRIAGE_MENU_IDS.RESET_DEMO, itemName: clampUtf8('Reset 30s Demo', 32) }),
    ],
  });
}

export const WORK_VOICE_PRESETS = [
  'Move next meeting by 30 minutes',
  'Reply to Elena approved sending redline',
  'Add Notion task ship SDK docs by Friday',
  'Save draft to DevOps investigating now',
] as const;

export interface TriagePageSpec {
  view: TriageView;
  listObject: ListContainerProperty[];
  textObject: TextContainerProperty[];
  imageObject: ImageContainerProperty[];
  menuObject?: MenuContainerProperty;
  imageContainerTarget?: { containerID: number; containerName: string; width: number; height: number };
}

export function buildDetailActionItems(item: TriageItem): string[] {
  if (item.source === 'calendar') {
    return [
      clampUtf8('> Move Meeting +30m', 60),
      clampUtf8('> Ping "Running 5m"', 60),
      clampUtf8('> Capture Notion Task', 60),
      clampUtf8('> Mark Sync Prepped', 60),
      clampUtf8('< Back to Radar', 60),
    ];
  }
  if (item.source === 'gmail') {
    return [
      clampUtf8('> Save Gmail Draft', 60),
      clampUtf8('> Send AI Reply', 60),
      clampUtf8('> Add to Notion Tasks', 60),
      clampUtf8('> Archive & Next', 60),
      clampUtf8('< Back to Radar', 60),
    ];
  }
  return [
    clampUtf8('> Mark Task Done', 60),
    clampUtf8('> Snooze to Tomorrow', 60),
    clampUtf8('> Add Subtask (Voice)', 60),
    clampUtf8('< Back to Radar', 60),
  ];
}

function wrapTwoLines(text: string, maxCols: number): [string, string] {
  const words = text.trim().split(/\s+/);
  let l1 = '';
  let l2 = '';
  for (const w of words) {
    if (!l2 && (l1 ? `${l1} ${w}` : w).length <= maxCols) {
      l1 = l1 ? `${l1} ${w}` : w;
    } else if ((l2 ? `${l2} ${w}` : w).length <= maxCols) {
      l2 = l2 ? `${l2} ${w}` : w;
    }
  }
  return [l1, l2];
}

export function buildTriagePageSpec(params: {
  view: TriageView;
  state: TriageState;
  focusedItem: TriageItem | undefined;
  activeProposal: ActionProposal | null;
  lastReceipt: ActionReceipt | null;
  canUndo: boolean;
  statusBanner: string;
  voiceListening: boolean;
  voiceTranscript: string;
  voiceParsedLabel: string;
}): TriagePageSpec {
  const {
    view,
    state,
    focusedItem,
    activeProposal,
    lastReceipt,
    canUndo,
    statusBanner,
    voiceListening,
    voiceTranscript,
    voiceParsedLabel,
  } = params;
  const metrics = computeTriageMetrics(state);
  const active = getActiveItems(state);
  const target = focusedItem ?? active[0];

  if (view === 'radar') {
    const pct = Math.round(metrics.clearRatio * 100);
    const header = clampUtf8(
      `TRIAGE G2 · ${metrics.clearedCount}/${state.totalSessionItems} (${pct}%) · ${metrics.unreadMailCount} MAIL · ${metrics.openNotionCount} NOTN`,
      46,
    );
    const listItems = active.length
      ? active.slice(0, 5).map((item) =>
          clampUtf8(`[${item.tag}] ${item.title}`, 23),
        )
      : [clampUtf8('ALL CLEAR! Reset Demo', 23)];

    // Strictly 4 lines <= 22 chars each inside 266x128 box (zero wrap, zero scrollbar)
    const digestText = target
      ? clampUtf8(
          [
            clampUtf8(`${target.senderOrHost}`, 22),
            clampUtf8(target.briefBullets[0] ?? '', 22),
            clampUtf8(target.briefBullets[1] ?? '', 22),
            clampUtf8(`AI: ${target.aiDraft.slice(0, 18)}`, 22),
          ].join('\n'),
          950,
        )
      : [
          '30-SEC INBOX ZERO!',
          'Calendar: Synced',
          'Gmail: 0 Unread',
          'Notion: Up to Date',
        ].join('\n');

    return {
      view,
      listObject: [
        new ListContainerProperty({
          containerID: 2,
          containerName: 'radar-list',
          xPosition: 8,
          yPosition: 36,
          width: 286,
          height: 218,
          borderWidth: 1,
          borderColor: 6,
          borderRadius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          zOrderIndex: 2,
          itemContainer: new ListItemContainerProperty({
            itemCount: listItems.length,
            itemWidth: 274,
            isItemSelectBorderEn: 1,
            itemName: listItems,
          }),
        }),
      ],
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'radar-header',
          xPosition: 8,
          yPosition: 4,
          width: 560,
          height: 30,
          content: header,
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 1,
        }),
        new TextContainerProperty({
          containerID: 4,
          containerName: 'radar-digest',
          xPosition: 302,
          yPosition: 126,
          width: 266,
          height: 128,
          borderWidth: 1,
          borderColor: 5,
          borderRadius: 4,
          paddingLength: 5,
          content: digestText,
          textColor: 3,
          isEventCapture: 0,
          zOrderIndex: 4,
        }),
        new TextContainerProperty({
          containerID: 5,
          containerName: 'radar-footer',
          xPosition: 8,
          yPosition: 258,
          width: 560,
          height: 26,
          content: clampUtf8(statusBanner || 'SWIPE:Item  TAP:Act  HOLD:Voice  MENU:Quick', 46),
          textColor: 2,
          isEventCapture: 0,
          zOrderIndex: 5,
        }),
      ],
      imageObject: [
        new ImageContainerProperty({
          containerID: 3,
          containerName: 'radar-gauge',
          xPosition: 302,
          yPosition: 36,
          width: 266,
          height: 86,
          zOrderIndex: 3,
        }),
      ],
      menuObject: buildContextMenu(),
      imageContainerTarget: {
        containerID: 3,
        containerName: 'radar-gauge',
        width: 266,
        height: 86,
      },
    };
  }

  if (view === 'detail' && target) {
    const srcTag = target.source.toUpperCase();
    const header = clampUtf8(`${srcTag} · ${target.title} (${target.timeLabel})`, 45);
    const actions = buildDetailActionItems(target);

    // Strictly 4 lines <= 22 chars inside 278x120 box
    const briefText = clampUtf8(
      [
        clampUtf8(`FROM: ${target.senderOrHost}`, 22),
        clampUtf8(`1. ${target.briefBullets[0] ?? ''}`, 22),
        clampUtf8(`2. ${target.briefBullets[1] ?? ''}`, 22),
        clampUtf8(`3. ${target.briefBullets[2] ?? ''}`, 22),
      ].join('\n'),
      950,
    );

    // Strictly 3 lines <= 22 chars inside 278x94 box with word-boundary wrap (zero split words!)
    const [d1, d2] = wrapTwoLines(`"${target.aiDraft}"`, 22);
    const draftText = clampUtf8(
      [
        state.settings.useOpenRouter ? 'AI DRAFT (OPENROUTER)' : 'AI SMART DRAFT',
        clampUtf8(d1, 22),
        clampUtf8(d2, 22),
      ].join('\n'),
      950,
    );

    return {
      view,
      listObject: [
        new ListContainerProperty({
          containerID: 12,
          containerName: 'detail-actions',
          xPosition: 8,
          yPosition: 36,
          width: 274,
          height: 218,
          borderWidth: 1,
          borderColor: 7,
          borderRadius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          zOrderIndex: 2,
          itemContainer: new ListItemContainerProperty({
            itemCount: actions.length,
            itemWidth: 262,
            isItemSelectBorderEn: 1,
            itemName: actions,
          }),
        }),
      ],
      textObject: [
        new TextContainerProperty({
          containerID: 11,
          containerName: 'detail-header',
          xPosition: 8,
          yPosition: 4,
          width: 560,
          height: 30,
          content: header,
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 1,
        }),
        new TextContainerProperty({
          containerID: 13,
          containerName: 'detail-brief',
          xPosition: 290,
          yPosition: 36,
          width: 278,
          height: 120,
          borderWidth: 1,
          borderColor: 6,
          borderRadius: 4,
          paddingLength: 4,
          content: briefText,
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 3,
        }),
        new TextContainerProperty({
          containerID: 14,
          containerName: 'detail-draft',
          xPosition: 290,
          yPosition: 160,
          width: 278,
          height: 94,
          borderWidth: 1,
          borderColor: 4,
          borderRadius: 4,
          paddingLength: 4,
          content: draftText,
          textColor: 3,
          isEventCapture: 0,
          zOrderIndex: 4,
        }),
        new TextContainerProperty({
          containerID: 15,
          containerName: 'detail-footer',
          xPosition: 8,
          yPosition: 258,
          width: 560,
          height: 26,
          content: clampUtf8(statusBanner || 'SWIPE:Action  TAP:Safety Gate  2xTAP:Back', 46),
          textColor: 2,
          isEventCapture: 0,
          zOrderIndex: 5,
        }),
      ],
      imageObject: [],
      menuObject: buildContextMenu(),
    };
  }

  if (view === 'confirm' && activeProposal) {
    const ttlSec = Math.max(0, Math.ceil((activeProposal.expiresAt - Date.now()) / 1000));
    const lines = [
      clampUtf8(`${activeProposal.title} [${activeProposal.id} ${ttlSec}s]`, 43),
      ...activeProposal.previewLines.slice(0, 2).map((l) => clampUtf8(l, 43)),
      clampUtf8(`After: ${activeProposal.afterSummary}`, 43),
    ];
    const choices = [
      clampUtf8('[ NO ]  Cancel & keep untouched (default)', 60),
      clampUtf8(`[ YES ] Commit to ${activeProposal.targetApp}`, 60),
    ];
    return {
      view,
      listObject: [
        new ListContainerProperty({
          containerID: 23,
          containerName: 'confirm-choice',
          xPosition: 8,
          yPosition: 164,
          width: 560,
          height: 90,
          borderWidth: 1,
          borderColor: 9,
          borderRadius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          zOrderIndex: 3,
          itemContainer: new ListItemContainerProperty({
            itemCount: choices.length,
            itemWidth: 544,
            isItemSelectBorderEn: 1,
            itemName: choices,
          }),
        }),
      ],
      textObject: [
        new TextContainerProperty({
          containerID: 21,
          containerName: 'confirm-header',
          xPosition: 8,
          yPosition: 4,
          width: 560,
          height: 30,
          content: `SAFETY GATE · ${activeProposal.targetApp.toUpperCase()} · DEFAULT = NO`,
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 1,
        }),
        new TextContainerProperty({
          containerID: 22,
          containerName: 'confirm-body',
          xPosition: 8,
          yPosition: 36,
          width: 560,
          height: 124,
          borderWidth: 1,
          borderColor: 10,
          borderRadius: 4,
          paddingLength: 6,
          content: clampUtf8(lines.join('\n'), 950),
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 2,
        }),
        new TextContainerProperty({
          containerID: 24,
          containerName: 'confirm-footer',
          xPosition: 8,
          yPosition: 258,
          width: 560,
          height: 26,
          content: 'TAP = SAFE CANCEL  |  SWIPE DOWN + TAP = YES',
          textColor: 2,
          isEventCapture: 0,
          zOrderIndex: 4,
        }),
      ],
      imageObject: [],
      menuObject: buildContextMenu(),
    };
  }

  if (view === 'receipt' && lastReceipt) {
    const proofText = clampUtf8(
      [
        clampUtf8(lastReceipt.headline, 43),
        clampUtf8(`Before: ${lastReceipt.beforeSummary}`, 43),
        clampUtf8(`After: ${lastReceipt.afterSummary}`, 43),
        clampUtf8(`App: ${lastReceipt.targetApp} (${lastReceipt.mode})`, 43),
      ].join('\n'),
      950,
    );
    const navItems = canUndo
      ? [clampUtf8('< Return to Focus Radar', 60), clampUtf8('Undo Last Action (Revert)', 60)]
      : [clampUtf8('< Return to Focus Radar', 60)];

    return {
      view,
      listObject: [
        new ListContainerProperty({
          containerID: 33,
          containerName: 'receipt-nav',
          xPosition: 8,
          yPosition: 164,
          width: 560,
          height: 90,
          borderWidth: 1,
          borderColor: 7,
          borderRadius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          zOrderIndex: 3,
          itemContainer: new ListItemContainerProperty({
            itemCount: navItems.length,
            itemWidth: 544,
            isItemSelectBorderEn: 1,
            itemName: navItems,
          }),
        }),
      ],
      textObject: [
        new TextContainerProperty({
          containerID: 31,
          containerName: 'receipt-header',
          xPosition: 8,
          yPosition: 4,
          width: 560,
          height: 30,
          content: clampUtf8(`ACTION RECEIPT ${lastReceipt.id} · COMMITTED`, 46),
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 1,
        }),
        new TextContainerProperty({
          containerID: 32,
          containerName: 'receipt-body',
          xPosition: 8,
          yPosition: 36,
          width: 560,
          height: 124,
          borderWidth: 1,
          borderColor: 10,
          borderRadius: 4,
          paddingLength: 6,
          content: proofText,
          textColor: 4,
          isEventCapture: 0,
          zOrderIndex: 2,
        }),
        new TextContainerProperty({
          containerID: 34,
          containerName: 'receipt-footer',
          xPosition: 8,
          yPosition: 258,
          width: 560,
          height: 26,
          content: 'TAP:Return  |  SWIPE DOWN + TAP:Undo Action',
          textColor: 2,
          isEventCapture: 0,
          zOrderIndex: 4,
        }),
      ],
      imageObject: [],
      menuObject: buildContextMenu(),
    };
  }

  // Voice HUD
  const voiceItems = [
    ...WORK_VOICE_PRESETS.map((cmd) => clampUtf8(`"${cmd}"`, 60)),
    clampUtf8('< Back to Radar', 60),
  ];
  const voiceBox = clampUtf8(
    [
      voiceListening ? 'MIC ACTIVE (16kHz PCM)' : 'VOICE CAPTURE READY',
      clampUtf8(`Heard: ${voiceTranscript || 'Hold or pick'}`, 22),
      clampUtf8(`Gate: ${voiceParsedLabel || 'Default-NO'}`, 22),
    ].join('\n'),
    950,
  );
  return {
    view: 'voice',
    listObject: [
      new ListContainerProperty({
        containerID: 44,
        containerName: 'voice-presets',
        xPosition: 8,
        yPosition: 136,
        width: 560,
        height: 118,
        borderWidth: 1,
        borderColor: 6,
        borderRadius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        zOrderIndex: 4,
        itemContainer: new ListItemContainerProperty({
          itemCount: voiceItems.length,
          itemWidth: 544,
          isItemSelectBorderEn: 1,
          itemName: voiceItems,
        }),
      }),
    ],
    textObject: [
      new TextContainerProperty({
        containerID: 41,
        containerName: 'voice-header',
        xPosition: 8,
        yPosition: 4,
        width: 560,
        height: 30,
        content: voiceListening
          ? 'VOICE HUD · LISTENING ON G2 MIC'
          : 'VOICE HUD · HANDS-FREE WORK ASSISTANT',
        textColor: 4,
        isEventCapture: 0,
        zOrderIndex: 1,
      }),
      new TextContainerProperty({
        containerID: 43,
        containerName: 'voice-transcript',
        xPosition: 272,
        yPosition: 36,
        width: 296,
        height: 96,
        borderWidth: 1,
        borderColor: 7,
        borderRadius: 4,
        paddingLength: 4,
        content: voiceBox,
        textColor: 3,
        isEventCapture: 0,
        zOrderIndex: 3,
      }),
      new TextContainerProperty({
        containerID: 45,
        containerName: 'voice-footer',
        xPosition: 8,
        yPosition: 258,
        width: 560,
        height: 26,
        content: 'HOLD:Speak  TAP:Run Intent  2xTAP:Back',
        textColor: 2,
        isEventCapture: 0,
        zOrderIndex: 5,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 42,
        containerName: 'voice-wave',
        xPosition: 8,
        yPosition: 36,
        width: 256,
        height: 96,
        zOrderIndex: 2,
      }),
    ],
    menuObject: buildContextMenu(),
    imageContainerTarget: {
      containerID: 42,
      containerName: 'voice-wave',
      width: 256,
      height: 96,
    },
  };
}

export function toStartUpPayload(spec: TriagePageSpec): CreateStartUpPageContainer {
  const payload = new CreateStartUpPageContainer({
    containerTotalNum:
      spec.listObject.length + spec.textObject.length + spec.imageObject.length,
    listObject: spec.listObject.length ? spec.listObject : undefined,
    textObject: spec.textObject.length ? spec.textObject : undefined,
    imageObject: spec.imageObject.length ? spec.imageObject : undefined,
    menuObject: spec.menuObject,
  });
  const check = validateEvenHubPageContainer(payload);
  if (!check.valid) {
    throw new Error(`Invalid startup container: ${check.code} - ${check.message}`);
  }
  return payload;
}

export function toRebuildPayload(spec: TriagePageSpec): RebuildPageContainer {
  const payload = new RebuildPageContainer({
    containerTotalNum:
      spec.listObject.length + spec.textObject.length + spec.imageObject.length,
    listObject: spec.listObject.length ? spec.listObject : undefined,
    textObject: spec.textObject.length ? spec.textObject : undefined,
    imageObject: spec.imageObject.length ? spec.imageObject : undefined,
    menuObject: spec.menuObject,
  });
  const check = validateEvenHubPageContainer(payload);
  if (!check.valid) {
    throw new Error(`Invalid rebuild container: ${check.code} - ${check.message}`);
  }
  return payload;
}
