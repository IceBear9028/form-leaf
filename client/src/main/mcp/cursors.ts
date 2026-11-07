import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AGENT_LIMITS } from "../../foundation/documentCommandSchemas.ts";
import { failure } from "../../foundation/documentCommands.ts";
import { documentRevision } from "../application/documentRevision.ts";

export class CursorPager {
  private readonly secret = randomBytes(32);
  private readonly now: () => number;
  constructor(now = Date.now) { this.now = now; }
  page<T>(items: T[], credentialId: string, scope: unknown, limit: number, cursor?: string) {
    const fingerprint = documentRevision({ credentialId, scope, items });
    let offset = 0;
    if (cursor) {
      try {
        const [payload, signature, extra] = cursor.split(".");
        if (extra || !payload || !signature) throw new Error();
        const actual = Buffer.from(signature, "base64url");
        const expected = createHmac("sha256", this.secret).update(payload).digest();
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (parsed.fingerprint !== fingerprint || parsed.expiresAt <= this.now() || !Number.isSafeInteger(parsed.offset) || parsed.offset <= 0 || parsed.offset >= items.length) throw new Error();
        offset = parsed.offset;
      } catch { failure("INVALID_CURSOR", "목록이 변경됐거나 cursor가 만료됐습니다. 처음부터 조회하세요."); }
    }
    const next = offset + limit;
    let nextCursor: string | null = null;
    if (next < items.length) {
      const payload = Buffer.from(JSON.stringify({ fingerprint, offset: next, expiresAt: this.now() + AGENT_LIMITS.cursorLifetimeMs })).toString("base64url");
      nextCursor = `${payload}.${createHmac("sha256", this.secret).update(payload).digest("base64url")}`;
    }
    return { items: items.slice(offset, next), nextCursor };
  }
}
