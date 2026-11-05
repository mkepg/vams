/**
 * A plain HTTP request for the compile service's tests. It runs under happy-dom, whose
 * fetch applies the browser's same-origin rule, and it returns the body as sent, so a
 * gzip-encoded module arrives still compressed.
 */
import { request } from 'node:http';

export interface LabResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  text: string;
}

export function labRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<LabResponse> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method ?? 'POST', headers: options.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body, text: body.toString('utf8') });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
