// File: src/app/search/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search | Cliniolab',
  description: 'Search Cliniolab quizzes, clinical articles, and study resources.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
