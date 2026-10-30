'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function EmailPreferencesPage() {
  const { user, loading } = useAuth();
  const [quizResults, setQuizResults] = useState(true);
  const [newsletter, setNewsletter] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/email-preferences')
      .then((res) => res.json())
      .then((data) => {
        setQuizResults(data.emailQuizResults);
        setNewsletter(data.emailNewsletter);
      });
  }, [user]);

  async function updatePref(key: 'emailQuizResults' | 'emailNewsletter', value: boolean) {
    setSaved(false);
    if (key === 'emailQuizResults') setQuizResults(value);
    else setNewsletter(value);
    await fetch('/api/user/email-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    setSaved(true);
  }

  if (loading) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-800">Login required</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-ink-800">Email preferences</h1>
      <Card className="mt-6 space-y-4 p-6">
        <Toggle
          checked={quizResults}
          onChange={(v) => updatePref('emailQuizResults', v)}
          label="Email me my quiz/exam results"
        />
        <Toggle
          checked={newsletter}
          onChange={(v) => updatePref('emailNewsletter', v)}
          label="Email me new blog posts (newsletter)"
        />
        {saved && <p className="text-xs text-pulse-600">Preferences saved.</p>}
      </Card>
      <p className="mt-4 text-xs text-ink-400">
        Welcome, leaderboard recognition, comment reply, and inactivity emails aren&apos;t
        covered by these toggles. They're tied to account activity, not marketing preferences,
        and can only be turned off sitewide by an admin.
      </p>
    </div>
  );
}
