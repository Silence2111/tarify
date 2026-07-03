// Rate-limit с двумя бэкендами:
//  - Upstash Redis (REST) — если заданы UPSTASH_REDIS_REST_URL/TOKEN. Работает на serverless.
//  - in-memory fixed-window — fallback для одного инстанса/локалки.
// Любая ошибка Redis → тихий откат на in-memory, чтобы эндпоинт не падал.
import type { NextRequest } from "next/server";

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

// ---- in-memory ----
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

// ---- Upstash Redis (REST) ----
function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCmd(path: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: number };
  return typeof json.result === "number" ? json.result : null;
}

async function redisLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const k = `rl:${key}`;
  const n = await redisCmd(`incr/${encodeURIComponent(k)}`);
  if (n === null) throw new Error("no result");
  if (n === 1) {
    await redisCmd(`pexpire/${encodeURIComponent(k)}/${windowMs}`);
  }
  if (n > limit) {
    const ttl = await redisCmd(`pttl/${encodeURIComponent(k)}`).catch(() => null);
    const retryAfter = ttl && ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(windowMs / 1000);
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: Math.max(0, limit - n), retryAfter: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  if (upstashConfigured()) {
    try {
      return await redisLimit(key, limit, windowMs);
    } catch {
      // тихий откат на in-memory
    }
  }
  return memoryLimit(key, limit, windowMs);
}

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
