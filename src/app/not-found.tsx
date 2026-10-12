import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Card className="w-full p-8">
        <p className="font-display text-5xl font-semibold text-pulse-500">404</p>
        <p className="mt-3 font-display text-xl font-semibold text-ink-800">Page not found</p>
        <p className="mt-2 text-sm text-ink-500">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/quizzes">
            <Button variant="secondary">Browse quizzes</Button>
          </Link>
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
