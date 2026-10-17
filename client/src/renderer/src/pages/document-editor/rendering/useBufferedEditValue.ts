import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { TextRange } from "../../../../../foundation/documentEditing.ts";

type PendingStringEdit = {
  value: string;
  selection: TextRange;
  published: boolean;
};

export function useBufferedStringEdit(
  externalValue: string,
  onPublish: (value: string, selection: TextRange) => void,
) {
  const [value, setValue] = useState(externalValue);
  const valueRef = useRef(externalValue);
  const pendingRef = useRef<PendingStringEdit | undefined>(undefined);
  const publishRef = useRef(onPublish);
  const frameRef = useRef<number | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  publishRef.current = onPublish;

  const cancelScheduledPublish = useCallback(() => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    frameRef.current = undefined;
    timerRef.current = undefined;
  }, []);

  const publishPending = useCallback((transition: boolean) => {
    const pending = pendingRef.current;
    if (!pending || pending.published) return;
    pending.published = true;
    const publish = () => publishRef.current(pending.value, pending.selection);
    if (transition) startTransition(publish);
    else publish();
  }, []);

  const schedulePublish = useCallback(() => {
    if (frameRef.current !== undefined || timerRef.current !== undefined) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        publishPending(true);
      }, 0);
    });
  }, [publishPending]);

  const update = useCallback((nextValue: string, selection: TextRange) => {
    valueRef.current = nextValue;
    pendingRef.current = { value: nextValue, selection, published: false };
    setValue(nextValue);
    schedulePublish();
  }, [schedulePublish]);

  const flush = useCallback(() => {
    cancelScheduledPublish();
    publishPending(false);
  }, [cancelScheduledPublish, publishPending]);

  useLayoutEffect(() => {
    if (externalValue === valueRef.current) {
      pendingRef.current = undefined;
      return;
    }
    if (pendingRef.current) return;
    valueRef.current = externalValue;
    setValue(externalValue);
  }, [externalValue]);

  useEffect(() => cancelScheduledPublish, [cancelScheduledPublish]);

  return { value, valueRef, update, flush };
}
