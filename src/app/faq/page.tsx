import { StaticPageView } from '@/components/cms/StaticPageView';

export const revalidate = 3600;

export default function FaqPage() {
  return <StaticPageView pageId="faq" fallbackTitle="Frequently Asked Questions" />;
}
