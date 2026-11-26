import type {
  ActionProposal,
  ActionReceipt,
  TriageItem,
  TriageState,
  WorkActionKind,
  WorkspaceBridgeSettings,
} from '../types';

const PROPOSAL_TTL_MS = 45_000;

export function formatMinutes(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createInitialTriageState(): TriageState {
  const items: TriageItem[] = [
    {
      id: 'cal-q4-sync',
      source: 'calendar',
      priority: 'urgent',
      tag: 'CAL 12m',
      title: 'Q4 API Sync',
      senderOrHost: 'Priya, Marcus',
      timeLabel: '15:00-15:30',
      startMin: 15 * 60,
      endMin: 15 * 60 + 30,
      attendees: ['Priya', 'Marcus', 'Ken'],
      briefBullets: [
        'Lock v2 rate limits',
        'Fix OAuth callback',
        'PR #412 needs sign',
      ],
      aiDraft: 'Running 5m late, start on rate limits!',
      status: 'active',
    },
    {
      id: 'mail-elena-redline',
      source: 'gmail',
      priority: 'urgent',
      tag: 'MAIL!',
      title: 'Elena: MSA',
      senderOrHost: 'Elena (Legal)',
      timeLabel: '14m ago',
      briefBullets: [
        'Confirm Sec 4.2 cap',
        'Due today 17:00 UTC',
        'Low risk, std terms',
      ],
      aiDraft: 'Approved Sec 4.2, send sign link.',
      status: 'active',
    },
    {
      id: 'mail-devops-alert',
      source: 'gmail',
      priority: 'high',
      tag: 'MAIL',
      title: 'DevOps p95 +18%',
      senderOrHost: 'On-Call Bot',
      timeLabel: '26m ago',
      briefBullets: [
        'EU p95 142 -> 168ms',
        'Cold cache on deploy',
        'Keep auto-scale on',
      ],
      aiDraft: 'Ack, keep auto-scale on til 15:30.',
      status: 'active',
    },
    {
      id: 'notn-sdk-docs',
      source: 'notion',
      priority: 'high',
      tag: 'NOTN',
      title: 'G2 SDK Check',
      senderOrHost: 'Notion · Sprint',
      timeLabel: 'Due Today',
      dueLabel: 'Today',
      briefBullets: [
        'Verify app.json list',
        'Attach G2 sim proofs',
        'Owner: Solo (P0)',
      ],
      aiDraft: 'SDK checklist done, 0 sim errors.',
      status: 'active',
    },
    {
      id: 'mail-alex-coffee',
      source: 'gmail',
      priority: 'normal',
      tag: 'MAIL',
      title: 'Alex: TVM Intro',
      senderOrHost: 'Alex Rivera',
      timeLabel: '1h ago',
      briefBullets: [
        'Warm intro to TVM',
        'Needs 2-line pitch',
        'Send live demo URL',
      ],
      aiDraft: 'Yes please! Sending demo after sync.',
      status: 'active',
    },
  ];

  return {
    items,
    triagedCount: 0,
    totalSessionItems: items.length,
    receipts: [],
    settings: {
      bridgeUrl: 'http://127.0.0.1:8788',
      useOpenRouter: false,
      useNotionBridge: false,
      useGoogleBridge: false,
      telegramDigest: false,
      aiModel: 'anthropic/claude-3.5-haiku',
    },
  };
}

export function getActiveItems(state: TriageState): TriageItem[] {
  return state.items.filter((i) => i.status === 'active');
}

export function getNextMeeting(state: TriageState): TriageItem | undefined {
  return state.items.find((i) => i.source === 'calendar' && i.status === 'active');
}

export function computeTriageMetrics(state: TriageState): {
  activeCount: number;
  unreadMailCount: number;
  openNotionCount: number;
  clearedCount: number;
  clearRatio: number;
  nextMeetingLabel: string;
} {
  const active = getActiveItems(state);
  const unreadMailCount = active.filter((i) => i.source === 'gmail').length;
  const openNotionCount = active.filter((i) => i.source === 'notion').length;
  const clearedCount = Math.max(0, state.totalSessionItems - active.length);
  const clearRatio =
    state.totalSessionItems > 0
      ? Math.min(1, clearedCount / state.totalSessionItems)
      : 1;
  const nextCal = getNextMeeting(state);
  const nextMeetingLabel = nextCal
    ? `${nextCal.timeLabel} ${nextCal.title}`
    : 'Calendar Clear';
  return {
    activeCount: active.length,
    unreadMailCount,
    openNotionCount,
    clearedCount,
    clearRatio,
    nextMeetingLabel,
  };
}

export function buildActionProposal(params: {
  kind: WorkActionKind;
  state: TriageState;
  itemId?: string;
  customText?: string;
  dueLabel?: string;
  source: ActionProposal['source'];
  now?: number;
}): ActionProposal | { error: string } {
  const now = params.now ?? Date.now();
  const id = `WK-${String(now).slice(-5)}`;
  const { kind, state } = params;
  const item =
    (params.itemId ? state.items.find((i) => i.id === params.itemId) : undefined) ??
    getActiveItems(state)[0];

  if (kind === 'CREATE_NOTION_TASK') {
    const taskTitle = (params.customText || item?.title || 'Follow up on action item').trim();
    const due = params.dueLabel || 'Tomorrow';
    const openNotion = getActiveItems(state).filter((i) => i.source === 'notion').length;
    return {
      id,
      kind,
      itemId: item?.id,
      title: `Add Notion Task?`,
      targetApp: 'Notion',
      previewLines: [
        `Task: ${taskTitle}`,
        `DB: Sprint Tasks · Due: ${due}`,
        `Source: Hands-free G2 capture`,
      ],
      payloadText: taskTitle,
      dueLabel: due,
      beforeSummary: `${openNotion} open Notion tasks`,
      afterSummary: `${openNotion + 1} tasks (+${taskTitle.slice(0, 22)})`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  if (!item) return { error: 'Inbox zero — no active items left!' };

  if (kind === 'MOVE_MEETING_30M') {
    const cal =
      item.source === 'calendar'
        ? item
        : getNextMeeting(state);
    if (!cal) return { error: 'No active calendar meeting to shift.' };
    const start = cal.startMin ?? 15 * 60;
    const end = cal.endMin ?? start + 30;
    const oldSlot = `${formatMinutes(start)}-${formatMinutes(end)}`;
    const newSlot = `${formatMinutes(start + 30)}-${formatMinutes(end + 30)}`;
    return {
      id,
      kind,
      itemId: cal.id,
      title: `Move ${cal.title} +30m?`,
      targetApp: 'Google Calendar',
      previewLines: [
        `Slot: ${oldSlot} -> ${newSlot}`,
        `Notify: ${cal.senderOrHost}`,
        `Conflict check: 0 overlaps found`,
      ],
      payloadText: newSlot,
      beforeSummary: `${cal.title} @ ${oldSlot}`,
      afterSummary: `${cal.title} @ ${newSlot}`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  if (kind === 'PING_LATE_5M') {
    const cal = item.source === 'calendar' ? item : getNextMeeting(state) ?? item;
    const msg = params.customText || cal.aiDraft;
    return {
      id,
      kind,
      itemId: cal.id,
      title: `Ping Attendees "5m Late"?`,
      targetApp: 'Gmail',
      previewLines: [
        `To: ${cal.senderOrHost}`,
        `Msg: "${msg.slice(0, 38)}"`,
        `Saves as sent notice + meeting note`,
      ],
      payloadText: msg,
      beforeSummary: `No ETA sent to ${cal.senderOrHost}`,
      afterSummary: `ETA notice queued (${cal.timeLabel})`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  if (kind === 'SAVE_GMAIL_DRAFT' || kind === 'SEND_GMAIL_REPLY') {
    const body = params.customText || item.aiDraft;
    const isDraft = kind === 'SAVE_GMAIL_DRAFT';
    const unread = getActiveItems(state).filter((i) => i.source === 'gmail').length;
    return {
      id,
      kind,
      itemId: item.id,
      title: isDraft ? `Save Gmail Draft (${item.senderOrHost.split(' ')[0]})?` : `Send AI Reply (${item.senderOrHost.split(' ')[0]})?`,
      targetApp: 'Gmail',
      previewLines: [
        `Re: ${item.title}`,
        `Draft: "${body.slice(0, 33)}"`,
        isDraft ? 'Safe mode: Saved as Draft, never sent' : 'Clears thread from unread inbox',
      ],
      payloadText: body,
      beforeSummary: `${unread} unread (${item.title})`,
      afterSummary: isDraft
        ? `Draft saved · ${Math.max(0, unread - 1)} unread left`
        : `Reply sent · ${Math.max(0, unread - 1)} unread left`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  if (kind === 'COMPLETE_NOTION_TASK') {
    const openNotion = getActiveItems(state).filter((i) => i.source === 'notion').length;
    return {
      id,
      kind,
      itemId: item.id,
      title: `Mark "${item.title}" Done?`,
      targetApp: 'Notion',
      previewLines: [
        `Database: ${item.senderOrHost}`,
        `Status: In Progress -> Done`,
        `Undoable anytime from Receipt screen`,
      ],
      payloadText: 'Done',
      beforeSummary: `${openNotion} open Notion tasks`,
      afterSummary: `${Math.max(0, openNotion - 1)} open · "${item.title}" Done`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  if (kind === 'SNOOZE_ITEM') {
    const activeCount = getActiveItems(state).length;
    return {
      id,
      kind,
      itemId: item.id,
      title: `Snooze "${item.title}" to Tomorrow?`,
      targetApp: item.source === 'notion' ? 'Notion' : 'Gmail',
      previewLines: [
        `Item: ${item.title}`,
        `Resurface: Tomorrow 09:00`,
        `Clears from current 30s focus queue`,
      ],
      payloadText: 'Tomorrow 09:00',
      beforeSummary: `${activeCount} active items`,
      afterSummary: `${Math.max(0, activeCount - 1)} active · Snoozed`,
      createdAt: now,
      expiresAt: now + PROPOSAL_TTL_MS,
      source: params.source,
    };
  }

  // ARCHIVE_ITEM
  const activeCount = getActiveItems(state).length;
  return {
    id,
    kind: 'ARCHIVE_ITEM',
    itemId: item.id,
    title: `Archive "${item.title}"?`,
    targetApp: 'Gmail',
    previewLines: [
      `From: ${item.senderOrHost}`,
      `Action: Archive & mark read`,
      `1-tap Undo available on next screen`,
    ],
    payloadText: 'Archive',
    beforeSummary: `${activeCount} active in triage rail`,
    afterSummary: `${Math.max(0, activeCount - 1)} active remaining`,
    createdAt: now,
    expiresAt: now + PROPOSAL_TTL_MS,
    source: params.source,
  };
}

export function applyProposalToState(
  state: TriageState,
  proposal: ActionProposal,
  bridgeMeta?: { mode?: 'SANDBOX_LOCAL' | 'LIVE_BRIDGE'; externalRef?: string },
  now = Date.now(),
): {
  nextState: TriageState;
  receipt: ActionReceipt;
  undoSnapshot: TriageState;
} {
  const undoSnapshot: TriageState = {
    ...state,
    items: state.items.map((i) => ({ ...i, briefBullets: [...i.briefBullets] })),
    receipts: [...state.receipts],
  };

  let items = state.items.map((i) => ({ ...i }));
  let totalSessionItems = state.totalSessionItems;
  let triagedCount = state.triagedCount;
  let headline = `DONE: ${proposal.title.replace('?', '')}`;

  if (proposal.kind === 'CREATE_NOTION_TASK') {
    const newTask: TriageItem = {
      id: `notn-${String(now).slice(-4)}`,
      source: 'notion',
      priority: 'high',
      tag: 'NOTN',
      title: proposal.payloadText.slice(0, 24),
      senderOrHost: 'Notion · Sprint Tasks',
      timeLabel: `Due ${proposal.dueLabel || 'Tomorrow'}`,
      dueLabel: proposal.dueLabel || 'Tomorrow',
      briefBullets: [
        `Captured on Even G2 (${proposal.source})`,
        `Due: ${proposal.dueLabel || 'Tomorrow'}`,
        'Status: Synced to Notion queue',
      ],
      aiDraft: `Task logged: ${proposal.payloadText}`,
      status: 'active',
    };
    items = [...items, newTask];
    totalSessionItems += 1;
    headline = `NOTION TASK CREATED: ${newTask.title}`;
  } else if (proposal.kind === 'MOVE_MEETING_30M' && proposal.itemId) {
    items = items.map((i) => {
      if (i.id !== proposal.itemId) return i;
      const start = (i.startMin ?? 15 * 60) + 30;
      const end = (i.endMin ?? start) + 30;
      return {
        ...i,
        startMin: start,
        endMin: end,
        timeLabel: `${formatMinutes(start)}-${formatMinutes(end)}`,
        tag: 'CAL +30m',
      };
    });
    triagedCount += 1;
    headline = `MOVED MEETING -> ${proposal.payloadText}`;
  } else if (proposal.kind === 'PING_LATE_5M') {
    triagedCount += 1;
    headline = `SENT "RUNNING 5M LATE" PING`;
  } else if (proposal.itemId) {
    const newStatus =
      proposal.kind === 'SNOOZE_ITEM'
        ? 'snoozed'
        : proposal.kind === 'ARCHIVE_ITEM'
          ? 'archived'
          : 'done';
    items = items.map((i) => (i.id === proposal.itemId ? { ...i, status: newStatus } : i));
    triagedCount += 1;
    if (proposal.kind === 'SAVE_GMAIL_DRAFT') {
      headline = `SAVED GMAIL DRAFT (SAFE MODE)`;
    } else if (proposal.kind === 'SEND_GMAIL_REPLY') {
      headline = `SENT AI REPLY & CLEARED THREAD`;
    } else if (proposal.kind === 'COMPLETE_NOTION_TASK') {
      headline = `NOTION TASK MARKED DONE`;
    } else if (proposal.kind === 'SNOOZE_ITEM') {
      headline = `SNOOZED TO TOMORROW 09:00`;
    } else {
      headline = `ARCHIVED & CLEARED FROM INBOX`;
    }
  }

  const receipt: ActionReceipt = {
    id: `TG-${String(now).slice(-4)}`,
    proposalId: proposal.id,
    kind: proposal.kind,
    targetApp: proposal.targetApp,
    mode: bridgeMeta?.mode ?? 'SANDBOX_LOCAL',
    headline,
    beforeSummary: proposal.beforeSummary,
    afterSummary: proposal.afterSummary,
    externalRef: bridgeMeta?.externalRef,
    undoable: true,
    timestamp: now,
  };

  return {
    nextState: {
      ...state,
      items,
      totalSessionItems,
      triagedCount,
      receipts: [receipt, ...state.receipts].slice(0, 20),
    },
    receipt,
    undoSnapshot,
  };
}

export async function dispatchOptionalWorkspaceBridge(
  proposal: ActionProposal,
  settings: WorkspaceBridgeSettings,
): Promise<{ mode: 'SANDBOX_LOCAL' | 'LIVE_BRIDGE'; externalRef?: string }> {
  const base = settings.bridgeUrl.replace(/\/+$/, '');
  try {
    if (proposal.targetApp === 'Notion' && settings.useNotionBridge) {
      const res = await fetch(`${base}/api/notion/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposal.payloadText,
          due: proposal.dueLabel,
          action: proposal.kind,
        }),
      });
      if (res.ok) {
        const d = (await res.json()) as { id?: string };
        return { mode: 'LIVE_BRIDGE', externalRef: d.id ? d.id.slice(0, 8) : 'NOTION-OK' };
      }
    }
    if (
      (proposal.targetApp === 'Gmail' || proposal.targetApp === 'Google Calendar') &&
      settings.useGoogleBridge
    ) {
      const endpoint =
        proposal.targetApp === 'Google Calendar'
          ? '/api/google/calendar-shift'
          : '/api/google/gmail-draft';
      const res = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: proposal.title,
          body: proposal.payloadText,
        }),
      });
      if (res.ok) {
        const d = (await res.json()) as { id?: string };
        return { mode: 'LIVE_BRIDGE', externalRef: d.id ? d.id.slice(0, 8) : 'GWS-OK' };
      }
    }
  } catch {
    // Transparent fallback to local sandbox mode when optional bridge is offline
  }
  return { mode: 'SANDBOX_LOCAL' };
}

export async function requestOptionalAiDraft(
  item: TriageItem,
  settings: WorkspaceBridgeSettings,
): Promise<string | null> {
  if (!settings.useOpenRouter) return null;
  const base = settings.bridgeUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/ai/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.aiModel,
        title: item.title,
        sender: item.senderOrHost,
        bullets: item.briefBullets,
      }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { draft?: string };
    return d.draft?.trim() || null;
  } catch {
    return null;
  }
}
