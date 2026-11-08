export function safeHref(value: string): string | undefined {
  const href = value.trim();
// eslint-disable-next-line no-control-regex -- Reject control characters in untrusted URLs.
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return undefined;
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) return href;
  if (/^(?:#|\/|\.\/|\.\.\/)/.test(href)) return href;
  return undefined;
}
