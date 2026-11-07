// Standard capabilities shared by Electron's Node and browser runtimes.
// Keeping their narrow contract here avoids granting foundation DOM/Node APIs.
const runtime = globalThis as typeof globalThis & {
  structuredClone<T>(value: T): T;
  crypto: { randomUUID(): string };
};
export function cloneValue<T>(value: T): T {
  return runtime.structuredClone(value);
}
export function randomId(): string {
  return runtime.crypto.randomUUID();
}
