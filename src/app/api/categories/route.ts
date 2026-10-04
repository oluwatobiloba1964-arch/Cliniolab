import { NextResponse } from 'next/server';
import { categoryService } from '@/lib/db';

export async function GET() {
  const [categories, subcategories] = await Promise.all([
    categoryService.listCategories(),
    categoryService.listSubcategories(),
  ]);
  return NextResponse.json(
    { categories, subcategories },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600' } }
  );
}
