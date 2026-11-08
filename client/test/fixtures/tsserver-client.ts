import { spawn } from 'node:child_process';
import { z } from 'zod';

const responseSchema = z.object({
  type: z.string(), request_seq: z.number().optional(), success: z.boolean().optional(),
  body: z.unknown().optional(), message: z.string().optional(),
});

/** Exercise the same project discovery protocol used by the editor. */
export function startTypeScriptServer(script: string) {
  const child = spawn(process.execPath, [script, '--disableAutomaticTypingAcquisition'], {
    cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'],
  });
  let sequence = 0;
  let buffer = Buffer.alloc(0);
  let stderr = '';
  const pending = new Map<number, { resolve: (body: unknown) => void; reject: (error: Error) => void }>();
  const rejectPending = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  child.on('error', rejectPending);
  child.stdin.on('error', rejectPending);
  const closed = new Promise<void>(resolve => {
    child.once('close', () => { rejectPending(new Error(`tsserver closed: ${stderr}`)); resolve(); });
  });
  child.stdout.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      for (;;) {
        const separator = buffer.indexOf('\r\n\r\n');
        if (separator < 0) return;
        const length = /Content-Length: (\d+)/.exec(buffer.subarray(0, separator).toString())?.[1];
        if (!length) throw new Error('Missing tsserver response length');
        const end = separator + 4 + Number(length);
        if (buffer.length < end) return;
        const payload: unknown = JSON.parse(buffer.subarray(separator + 4, end).toString());
        buffer = buffer.subarray(end);
        const response = responseSchema.parse(payload);
        if (response.type !== 'response' || response.request_seq === undefined) continue;
        const request = pending.get(response.request_seq);
        if (!request) continue;
        pending.delete(response.request_seq);
        if (response.success) request.resolve(response.body);
        else request.reject(new Error(response.message ?? 'tsserver request failed'));
      }
    } catch (error) {
      rejectPending(error instanceof Error ? error : new Error('Invalid tsserver response', { cause: error }));
      child.kill();
    }
  });
  return {
    request: (command: string, args: unknown): Promise<unknown> => {
      const seq = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(seq);
          reject(new Error(`tsserver timeout: ${command}`));
        }, 60_000);
        pending.set(seq, {
          resolve: body => { clearTimeout(timer); resolve(body); },
          reject: error => { clearTimeout(timer); reject(error); },
        });
        child.stdin.write(JSON.stringify({ seq, type: 'request', command, arguments: args }) + '\n');
      });
    },
    close: async () => { child.kill(); await closed; },
  };
}
