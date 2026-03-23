/**
 * Admin API for managing categories.
 *
 * GET    /api/admin/categories           - List all categories
 * POST   /api/admin/categories           - Add new category
 * PUT    /api/admin/categories?id=xxx    - Update category
 * DELETE /api/admin/categories?id=xxx    - Delete category
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  Category,
} from '@/lib/categories';
import { clearCache } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

// Simple admin password check (set via environment variable)
function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (!authHeader) return false;
  // Expect: "Bearer <password>"
  const token = authHeader.replace('Bearer ', '');
  return token === adminPass;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ categories: getCategories() });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, keywords, location, radius, excludeTerms } = body;

    if (!name || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one keyword are required' },
        { status: 400 }
      );
    }

    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, '-')
      .replace(/^-|-$/g, '');

    const newCat: Category = {
      id,
      name,
      keywords,
      location: location || '46286',
      radius: radius || 50,
      enabled: true,
      excludeTerms: excludeTerms || ['Praktikant', 'Verstärkung', 'Festanstellung'],
    };

    addCategory(newCat);
    return NextResponse.json({ success: true, category: newCat }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
  }

  try {
    const updates = await req.json();
    const success = updateCategory(id, updates);

    if (!success) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Clear cache so new settings take effect
    clearCache(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
  }

  const success = deleteCategory(id);
  if (!success) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  clearCache(id);
  return NextResponse.json({ success: true });
}
