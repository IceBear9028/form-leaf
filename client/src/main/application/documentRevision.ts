import { createHash } from "node:crypto";

/** Object key order is irrelevant; array order and every saved field remain significant. */
export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("Only JSON values can be hashed");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export function documentRevision(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableSerialize(value)).digest("hex")}`;
}
export function requestHash(tool: string, input: Record<string, unknown>): string {
  const { requestId: _requestId, ...arguments_ } = input;
  return documentRevision({ tool, arguments: arguments_ });
}
