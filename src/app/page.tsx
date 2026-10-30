import type { Metadata } from 'next';
import { categoryService } from '@/lib/db';
import { HomeClient } from './HomeClient';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cliniolab.com';

const TITLE = 'Cliniolab · Nursing & Clinical Exam Practice';
const DESCRIPTION =
  "Cliniolab brings together student-built quizzes, CBT-style exams, and clinical study notes in one place so you can revise a topic, test yourself on it, and track how you're improving.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function HomePage() {
  // listCategories uses a short warm-runtime cache, avoiding a D1 read on every
  // homepage request while keeping the subject explorer server-rendered.
  const categories = await categoryService.listCategories().catch(() => []);
  return <HomeClient initialCategories={categories} />;
}
