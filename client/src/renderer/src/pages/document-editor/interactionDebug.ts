const INTERACTION_DEBUG_STORAGE_KEY = "resume-studio:interaction-debug";
const MAX_INTERACTION_RECORDS = 200;

export type InteractionDebugRecord = {
  sequence: number;
  timestampMs: number;
  kind: "dom-event" | "node-handler" | "selection-request" | "selection-state" | "dom-settled";
  detail: Record<string, unknown>;
};

export type InteractionSelectionSnapshot = {
  kind: string;
  nodeId: string;
  itemId?: string;
  componentNodeId?: string;
};

type SelectionLike = {
  kind: string;
  nodeId: string;
  itemId?: string;
  componentNodeId?: string;
};

let enabled = readStoredEnabled();
let sequence = 0;
const records: InteractionDebugRecord[] = [];
const eventIds = new WeakMap<Event, number>();

export function installInteractionDebugApi(): void {
  if (typeof window === "undefined") return;
  const debug = window.__RESUME_STUDIO_DEBUG__ ?? {};
  debug.interactions = {
    enable() {
      enabled = true;
      writeStoredEnabled(true);
      console.info("[Resume Studio interaction debug] enabled");
    },
    disable() {
      enabled = false;
      writeStoredEnabled(false);
      console.info("[Resume Studio interaction debug] disabled");
    },
    status() {
      return { enabled, recordCount: records.length, storageKey: INTERACTION_DEBUG_STORAGE_KEY };
    },
    clear() {
      records.splice(0, records.length);
      console.info("[Resume Studio interaction debug] records cleared");
    },
    recent() {
      return records.map((record) => ({
        ...record,
        detail: { ...record.detail },
      }));
    },
  };
  window.__RESUME_STUDIO_DEBUG__ = debug;
}

export function interactionDebugEnabled(): boolean {
  return enabled;
}

export function installPreviewInteractionCapture(
  root: HTMLElement,
  readSelection: () => SelectionLike | undefined,
): () => void {
  const eventTypes = ["pointerdown", "mousedown", "click", "focusin", "focusout"] as const;
  const handleEvent = (event: Event) => {
    if (!enabled) return;
    const eventId = registerEvent(event);
    recordInteraction("dom-event", {
      eventId,
      event: snapshotEvent(event),
      target: snapshotEventTarget(event.target),
      activeElement: snapshotEventTarget(globalThis.document.activeElement),
      path: event.composedPath().map(snapshotEventTarget).filter(Boolean),
      selection: snapshotSelection(readSelection()),
    });

    if (event.type !== "click") return;
    setTimeout(() => {
      if (!enabled) return;
      recordInteraction("dom-settled", {
        eventId,
        activeElement: snapshotEventTarget(globalThis.document.activeElement),
        selection: snapshotSelection(readSelection()),
      });
    }, 0);
  };

  eventTypes.forEach((type) => root.addEventListener(type, handleEvent, true));
  return () => eventTypes.forEach((type) => root.removeEventListener(type, handleEvent, true));
}

export function interactionEvent(event: unknown): Event | undefined {
  if (event instanceof Event) return event;
  if (
    typeof event === "object" && event !== null && "nativeEvent" in event &&
    event.nativeEvent instanceof Event
  ) return event.nativeEvent;
  return undefined;
}

export function interactionEventId(event: Event | undefined): number | undefined {
  if (!event || !enabled) return undefined;
  return registerEvent(event);
}

export function snapshotEventTarget(target: EventTarget | null | undefined): Record<string, unknown> | undefined {
  if (!target) return undefined;
  if (target === globalThis.window) return { type: "window" };
  if (target === globalThis.document) return { type: "document" };
  if (!(target instanceof Element)) return { type: target.constructor?.name ?? "EventTarget" };

  const snapshot: Record<string, unknown> = {
    tag: target.tagName.toLowerCase(),
  };
  copyAttribute(snapshot, target, "id", "id");
  copyAttribute(snapshot, target, "role", "role");
  copyAttribute(snapshot, target, "contenteditable", "contentEditable");
  copyAttribute(snapshot, target, "data-document-node-id", "documentNodeId");
  copyAttribute(snapshot, target, "data-document-render-id", "documentRenderId");
  copyAttribute(snapshot, target, "data-document-node-type", "documentNodeType");
  copyAttribute(snapshot, target, "data-repeater-item-id", "repeaterItemId");
  copyAttribute(snapshot, target, "data-document-selected", "documentSelected");
  return snapshot;
}

export function snapshotSelection(selection?: SelectionLike): InteractionSelectionSnapshot | undefined {
  if (!selection) return undefined;
  return {
    kind: selection.kind,
    nodeId: selection.nodeId,
    ...(selection.itemId ? { itemId: selection.itemId } : {}),
    ...(selection.componentNodeId ? { componentNodeId: selection.componentNodeId } : {}),
  };
}

export function recordInteraction(
  kind: InteractionDebugRecord["kind"],
  detail: Record<string, unknown>,
): InteractionDebugRecord | undefined {
  if (!enabled) return undefined;
  const record: InteractionDebugRecord = {
    sequence: ++sequence,
    timestampMs: Math.round(performance.now() * 100) / 100,
    kind,
    detail,
  };
  records.push(record);
  if (records.length > MAX_INTERACTION_RECORDS) records.splice(0, records.length - MAX_INTERACTION_RECORDS);

  console.groupCollapsed(`[Resume Studio interaction #${record.sequence}] ${kind}`);
  console.log(record);
  console.groupEnd();
  return record;
}

function registerEvent(event: Event): number {
  const existing = eventIds.get(event);
  if (existing) return existing;
  const next = sequence + 1;
  eventIds.set(event, next);
  return next;
}

function snapshotEvent(event: Event): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: event.type,
    phase: eventPhaseName(event.eventPhase),
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    cancelBubble: event.cancelBubble,
    trusted: event.isTrusted,
  };
  if (event instanceof MouseEvent) {
    result.button = event.button;
    result.buttons = event.buttons;
    result.detail = event.detail;
    result.clientX = Math.round(event.clientX);
    result.clientY = Math.round(event.clientY);
    result.altKey = event.altKey;
    result.ctrlKey = event.ctrlKey;
    result.metaKey = event.metaKey;
    result.shiftKey = event.shiftKey;
  }
  if (event instanceof PointerEvent) {
    result.pointerId = event.pointerId;
    result.pointerType = event.pointerType;
    result.isPrimary = event.isPrimary;
  }
  return result;
}

function eventPhaseName(phase: number): string {
  if (phase === Event.CAPTURING_PHASE) return "capture";
  if (phase === Event.AT_TARGET) return "target";
  if (phase === Event.BUBBLING_PHASE) return "bubble";
  return "none";
}

function copyAttribute(
  snapshot: Record<string, unknown>,
  element: Element,
  attribute: string,
  key: string,
): void {
  const value = element.getAttribute(attribute);
  if (value !== null) snapshot[key] = value;
}

function readStoredEnabled(): boolean {
  if (
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("interactionDebug") === "1"
  ) return true;
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(INTERACTION_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredEnabled(nextEnabled: boolean): void {
  try {
    localStorage.setItem(INTERACTION_DEBUG_STORAGE_KEY, nextEnabled ? "1" : "0");
  } catch {
    // The console mode remains usable even when storage is unavailable.
  }
}

installInteractionDebugApi();
