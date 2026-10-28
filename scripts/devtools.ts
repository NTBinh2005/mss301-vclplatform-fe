/* Shared helpers for the dev-only test scripts (smoke.ts, ui-check.ts).
   They talk to a local MSS backend started with docker compose. */
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8080';
// The backend repo next to this one: .env (JWT_SECRET) and docker compose (postgres) live there.
export const BACKEND_DIR = process.env.BACKEND_DIR || path.resolve(process.cwd(), '../mss301-vslplatform-project');

function jwtSecret(): Buffer {
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    const envFile = path.join(BACKEND_DIR, '.env');
    secret = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim() : undefined;
  }
  if (!secret) throw new Error(`JWT_SECRET not set and not found in ${BACKEND_DIR}/.env`);
  return Buffer.from(secret, 'base64');
}

/** A dev-only admin token signed with the shared JWT secret (ADMIN_ID, default 4 = admin01). */
export function mintAdminToken(adminId = Number(process.env.ADMIN_ID || 4)): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub: String(adminId), username: 'admin', role: 'ADMIN', iat: now, exp: now + 3600 });
  return `${h}.${p}.${createHmac('sha256', jwtSecret()).update(`${h}.${p}`).digest('base64url')}`;
}

/** Calls the gateway as the dev admin; returns the ApiResponse `data`. */
export async function adminCall<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(GATEWAY + url, {
    method,
    headers: { Authorization: `Bearer ${mintAdminToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json?.message ?? ''}`);
  return json.data as T;
}

/* Deleting an account through the API only anonymises it, so test accounts are removed for
   good straight from postgres, together with the rows that point at them. */
export function purgeUsers(ids: number[]) {
  if (!ids.length || process.env.KEEP_DATA === '1') return;
  const list = ids.join(',');
  const sql: Record<string, string> = {
    vsl_social: `delete from blog_notifications where actor_id in (${list}) or recipient_id in (${list});`
      + `delete from user_follows where follower_id in (${list}) or followee_id in (${list});`,
    vsl_learning: `delete from vocabulary_suggestions where requester_id in (${list});`
      + `delete from visit_logs where user_id in (${list});`
      + `delete from user_achievements where user_id in (${list});`
      + `delete from user_progress where user_id in (${list});`
      + `delete from attempt_history where user_id in (${list});`,
    vsl_identity: `delete from refresh_tokens where user_id in (${list});delete from users where user_id in (${list});`,
  };
  for (const [db, q] of Object.entries(sql)) {
    try {
      execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'vsl', '-d', db, '-qc', q], { cwd: BACKEND_DIR, stdio: 'pipe' });
    } catch (e) {
      console.log(`(could not purge test rows in ${db}: ${String((e as Error).message).slice(0, 160)})`);
    }
  }
}

/** Posts can only be deleted while not removed by a moderator, so restore first. */
export async function deletePost(id: number) {
  await adminCall('PUT', `/api/blogs/admin/${id}/restore`).catch(() => {});
  await adminCall('DELETE', `/api/blogs/${id}`).catch(() => {});
}
