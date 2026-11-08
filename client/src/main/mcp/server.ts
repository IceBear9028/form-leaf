import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { AGENT_LIMITS } from "../../foundation/documentCommandSchemas.ts";
import type { AccessPolicy } from "./accessPolicy.ts";

/** Stateless HTTP; durable credential/request IDs, never transport sessions, own operations. */
export class AgentServer {
  private http?: HttpServer;
  private error?: string;
  private readonly policy: AccessPolicy;
  private readonly createProtocol: (credentialId: string) => Server;
  constructor(policy: AccessPolicy, createProtocol: (credentialId: string) => Server) {
    this.policy = policy; this.createProtocol = createProtocol;
  }
  status() { return { running: !!this.http?.listening, endpoint: `http://127.0.0.1:${this.policy.settings().port}/mcp`, error: this.error }; }
  async start(): Promise<void> {
    if (this.http?.listening) return;
    this.error = undefined;
    const http = createServer((request, response) => { this.handle(request, response).catch((error: unknown) => { console.error("Agent response failed", error); response.destroy(); }); });
    http.requestTimeout = 30_000;
    http.headersTimeout = 10_000;
    this.http = http;
    await new Promise<void>((resolve, reject) => {
      http.once("error", (error) => { this.error = error.message; reject(error); });
      http.listen(this.policy.settings().port, "127.0.0.1", resolve);
    });
  }
  async stop(): Promise<void> {
    const http = this.http; this.http = undefined;
    if (!http) return;
    http.closeIdleConnections();
    // Existing accepted work keeps running; transport closure never rolls it back.
    await new Promise<void>((resolve) => { http.close(() => resolve()); http.closeAllConnections(); });
  }
  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const reject = (status: number, message: string) => { if (!response.headersSent) response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify({ error: message })); };
    try {
      const authority = `127.0.0.1:${this.policy.settings().port}`;
      if (request.headers.host !== authority || (request.headers.origin !== undefined && request.headers.origin !== `http://${authority}`)) return reject(403, "Forbidden origin or host");
      if (request.url !== "/mcp") return reject(404, "Not found");
      const bearer = request.headers.authorization;
      const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
      const credentialId = this.policy.authenticate(token);
      if (!credentialId) return reject(401, "Authentication required");
      if (request.method !== "POST") return reject(405, "Use POST");
      if (!request.headers["content-type"]?.startsWith("application/json")) return reject(415, "JSON required");
      if (Number(request.headers["content-length"] ?? 0) > AGENT_LIMITS.jsonBytes) return reject(413, "Request too large");
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > AGENT_LIMITS.jsonBytes) return reject(413, "Request too large");
        chunks.push(Buffer.from(chunk));
      }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reject(400, "Invalid JSON"); }
      // Rotation, expiry or revocation may occur while receiving the body.
      if (this.policy.authenticate(token) !== credentialId) return reject(401, "Authentication required");
      const protocol = this.createProtocol(credentialId);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      response.on("close", () => { protocol.close().catch((error: unknown) => console.error("Agent transport cleanup failed", error)); });
      await protocol.connect(transport);
      await transport.handleRequest(request, response, body);
      if (response.statusCode >= 200 && response.statusCode < 300 && token) this.policy.recordAccess(credentialId, token);
    } catch {
      // Never expose exception text, host paths, document names or payloads over HTTP.
      if (!response.writableEnded) reject(500, "Request failed");
    }
  }
}
