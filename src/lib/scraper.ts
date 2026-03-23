/**
 * Kleinanzeigen scraper using cheerio (HTML parser).
 * Much lighter than Puppeteer - no browser needed.
 * Kleinanzeigen listing pages are server-rendered, so this works perfectly.
 */

import * as cheerio from 'cheerio';
import { Category, KLEINANZEIGEN_SECTIONS } from './categories';

export interface Ad {
  title: string;
  price: string;
  link: string;
  imageUrl: string;
  description: string;
  date: string;
  location: string;   // e.g. "44359 Mengede"
  distance: string;    // e.g. "(33 km)"
  category: string;
  adSection: string;  // Kleinanzeigen section extracted from the ad's link/category
}

// Simple in-memory cache: { key: { ads, timestamp } }
const cache: Record<string, { ads: Ad[]; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Build a Kleinanzeigen search URL with section, filters, and location.
 *
 * Verified URL patterns from the site:
 *   /s-dienstleistungen/46286/anbieter:privat/anzeige:gesuche/klimaanlage/k0c297l1758r50
 *   /s-46286/anbieter:privat/anzeige:gesuche/photovoltaik/k0l1758r100
 */
function buildSearchUrl(
  keyword: string,
  location: string,
  radius: number,
  section: string,
  searchType: string,
  offerType: string
): string {
  const encoded = encodeURIComponent(keyword);
  const sectionInfo = KLEINANZEIGEN_SECTIONS[section] || { slug: '', code: '' };

  const parts: string[] = ['https://www.kleinanzeigen.de'];

  // Section slug (e.g. "s-dienstleistungen") or just "s" for all
  if (sectionInfo.slug) {
    parts.push(sectionInfo.slug);
  } else {
    parts.push('s');
  }

  // Location (postal code)
  parts.push(location);

  // Filters
  if (searchType) parts.push(searchType);
  if (offerType) parts.push(offerType);

  // Search keyword
  parts.push(encoded);

  // Suffix: k0 = all subcategories, cXXX = category code, l1758 = PLZ location type, rXX = radius
  const categoryCode = sectionInfo.code || '';
  parts.push(`k0${categoryCode}l1758r${radius}`);

  return parts.join('/');
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

    const dateEl = $el.find('.aditem-main--top--right');
    const date = dateEl.text().trim() || '';

    // Extract location (postcode + city) from the ad
    const locationEl = $el.find('.aditem-main--top--left');
    const locationText = locationEl.text().trim();
    // Location text looks like: "44359 Mengede (33 km)" or "44359 Mengede"
    const locationMatch = locationText.match(/(\d{5}\s+[^\(]+)/);
    const location = locationMatch ? locationMatch[1].trim() : '';
    // Extract distance like "(33 km)"
    const distanceMatch = locationText.match(/\((\d+)\s*km\)/);
    const distance = distanceMatch ? `${distanceMatch[1]} km` : '';

    // Extract the Kleinanzeigen category/section from the ad's link URL
    // Links look like: /s-anzeige/dienstleistungen/... or /s-anzeige/autos/...
    const adSection = linkHref.split('/').find((part: string) =>
      ['autos', 'dienstleistungen', 'haus-garten', 'elektronik', 'immobilien',
       'jobs', 'familie-kind-baby', 'freizeit-nachbarschaft', 'heimwerken',
       'musik-film-buecher', 'mode-beauty', 'haustiere', 'unterricht-kurse',
       'zu-verschenken'].includes(part)
    ) || '';

    ads.push({
      title,
      price,
      link,
      imageUrl,
      description,
      date,
      location,
      distance,
      category: categoryName,
      adSection,
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
  categoryName: string,
  section: string,
  searchType: string,
  offerType: string
): Promise<Ad[]> {
  const url = buildSearchUrl(keyword, location, radius, section, searchType, offerType);

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
  // Cache key includes settings hash so changes auto-invalidate cache
  const settingsHash = JSON.stringify({
    kw: category.keywords,
    loc: category.location,
    r: category.radius,
    sec: category.kleinanzeigenSection,
    ex: category.excludeSections,
    et: category.excludeTerms,
    st: category.searchType,
    ot: category.offerType,
  });
  const cacheKey = `${category.id}:${settingsHash}`;

  // Return cached if fresh
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].ads;
  }

  // Fetch all keywords in parallel
  const promises = category.keywords.map((kw) =>
    fetchKeyword(
      kw,
      category.location,
      category.radius,
      category.name,
      category.kleinanzeigenSection || 'alle',
      category.searchType || '',
      category.offerType || ''
    )
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

  // Filter out ads beyond the configured radius
  // When Kleinanzeigen has no local results, it silently returns ads from all of Germany
  allAds = allAds.filter((ad) => {
    if (!ad.distance) return true; // Keep ads without distance info (likely local)
    const km = parseInt(ad.distance, 10);
    if (isNaN(km)) return true;
    return km <= category.radius;
  });

  // Filter out excluded Kleinanzeigen sections (e.g. "auto-rad-boot")
  // Ad URLs follow the pattern: /s-anzeige/title-slug/ID-CATEGORYCODE-LOCATIONCODE
  // e.g. /s-anzeige/golf-5-1-9-tdi/3361082851-216-1103 (216 = Auto category)
  if (category.excludeSections && category.excludeSections.length > 0) {
    // Map section keys to Kleinanzeigen numeric category codes found in ad URLs
    const sectionToCategoryCodes: Record<string, string[]> = {
      'auto-rad-boot':     ['216', '210', '223', '211', '222', '224'],  // Autos, Motorräder, Boote, Wohnmobile, Fahrräder, Auto-Teile
      'immobilien':        ['195', '196', '197', '198', '199'],
      'jobs':              ['102', '103', '104', '105', '106', '107'],
      'haustiere':         ['130', '131', '132', '133', '134'],
      'familie-kind-baby': ['17', '18', '19', '20', '21', '22'],
      'elektronik':        ['161', '162', '163', '164', '165', '166', '167', '168'],
      'mode-beauty':       ['153', '154', '155', '156', '157'],
      'musik-film-buecher':['73', '74', '75', '76', '77'],
      'heimwerken':        ['88', '89', '90', '91'],
      'freizeit-nachbarschaft': ['185', '186', '187', '188'],
      'dienstleistungen':  ['297', '298', '299', '300', '301'],
      'haus-garten':       ['80', '81', '82', '83', '84', '85', '86', '87'],
      'unterricht-kurse':  ['33', '34', '35'],
      'verschenken':       ['272'],
    };
    const excludedCodes = category.excludeSections.flatMap(
      (s) => sectionToCategoryCodes[s] || []
    );
    if (excludedCodes.length > 0) {
      allAds = allAds.filter((ad) => {
        // Extract category code from URL: /s-anzeige/slug/ID-CATCODE-LOCCODE
        const match = ad.link.match(/\/(\d+)-(\d+)-(\d+)$/);
        if (match) {
          const catCode = match[2];
          return !excludedCodes.includes(catCode);
        }
        return true; // Keep ads we can't parse
      });
    }
  }

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
