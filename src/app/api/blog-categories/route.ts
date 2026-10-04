import { NextResponse } from 'next/server';
import { blogCategoryService } from '@/lib/db';

// Public read-only endpoint. Returns the fixed 12 top-level categories.
// The admin blog editor's main category dropdown fetches from here.
export async function GET() {
  const categories = await blogCategoryService.listBlogCategories();
  return NextResponse.json(
    { categories },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' } }
  );
}
