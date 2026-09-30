import type { Metadata } from 'next';
import { cmsService } from '@/lib/db';
import { BlogPostClient } from './BlogPostClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-post metadata, generated server-side so each blog post gets its own
 * title/description/OG tags instead of every post sharing the site-wide
 * default. This is what makes indexed blog URLs actually show meaningful,
 * distinct search snippets rather than identical ones.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await cmsService.getPostBySlug(slug).catch(() => null);

  if (!post) {
    return { title: 'Post not found' };
  }

  // Admin can override the SEO title/description directly (WordPress/Yoast
  // style); falls back to the post excerpt, then an auto-derived excerpt of
  // the content, when not explicitly set, so older posts without SEO fields
  // still work.
  const seoTitle = post.seoTitle || post.title;
  const description =
    post.seoDescription ||
    post.excerpt ||
    post.content.replace(/<[^>]*>/g, ' ').replace(/[#*_>[\]()!-]/g, '').slice(0, 160).trim();

  return {
    title: seoTitle,
    description,
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
    openGraph: {
      title: seoTitle,
      description,
      type: 'article',
      publishedTime: post.createdAt,
      url: `${BASE_URL}/blog/${post.slug}`,
      images: post.featuredImageUrl ? [{ url: post.featuredImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await cmsService.getPostBySlug(slug).catch(() => null);

  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        datePublished: post.createdAt,
        dateModified: post.updatedAt,
        image: post.featuredImageUrl || undefined,
        author: post.authorName
          ? { '@type': 'Person', name: post.authorName, ...(post.authorCredentials ? { honorificSuffix: post.authorCredentials } : {}) }
          : { '@type': 'Organization', name: 'Cliniolab' },
        ...(post.reviewerName
          ? {
              reviewedBy: {
                '@type': 'Person',
                name: post.reviewerName,
                ...(post.reviewerCredentials ? { honorificSuffix: post.reviewerCredentials } : {}),
              },
            }
          : {}),
        publisher: { '@type': 'Organization', name: 'Cliniolab', url: BASE_URL },
        mainEntityOfPage: `${BASE_URL}/blog/${slug}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <BlogPostClient slug={slug} />
    </>
  );
}
