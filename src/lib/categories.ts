/**
 * Category configuration with multiple search keywords per category.
 * The admin panel reads/writes this via the /api/admin/categories endpoint.
 * On Vercel, this is stored in-memory (resets on cold start) with a JSON file fallback.
 */

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  location: string;      // Postal code
  radius: number;        // km
  enabled: boolean;
  excludeTerms: string[];
}

// Default categories - these get loaded on first run
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
      'Klima',
    ],
    location: '46286',
    radius: 50,
    enabled: true,
    excludeTerms: ['Praktikant', 'Verstärkung', 'Festanstellung'],
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
  },
];

// In-memory store (persists across requests within the same serverless instance)
let categories: Category[] = [...defaultCategories];

export function getCategories(): Category[] {
  return categories;
}

export function getEnabledCategories(): Category[] {
  return categories.filter((c) => c.enabled);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function setCategories(updated: Category[]): void {
  categories = updated;
}

export function addCategory(cat: Category): void {
  categories.push(cat);
}

export function updateCategory(id: string, updates: Partial<Category>): boolean {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  categories[idx] = { ...categories[idx], ...updates };
  return true;
}

export function deleteCategory(id: string): boolean {
  const before = categories.length;
  categories = categories.filter((c) => c.id !== id);
  return categories.length < before;
}
