export function safeHref(value: string): string | undefined {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return undefined;
  if (/^(?:https?:|mailto:|tel:)/i.test(href)) return href;
  if (/^(?:#|\/|\.\/|\.\.\/)/.test(href)) return href;
  return undefined;
}
