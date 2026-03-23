/**
 * Kleinanzeigen scraper using cheerio (HTML parser).
 * Much lighter than Puppeteer - no browser needed.
 * Kleinanzeigen listing pages are server-rendered, so this works perfectly.
 */

import * as cheerio from 'cheerio';
import { Category } from './categories';

export interface Ad {
  title: string;
  price: string;
  link: string;
  imageUrl: string;
  description: string;
  date: string;
  category: string;
}

// Simple in-memory cache: { key: { ads, timestamp } }
const cache: Record<string, { ads: Ad[]; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Build a Kleinanzeigen search URL for a given keyword + location + radius.
 */
function buildSearchUrl(keyword: string, location: string, radius: number): string {
  const encoded = encodeURIComponent(keyword);
  // Using the general search with location filter
  return `https://www.kleinanzeigen.de/s-preis:/${location}/anbieter:privat/${encoded}/k0l1758r${radius}`;
}

/**
 * Parse ads from Kleinanzeigen HTML using cheerio.
 */
function parseAds($: cheerio.CheerioAPI, categoryName: string): Ad[] {
  const ads: Ad[] = [];

  $('article.aditem').each((_, el) => {
    const $el = $(el);

    // Skip promoted/alt ads
    if ($el.attr('id')?.includes('altads')) return;

    const titleEl = $el.find('a.ellipsis');
    const title = titleEl.text().trim() || 'Kein Titel';

    const priceEl = $el.find('p.aditem-main--middle--price-shipping--price');
    const price = priceEl.text().trim() || '';

    const linkHref = titleEl.attr('href') || '';
    const link = linkHref.startsWith('http')
      ? linkHref
      : `https://www.kleinanzeigen.de${linkHref}`;

    // Image: try data-src (lazy loaded) first, then src
    const imgEl = $el.find('.aditem-image img, .imagebox img');
    let imageUrl = imgEl.attr('data-src') || imgEl.attr('src') || '';
    if (!imageUrl || imageUrl.includes('placeholder')) {
      // Try srcset
      const srcset = imgEl.attr('data-srcset') || imgEl.attr('srcset') || '';
      if (srcset) {
        imageUrl = srcset.split(',')[0].trim().split(' ')[0];
      }
    }
    if (!imageUrl) {
      imageUrl = 'https://static.kleinanzeigen.de/static/img/common/logo/logo-kleinanzeigen-horizontal.svg';
    }

    const descEl = $el.find('.aditem-main--middle--description');
    const description = descEl.text().trim() || '';

    const dateEl = $el.find('.aditem-main--top--right, .aditem-main--top .icon-calendar-open + span');
    const date = dateEl.text().trim() || '';

    ads.push({
      title,
      price,
      link,
      imageUrl,
      description,
      date,
      category: categoryName,
    });
  });

  return ads;
}

/**
 * Fetch and parse ads for a single keyword search.
 */
async function fetchKeyword(
  keyword: string,
  location: string,
  radius: number,
  categoryName: string
): Promise<Ad[]> {
  const url = buildSearchUrl(keyword, location, radius);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    return parseAds($, categoryName);
  } catch (error) {
    console.error(`Error fetching ${keyword}:`, error);
    return [];
  }
}

/**
 * Scrape all ads for a category (all keywords combined, deduplicated).
 */
export async function scrapeCategory(category: Category): Promise<Ad[]> {
  const cacheKey = category.id;

  // Return cached if fresh
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].ads;
  }

  // Fetch all keywords in parallel
  const promises = category.keywords.map((kw) =>
    fetchKeyword(kw, category.location, category.radius, category.name)
  );
  const results = await Promise.all(promises);
  let allAds = results.flat();

  // Deduplicate by link
  const seen = new Set<string>();
  allAds = allAds.filter((ad) => {
    if (seen.has(ad.link)) return false;
    seen.add(ad.link);
    return true;
  });

  // Apply exclude terms
  if (category.excludeTerms.length > 0) {
    const lowerExclude = category.excludeTerms.map((t) => t.toLowerCase());
    allAds = allAds.filter((ad) => {
      const lowerTitle = ad.title.toLowerCase();
      const lowerDesc = ad.description.toLowerCase();
      return !lowerExclude.some(
        (term) => lowerTitle.includes(term) || lowerDesc.includes(term)
      );
    });
  }

  // Cache the results
  cache[cacheKey] = { ads: allAds, timestamp: Date.now() };

  return allAds;
}

/**
 * Scrape all enabled categories.
 */
export async function scrapeAllCategories(
  categories: Category[]
): Promise<Record<string, Ad[]>> {
  const results: Record<string, Ad[]> = {};

  // Scrape categories in parallel
  const promises = categories.map(async (cat) => {
    results[cat.id] = await scrapeCategory(cat);
  });

  await Promise.all(promises);
  return results;
}

/**
 * Clear cache for a specific category or all categories.
 */
export function clearCache(categoryId?: string): void {
  if (categoryId) {
    delete cache[categoryId];
  } else {
    Object.keys(cache).forEach((key) => delete cache[key]);
  }
}
