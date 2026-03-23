/**
 * Category configuration with persistent storage via Vercel KV.
 * Falls back to in-memory storage if KV is not configured.
 */

import { kv } from '@vercel/kv';

const KV_KEY = 'kleinanzeigen:categories';

// Each section has a URL slug and a category code for the search suffix
export const KLEINANZEIGEN_SECTIONS: Record<string, { slug: string; code: string }> = {
  'alle':              { slug: '',                       code: '' },
  'dienstleistungen':  { slug: 's-dienstleistungen',    code: 'c297' },
  'haus-garten':       { slug: 's-haus-garten',         code: 'c80'  },
  'elektronik':        { slug: 's-elektronik',           code: 'c161' },
  'auto-rad-boot':     { slug: 's-autos',               code: 'c216' },
  'immobilien':        { slug: 's-immobilien',           code: 'c195' },
  'jobs':              { slug: 's-jobs',                 code: 'c102' },
  'familie-kind-baby': { slug: 's-familie-kind-baby',    code: 'c17'  },
  'freizeit-nachbarschaft': { slug: 's-freizeit-nachbarschaft', code: 'c185' },
  'heimwerken':        { slug: 's-heimwerken',           code: 'c88'  },
  'musik-film-buecher':{ slug: 's-musik-film-buecher',  code: 'c73'  },
  'mode-beauty':       { slug: 's-mode-beauty',          code: 'c153' },
  'haustiere':         { slug: 's-haustiere',            code: 'c130' },
  'unterricht-kurse':  { slug: 's-unterricht-kurse',     code: 'c33'  },
  'verschenken':       { slug: 's-zu-verschenken',       code: 'c272' },
};

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  radius: number;
  enabled: boolean;
  excludeTerms: string[];
  kleinanzeigenSection: string;
  excludeSections: string[];
  searchType: string;
  offerType: string;
}

// Default categories
export const defaultCategories: Category[] = [
  {
    id: 'klimaanlagen',
    name: 'Klimaanlagen',
    keywords: [
      'Klimaanlage',
      'Split Klimaanlage',
      'Klimaanlage Montage',
      'Klimaanlage Installation',
      'Wärmepumpe',
    ],
    location: '46286',
    radius: 50,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
    kleinanzeigenSection: 'alle',
    excludeSections: ['auto-rad-boot'],
    searchType: 'anbieter:privat',
    offerType: 'anzeige:gesuche',
  },
  {
    id: 'photovoltaik',
    name: 'Photovoltaik',
    keywords: [
      'Photovoltaik',
      'Solaranlage',
      'PV Anlage',
      'Solar Installation',
      'Solarpanel',
      'Balkonkraftwerk',
    ],
    location: '46286',
    radius: 100,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
    kleinanzeigenSection: 'alle',
    excludeSections: ['auto-rad-boot'],
    searchType: 'anbieter:privat',
    offerType: 'anzeige:gesuche',
  },
];

// Check if Vercel KV is configured
function isKvAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// In-memory fallback (used when KV is not configured)
let memoryCategories: Category[] = [...defaultCategories];

/**
 * Get all categories from persistent storage (KV) or memory fallback.
 */
export async function getCategories(): Promise<Category[]> {
  if (isKvAvailable()) {
    try {
      const stored = await kv.get<Category[]>(KV_KEY);
      if (stored && stored.length > 0) return stored;
      // First run: save defaults to KV
      await kv.set(KV_KEY, defaultCategories);
      return defaultCategories;
    } catch {
      // KV error - fall back to memory
    }
  }
  return memoryCategories;
}

/**
 * Get only enabled categories.
 */
export async function getEnabledCategories(): Promise<Category[]> {
  const cats = await getCategories();
  return cats.filter((c) => c.enabled);
}

/**
 * Get a single category by ID.
 */
export async function getCategoryById(id: string): Promise<Category | undefined> {
  const cats = await getCategories();
  return cats.find((c) => c.id === id);
}

/**
 * Replace all categories.
 */
export async function setCategories(updated: Category[]): Promise<void> {
  if (isKvAvailable()) {
    try {
      await kv.set(KV_KEY, updated);
    } catch { /* fall through to memory */ }
  }
  memoryCategories = updated;
}

/**
 * Add a new category.
 */
export async function addCategory(cat: Category): Promise<void> {
  const cats = await getCategories();
  cats.push(cat);
  await setCategories(cats);
}

/**
 * Update an existing category.
 */
export async function updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
  const cats = await getCategories();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cats[idx] = { ...cats[idx], ...updates };
  await setCategories(cats);
  return true;
}

/**
 * Delete a category.
 */
export async function deleteCategory(id: string): Promise<boolean> {
  const cats = await getCategories();
  const filtered = cats.filter((c) => c.id !== id);
  if (filtered.length === cats.length) return false;
  await setCategories(filtered);
  return true;
}
