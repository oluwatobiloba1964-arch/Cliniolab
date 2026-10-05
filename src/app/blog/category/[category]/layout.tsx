// File: src/app/blog/category/[category]/layout.tsx
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const label = decodeURIComponent(category).replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const title = `${label} Articles | Cliniolab`;
  const description = `Clinical and nursing study articles in ${label} on Cliniolab.`;
  const canonical = `${BASE_URL}/blog/category/${encodeURIComponent(category)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
  };
}

export default function BlogCategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
