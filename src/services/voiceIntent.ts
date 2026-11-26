import type { ParsedWorkVoice, TriageItem } from '../types';

function extractDueLabel(text: string): string {
  const m = text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|next week)\b/i);
  if (!m) return 'Tomorrow';
  const w = m[1];
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function parseWorkVoiceCommand(
  rawInput: string,
  activeItems: TriageItem[],
  focusedItem?: TriageItem,
): ParsedWorkVoice {
  const raw = rawInput.trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return { raw, confidence: 0, kind: 'UNKNOWN', label: 'No speech detected' };
  }

  // 1. Undo
  if (/\b(undo|revert|cancel last)\b/i.test(lower)) {
    return { raw, confidence: 0.96, kind: 'UNDO', label: 'Undo last triage action' };
  }

  // 2. Move / reschedule meeting (+30m)
  if (/\b(move|push|shift|reschedule|delay)\b.*\b(meeting|sync|call|calendar)\b/i.test(lower)) {
    const cal = activeItems.find((i) => i.source === 'calendar');
    return {
      raw,
      confidence: 0.96,
      kind: 'PROPOSAL',
      actionKind: 'MOVE_MEETING_30M',
      itemId: cal?.id,
      label: 'Move next meeting +30m',
    };
  }

  // 3. Running late ping
  if (/\b(running\s*late|5\s*min|five\s*min|ping\s*team)\b/i.test(lower)) {
    const cal = activeItems.find((i) => i.source === 'calendar');
    return {
      raw,
      confidence: 0.94,
      kind: 'PROPOSAL',
      actionKind: 'PING_LATE_5M',
      itemId: cal?.id,
      label: 'Ping attendees "5m late"',
    };
  }

  // 4. Add Notion task ("Add Notion task ship SDK docs by Friday")
  if (/\b(notion|add\s+task|new\s+task|todo|remind\s+me|promise)\b/i.test(lower)) {
    const cleaned = raw
      .replace(/^(please\s+)?(add|create|log|save)\s+(a\s+)?(notion\s+)?(task|todo|note)\s*(to\s+)?/i, '')
      .replace(/\bby\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|next week)\b/i, '')
      .trim();
    const title = cleaned || 'Follow up on G2 notes';
    const dueLabel = extractDueLabel(raw);
    return {
      raw,
      confidence: 0.95,
      kind: 'PROPOSAL',
      actionKind: 'CREATE_NOTION_TASK',
      customText: title,
      dueLabel,
      label: `Notion task: ${title.slice(0, 18)}`,
    };
  }

  // 5. Save Gmail draft vs Send AI reply
  if (/\b(draft|save\s+draft)\b/i.test(lower)) {
    const target =
      activeItems.find((i) => lower.includes(i.senderOrHost.split(' ')[0].toLowerCase())) ??
      activeItems.find((i) => i.source === 'gmail') ??
      focusedItem;
    return {
      raw,
      confidence: 0.94,
      kind: 'PROPOSAL',
      actionKind: 'SAVE_GMAIL_DRAFT',
      itemId: target?.id,
      customText: target?.aiDraft,
      label: `Save Gmail draft (${target?.senderOrHost.split(' ')[0] ?? 'Email'})`,
    };
  }

  if (/\b(reply|approve|respond|email|tell)\b/i.test(lower)) {
    const target =
      activeItems.find((i) => lower.includes(i.senderOrHost.split(' ')[0].toLowerCase())) ??
      activeItems.find((i) => i.source === 'gmail') ??
      focusedItem;
    return {
      raw,
      confidence: 0.93,
      kind: 'PROPOSAL',
      actionKind: 'SEND_GMAIL_REPLY',
      itemId: target?.id,
      customText: target?.aiDraft,
      label: `AI Reply -> ${target?.senderOrHost.split(' ')[0] ?? 'Inbox'}`,
    };
  }

  // 6. Complete Notion task
  if (/\b(done|complete|finish|check\s+off)\b/i.test(lower)) {
    const task =
      activeItems.find((i) => i.source === 'notion') ?? focusedItem;
    return {
      raw,
      confidence: 0.92,
      kind: 'PROPOSAL',
      actionKind: 'COMPLETE_NOTION_TASK',
      itemId: task?.id,
      label: `Mark "${task?.title.slice(0, 16) ?? 'Task'}" done`,
    };
  }

  // 7. Archive / Snooze
  if (/\b(archive|clear|dismiss)\b/i.test(lower)) {
    const target = focusedItem ?? activeItems[0];
    return {
      raw,
      confidence: 0.91,
      kind: 'PROPOSAL',
      actionKind: 'ARCHIVE_ITEM',
      itemId: target?.id,
      label: `Archive ${target?.title.slice(0, 16) ?? 'item'}`,
    };
  }

  if (/\b(snooze|later|tomorrow)\b/i.test(lower)) {
    const target = focusedItem ?? activeItems[0];
    return {
      raw,
      confidence: 0.9,
      kind: 'PROPOSAL',
      actionKind: 'SNOOZE_ITEM',
      itemId: target?.id,
      label: `Snooze ${target?.title.slice(0, 16) ?? 'item'}`,
    };
  }

  if (/\b(brief|next\s+meeting|agenda|summary)\b/i.test(lower)) {
    return { raw, confidence: 0.9, kind: 'BRIEF', label: 'Open next meeting brief' };
  }

  return {
    raw,
    confidence: 0.2,
    kind: 'UNKNOWN',
    label: `Try: "Move meeting +30m"`,
  };
}
