/**
 * GET /api/ads?category=klimaanlagen
 * GET /api/ads              (all enabled categories)
 *
 * Returns scraped ads from Kleinanzeigen, filtered and deduplicated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnabledCategories, getCategoryById } from '@/lib/categories';
import { scrapeCategory, scrapeAllCategories } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel function timeout

export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('category');
    const search = req.nextUrl.searchParams.get('q')?.toLowerCase() || '';

    if (categoryId) {
      // Single category
      const cat = getCategoryById(categoryId);
      if (!cat || !cat.enabled) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      let ads = await scrapeCategory(cat);

      // Client-side keyword filter
      if (search) {
        ads = ads.filter(
          (ad) =>
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

    // All enabled categories
    const enabledCats = getEnabledCategories();
    const allResults = await scrapeAllCategories(enabledCats);

    let flatAds = Object.values(allResults).flat();

    if (search) {
      flatAds = flatAds.filter(
        (ad) =>
          ad.title.toLowerCase().includes(search) ||
          ad.description.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      categories: enabledCats.map((c) => ({
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
