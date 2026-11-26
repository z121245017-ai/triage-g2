export type SourceKind = 'calendar' | 'gmail' | 'notion';

export type ItemStatus = 'active' | 'done' | 'archived' | 'snoozed';

export interface TriageItem {
  id: string;
  source: SourceKind;
  priority: 'urgent' | 'high' | 'normal';
  tag: string;
  title: string;
  senderOrHost: string;
  timeLabel: string;
  /** Ultra-short 3-line executive brief formatted for G2 576x288 micro-LED */
  briefBullets: string[];
  /** Default AI-distilled reply or action note */
  aiDraft: string;
  /** Optional calendar start/end minutes from midnight for clean +30m shift */
  startMin?: number;
  endMin?: number;
  attendees?: string[];
  dueLabel?: string;
  status: ItemStatus;
}

export type WorkActionKind =
  | 'SAVE_GMAIL_DRAFT'
  | 'SEND_GMAIL_REPLY'
  | 'ARCHIVE_ITEM'
  | 'MOVE_MEETING_30M'
  | 'PING_LATE_5M'
  | 'CREATE_NOTION_TASK'
  | 'COMPLETE_NOTION_TASK'
  | 'SNOOZE_ITEM';

export interface ActionProposal {
  id: string;
  kind: WorkActionKind;
  itemId?: string;
  title: string;
  targetApp: 'Gmail' | 'Google Calendar' | 'Notion';
  previewLines: string[];
  payloadText: string;
  dueLabel?: string;
  beforeSummary: string;
  afterSummary: string;
  createdAt: number;
  expiresAt: number;
  source: 'glasses' | 'voice' | 'menu' | 'companion';
}

export interface ActionReceipt {
  id: string;
  proposalId: string;
  kind: WorkActionKind;
  targetApp: 'Gmail' | 'Google Calendar' | 'Notion';
  mode: 'SANDBOX_LOCAL' | 'LIVE_BRIDGE';
  headline: string;
  beforeSummary: string;
  afterSummary: string;
  externalRef?: string;
  undoable: boolean;
  timestamp: number;
}

export interface WorkspaceBridgeSettings {
  bridgeUrl: string;
  useOpenRouter: boolean;
  useNotionBridge: boolean;
  useGoogleBridge: boolean;
  telegramDigest: boolean;
  aiModel: string;
}

export interface TriageState {
  items: TriageItem[];
  triagedCount: number;
  totalSessionItems: number;
  receipts: ActionReceipt[];
  settings: WorkspaceBridgeSettings;
}

export type TriageView = 'radar' | 'detail' | 'confirm' | 'receipt' | 'voice';

export interface ParsedWorkVoice {
  raw: string;
  confidence: number;
  kind: 'PROPOSAL' | 'UNDO' | 'BRIEF' | 'UNKNOWN';
  actionKind?: WorkActionKind;
  itemId?: string;
  customText?: string;
  dueLabel?: string;
  label: string;
}
