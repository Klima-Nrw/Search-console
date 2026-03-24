import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Check all possible env vars
  const envCheck: Record<string, boolean> = {};
  for (const key of [
    'KV_REST_API_URL', 'KV_REST_API_TOKEN',
    'REDIS_URL', 'REDIS_TOKEN',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    envCheck[key] = !!process.env[key];
  }

  // Derive REST credentials from REDIS_URL
  let derivedUrl = null;
  let derivedToken = false;
  if (process.env.REDIS_URL) {
    try {
      const parsed = new URL(process.env.REDIS_URL);
      derivedUrl = `https://${parsed.hostname}`;
      derivedToken = !!parsed.password;
    } catch { /* ignore */ }
  }

  // Test REST API call
  let restTest = null;
  const url = derivedUrl || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = (process.env.REDIS_URL ? new URL(process.env.REDIS_URL).password : null) ||
                process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const resp = await fetch(`${url}/get/kleinanzeigen:categories`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      restTest = {
        status: resp.status,
        resultType: typeof data.result,
        resultPreview: JSON.stringify(data.result).substring(0, 300),
      };
    } catch (e: unknown) {
      restTest = { error: String(e) };
    }
  }

  let categories = null;
  try {
    categories = await getCategories();
  } catch { /* ignore */ }

  return NextResponse.json({
    envCheck,
    derived: { url: derivedUrl, hasToken: derivedToken },
    restTest,
    categories: categories ? categories.map(c => ({ id: c.id, name: c.name })) : null,
    categoryCount: categories?.length || 0,
  });
}
