/**
 * GET /api/ads?category=klimaanlagen
 * GET /api/ads              (all enabled categories)
 *
 * Reads pre-scraped ads from the proxy cache (GitHub-hosted).
 * Falls back to direct scraping if cache is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnabledCategories, getCategoryById } from '@/lib/categories';
import { scrapeCategory, scrapeAllCategories } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CACHE_URL = 'https://raw.githubusercontent.com/anirudhatalmale6-alt/kleinanzeigen-proxy/master/ads.json';
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes - consider cache stale after this

interface CachedAd {
  title: string;
  price: string;
  link: string;
  imageUrl: string;
  description: string;
  date: string;
  location: string;
  distance: string;
  category: string;
  adSection: string;
}

interface CachedData {
  timestamp: string;
  categories: Array<{
    id: string;
    name: string;
    count: number;
    ads: CachedAd[];
  }>;
}

async function fetchCachedAds(): Promise<CachedData | null> {
  try {
    const res = await fetch(CACHE_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data: CachedData = await res.json();

    // Check if cache is too old
    if (data.timestamp) {
      const age = Date.now() - new Date(data.timestamp).getTime();
      if (age > CACHE_MAX_AGE) {
        console.log(`Cache is ${Math.round(age / 60000)} min old, considered stale`);
        // Still return it - stale data is better than no data when direct scraping is blocked
      }
    }

    return data;
  } catch (err) {
    console.error('Failed to fetch cached ads:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('category');
    const search = req.nextUrl.searchParams.get('q')?.toLowerCase() || '';

    // Try cached data first
    const cached = await fetchCachedAds();

    if (cached && cached.categories && cached.categories.length > 0) {
      // Serve from cache
      if (categoryId) {
        const cachedCat = cached.categories.find(c => c.id === categoryId);
        if (!cachedCat) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        let ads = cachedCat.ads;
        if (search) {
          ads = ads.filter(ad =>
            ad.title.toLowerCase().includes(search) ||
            ad.description.toLowerCase().includes(search)
          );
        }

        return NextResponse.json({
          category: cachedCat.name,
          count: ads.length,
          ads,
          cached: true,
          cacheAge: cached.timestamp,
        });
      }

      // All categories
      let flatAds = cached.categories.flatMap(c => c.ads);
      if (search) {
        flatAds = flatAds.filter(ad =>
          ad.title.toLowerCase().includes(search) ||
          ad.description.toLowerCase().includes(search)
        );
      }

      return NextResponse.json({
        categories: cached.categories.map(c => ({
          id: c.id,
          name: c.name,
          count: c.ads.length,
        })),
        count: flatAds.length,
        ads: flatAds,
        cached: true,
        cacheAge: cached.timestamp,
      });
    }

    // Fallback: direct scraping (may not work if IPs are blocked)
    console.log('Cache unavailable, falling back to direct scraping');

    if (categoryId) {
      const cat = await getCategoryById(categoryId);
      if (!cat || !cat.enabled) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      let ads = await scrapeCategory(cat);
      if (search) {
        ads = ads.filter(ad =>
          ad.title.toLowerCase().includes(search) ||
          ad.description.toLowerCase().includes(search)
        );
      }

      return NextResponse.json({
        category: cat.name,
        count: ads.length,
        ads,
      });
    }

    const enabledCats = await getEnabledCategories();
    const allResults = await scrapeAllCategories(enabledCats);
    let flatAds = Object.values(allResults).flat();

    if (search) {
      flatAds = flatAds.filter(ad =>
        ad.title.toLowerCase().includes(search) ||
        ad.description.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      categories: enabledCats.map(c => ({
        id: c.id,
        name: c.name,
        count: allResults[c.id]?.length || 0,
      })),
      count: flatAds.length,
      ads: flatAds,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ads' },
      { status: 500 }
    );
  }
}
