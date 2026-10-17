import type { Metadata } from 'next';
import { cache } from 'react';
import { categoryService, quizService } from '@/lib/db';
import { SubcategoryClient } from './SubcategoryClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';
const PAGE_SIZE = 25;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

const resolveSubcategory = cache(async (slug: string, categorySlug?: string) => {
  if (categorySlug) {
    const category = await categoryService.getCategoryBySlug(categorySlug).catch(() => null);
    if (category) {
      const subcategory = await categoryService.getSubcategoryBySlug(category.id, slug).catch(() => null);
      if (subcategory) return { category, subcategory };
    }
  }
  // Fallback for links without a ?category= param: scan all subcategories.
  const subcategories = await categoryService.listSubcategories();
  const subcategory = subcategories.find((s) => s.slug === slug) ?? null;
  if (!subcategory) return { category: null, subcategory: null };
  const categories = await categoryService.listCategories();
  const category = categories.find((c) => c.id === subcategory.categoryId) ?? null;
  return { category, subcategory };
});

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category: categorySlug } = await searchParams;
  const { category, subcategory } = await resolveSubcategory(slug, categorySlug);

  if (!subcategory) {
    return { title: 'Category | Cliniolab' };
  }

  const title = category
    ? `${subcategory.name} — ${category.name} Quizzes | Cliniolab`
    : `${subcategory.name} Quizzes | Cliniolab`;
  const description = `Practice ${subcategory.name} quizzes${category ? ` in ${category.name}` : ''} on Cliniolab, a nursing and clinical exam practice platform.`;
  const canonical = `${BASE_URL}/categories/${subcategory.slug}${category ? `?category=${category.slug}` : ''}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
    twitter: { card: 'summary', title, description },
  };
}

export default async function SubcategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category: categorySlug } = await searchParams;
  const { category, subcategory } = await resolveSubcategory(slug, categorySlug);

  const initialQuizzes = subcategory
    ? await quizService.listQuizzesBySubcategoryPaginated(subcategory.id, 1, PAGE_SIZE).catch(() => ({
        quizzes: [],
        total: 0,
        page: 1,
        pageSize: PAGE_SIZE,
      }))
    : { quizzes: [], total: 0, page: 1, pageSize: PAGE_SIZE };

  return (
    <SubcategoryClient
      category={category}
      subcategory={subcategory}
      initialQuizzes={initialQuizzes.quizzes}
      initialTotal={initialQuizzes.total}
      pageSize={PAGE_SIZE}
    />
  );
}
