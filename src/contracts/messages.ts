import type { ExportTabsOptions } from '../services/tab-export-service.js';

export type PendingPopupFeedbackCode = 'empty-result';

export interface BadgeMessage {
  topic: 'badge';
  params: { type: 'success' | 'fail' };
}

export interface ExportCurrentTabMessage {
  topic: 'export-current-tab';
  params: {
    tabId: number;
    format: 'link' | 'custom-format';
    customFormatSlot?: string | null;
  };
}

export interface ExportTabsMessage {
  topic: 'export-tabs';
  params: ExportTabsOptions;
}

export interface CopyToClipboardMessage {
  topic: 'copy-to-clipboard';
  params: { text: string };
}

export interface CheckMockClipboardMessage {
  topic: 'check-mock-clipboard';
  params: Record<string, never>;
}

export interface SetMockClipboardMessage {
  topic: 'set-mock-clipboard';
  params: { enabled: boolean };
}

export interface ConsumePendingPopupFeedbackMessage {
  topic: 'consume-pending-popup-feedback';
  params: Record<string, never>;
}

// Selenium uses a message round-trip because attaching a debugger pauses the worker.
export interface ListenersReadyMessage {
  topic: 'e2e-listeners-ready';
  params: Record<string, never>;
}

export type RuntimeMessage
  = | BadgeMessage
    | ExportCurrentTabMessage
    | ExportTabsMessage
    | CopyToClipboardMessage
    | CheckMockClipboardMessage
    | SetMockClipboardMessage
    | ConsumePendingPopupFeedbackMessage
    | ListenersReadyMessage;

export type RuntimeMessageTopic = RuntimeMessage['topic'];

export type RuntimeMessageParams<TTopic extends RuntimeMessageTopic>
  = Extract<RuntimeMessage, { topic: TTopic }>['params'];
