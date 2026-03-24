import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Check ALL possible env var names for KV / Upstash Redis
  const envCheck: Record<string, boolean> = {};
  const envValues: Record<string, string> = {};
  for (const key of [
    'KV_REST_API_URL', 'KV_REST_API_TOKEN',
    'KV_URL', 'KV_REST_API_READ_ONLY_TOKEN',
    'REDIS_URL', 'REDIS_TOKEN', 'REDIS_REST_URL', 'REDIS_REST_TOKEN',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    envCheck[key] = !!process.env[key];
    if (process.env[key]) {
      envValues[key] = process.env[key]!.substring(0, 30) + '...';
    }
  }

  // Try to read from whichever URL+token combo exists
  let kvDirect = null;
  let kvError = null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || process.env.KV_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  if (url && token) {
    try {
      const resp = await fetch(`${url}/get/kleinanzeigen:categories`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      kvDirect = {
        status: resp.status,
        resultType: typeof data.result,
        resultPreview: JSON.stringify(data.result).substring(0, 300),
      };
    } catch (e: unknown) {
      kvError = String(e);
    }
  }

  let categories = null;
  let catError = null;
  try {
    categories = await getCategories();
  } catch (e: unknown) {
    catError = String(e);
  }

  return NextResponse.json({
    envCheck,
    envValues,
    usedUrl: url ? url.substring(0, 30) + '...' : null,
    usedToken: !!token,
    kvDirect,
    kvError,
    categories: categories ? categories.map(c => ({ id: c.id, name: c.name })) : null,
    catError,
    categoryCount: categories?.length || 0,
  });
}
