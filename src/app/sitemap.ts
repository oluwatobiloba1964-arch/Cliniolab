import type { MetadataRoute } from 'next';
import { categoryService, cmsService, guestService, platformSettingsService, quizService } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

/**
 * Dynamic sitemap - includes individual quiz, blog post, category, and
 * subcategory pages, not just static routes. This is where most organic
 * search traffic actually lands (someone searching a specific clinical
 * topic finds one quiz or one article, not the homepage), so leaving
 * these out means Google can't efficiently discover or index them.
 *
 * Runs server-side at request/build time and queries D1 directly through
 * the normal service layer - same abstraction rules as everywhere else,
 * no raw D1 calls here.
 *
 * Private and paid quizzes are intentionally excluded: private quizzes
 * have no stable public URL worth indexing (their link expires and
 * rotates), and paid quizzes' actual content sits behind a purchase gate,
 * so indexing them wouldn't drive meaningful organic traffic anyway -
 * only free public quizzes are listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/quizzes`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/resources`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/abbreviations`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/jobs`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/scholarships`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/search`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/guest`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/editorial-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/medical-review-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Fail-soft on each dynamic section independently: if one query fails
  // (e.g. D1 binding briefly unavailable), the sitemap still returns the
  // static routes and whatever dynamic sections did succeed, rather than
  // the whole sitemap erroring out to nothing.
  const [categories, subcategories, quizzes, posts, guestSetting, guestItems] = await Promise.all([
    categoryService.listCategories().catch(() => []),
    categoryService.listSubcategories().catch(() => []),
    quizService.listLatestPublicQuizzes(500).catch(() => []),
    cmsService.listPublishedPosts(500).catch(() => []),
    platformSettingsService.getGuestPracticeSetting().catch(() => platformSettingsService.DEFAULT_GUEST_PRACTICE),
    guestService.listGuestItems({ limit: 500 }).catch(() => []),
  ]);

  const guestRoutes: MetadataRoute.Sitemap = guestSetting.includeInSitemap
    ? guestItems.map((item) => ({
        url: `${BASE_URL}${item.href}`,
        lastModified: new Date(item.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.5,
      }))
    : [];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/categories/group/${category.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const subcategoryRoutes: MetadataRoute.Sitemap = subcategories.map((sub) => {
    const parentCategory = categories.find((c) => c.id === sub.categoryId);
    return {
      url: `${BASE_URL}/categories/${sub.slug}${parentCategory ? `?category=${parentCategory.slug}` : ''}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    };
  });

  // Free public quizzes only - see note above on paid/private exclusion.
  const quizRoutes: MetadataRoute.Sitemap = quizzes
    .filter((quiz) => quiz.pricing === 'free')
    .map((quiz) => ({
      url: `${BASE_URL}/quizzes/${quiz.id}`,
      lastModified: new Date(quiz.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const blogCategoryRoutes: MetadataRoute.Sitemap = Array.from(
    new Set(posts.map((p) => p.category).filter((c): c is string => !!c))
  ).map((category) => ({
    url: `${BASE_URL}/blog/category/${encodeURIComponent(category)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...subcategoryRoutes,
    ...quizRoutes,
    ...postRoutes,
    ...blogCategoryRoutes,
    ...guestRoutes,
  ];
}
