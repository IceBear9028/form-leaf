import { toast } from '../ui/toast';

/** Last error boundary for UI work whose result is not used by the caller. */
export function reportActionError(error: unknown): void {
  console.error('Formleaf action failed', error);
  toast.add({
    type: 'error',
    title: '작업을 완료하지 못했습니다.',
    description: error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
  });
}

/** Only for detached UI work; callers needing success must await the operation. */
export function runAction(promise: Promise<unknown>): void {
  promise.catch(reportActionError);
}
