import type { Metadata } from 'next';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdSenseLoader } from '@/components/layout/AdSenseLoader';
import { Providers } from './providers';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { platformSettingsService } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Cliniolab – Nursing & Clinical Exam Practice',
    template: '%s | Cliniolab',
  },
  description:
    'Cliniolab is a nursing and clinical education platform for quizzes, timed exams, and study content across anatomy, pharmacology, nursing practice, and board exam prep.',
  keywords: [
    'nursing exam practice',
    'NCLEX practice questions',
    'Nigeria nursing council exam prep',
    'clinical exams',
    'medical MCQ',
    'nursing quiz',
    'cliniolab',
  ],
  authors: [{ name: 'Cliniolab' }],
  creator: 'Cliniolab',
  publisher: 'Cliniolab',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Cliniolab',
    title: 'Cliniolab – Nursing & Clinical Exam Practice',
    description:
      'Quizzes, timed exams, and study content for nursing and clinical students. Public and private quizzes, leaderboards, and progress tracking.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Cliniolab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cliniolab – Nursing & Clinical Exam Practice',
    description: 'Quizzes, timed exams, and study content for nursing and clinical students.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: BASE_URL },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cliniolab',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  themeColor: '#0B1F2E',
};

// All data comes from D1 via the Cloudflare context, which only exists at
// request time. Render every route dynamically so nothing hits the database
// during `next build` prerendering.
export const dynamic = 'force-dynamic';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Cliniolab',
  url: BASE_URL,
  description:
    'Nursing and clinical education platform with quizzes, timed exams, categories spanning core sciences, nursing practice, clinical specialties, and exam prep.',
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  audience: { '@type': 'Audience', audienceType: 'Nursing and Clinical Students' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeSetting = await platformSettingsService.getThemeSetting().catch(() => platformSettingsService.DEFAULT_THEME);
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeScript serverDefault={themeSetting.defaultTheme} />
        <AdSenseLoader />
      </head>
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
