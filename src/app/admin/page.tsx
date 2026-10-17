import Link from 'next/link';

const groups = [
  {
    eyebrow: 'Learning content',
    title: 'Manage learning materials',
    description: 'Keep quizzes, clinical practice content, resources and supporting study content organized.',
    links: [
      { href: '/admin/quizzes', label: 'Manage quizzes', detail: 'Question sets and exam content' },
      { href: '/admin/categories', label: 'Manage categories', detail: 'Organize subjects and topics' },
      { href: '/admin/clinical-practice', label: 'Clinical practice', detail: 'Scenarios and practice material' },
      { href: '/admin/resources', label: 'Books and past questions', detail: 'Learning resources' },
      { href: '/admin/abbreviations', label: 'Abbreviations', detail: 'Clinical reference content' },
    ],
  },
  {
    eyebrow: 'Website experience',
    title: 'Shape the Cliniolab experience',
    description: 'Manage public-facing content, homepage elements, settings and learning discovery.',
    links: [
      { href: '/admin/blog', label: 'Blog and articles', detail: 'Published educational content' },
      { href: '/admin/pages', label: 'Site pages', detail: 'Static and informational pages' },
      { href: '/admin/banners', label: 'Banners', detail: 'Promotional and notice placements' },
      { href: '/admin/homepage-video', label: 'Homepage video', detail: 'Homepage media settings' },
      { href: '/admin/related-content', label: 'Related content', detail: 'Help users discover more' },
      { href: '/admin/platform-settings', label: 'Platform settings', detail: 'Guest access, theme and offline options' },
    ],
  },
  {
    eyebrow: 'Community',
    title: 'Support users and contributors',
    description: 'Review user activity and feedback using the management workflows already in place.',
    links: [
      { href: '/admin/users', label: 'Users', detail: 'User management' },
      { href: '/admin/contributors', label: 'Contributors', detail: 'Contributor management' },
      { href: '/admin/scholars', label: 'Scholars', detail: 'Scholar-related management' },
      { href: '/admin/reports', label: 'Reports', detail: 'Reported content and issues' },
      { href: '/admin/feedback', label: 'Feedback', detail: 'Suggestions and user feedback' },
      { href: '/admin/leaderboard', label: 'Leaderboard', detail: 'Community rankings' },
      { href: '/admin/notifications', label: 'Notifications', detail: 'Existing notification tools' },
    ],
  },
  {
    eyebrow: 'Operations',
    title: 'Maintain and configure the platform',
    description: 'Reach the existing controls for analytics, payments, feature availability and maintenance.',
    links: [
      { href: '/admin/analytics', label: 'Analytics', detail: 'Available platform reporting' },
      { href: '/admin/payments', label: 'Payments', detail: 'Payment management' },
      { href: '/admin/flags', label: 'Feature flags', detail: 'Control supported features' },
      { href: '/admin/daily-quiz', label: 'Daily quiz', detail: 'Daily quiz configuration' },
      { href: '/admin/adsense', label: 'Google AdSense', detail: 'Advertising settings' },
      { href: '/admin/cookie-consent', label: 'Cookie consent', detail: 'Consent settings' },
      { href: '/admin/storage', label: 'Storage and cleanup', detail: 'Existing storage tools' },
      { href: '/admin/data-clean', label: 'Data cleanup', detail: 'Existing maintenance tools' },
    ],
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-pulse-900 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Cliniolab administration</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Admin workspace</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              A clearer starting point for managing learning content, the website experience, the community and platform operations.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-10 items-center justify-center self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 sm:self-auto">
            View public site <span className="ml-2" aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section aria-labelledby="admin-shortcuts-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-pulse-600">Quick access</p>
          <h2 id="admin-shortcuts-heading" className="mt-1 font-display text-xl font-semibold text-ink-900">Common tasks</h2>
          <p className="mt-1 text-sm text-ink-500">Open the tools you are most likely to need first.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: '/admin/quizzes', icon: '📝', title: 'Quizzes', text: 'Manage question content' },
            { href: '/admin/blog', icon: '📚', title: 'Blog', text: 'Manage articles' },
            { href: '/admin/reports', icon: '🛡️', title: 'Reports', text: 'Review submitted reports' },
            { href: '/admin/flags', icon: '⚙️', title: 'Feature flags', text: 'Manage feature availability' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-xl border border-ink-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-pulse-200 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pulse-50 text-xl" aria-hidden="true">{item.icon}</span>
              <h3 className="mt-3 text-sm font-semibold text-ink-900 group-hover:text-pulse-700">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-ink-500">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.eyebrow} aria-labelledby={`group-${group.eyebrow.replaceAll(' ', '-')}`}>
            <div className="mb-4 max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{group.eyebrow}</p>
              <h2 id={`group-${group.eyebrow.replaceAll(' ', '-')}`} className="mt-1 font-display text-lg font-semibold text-ink-900 sm:text-xl">{group.title}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-500">{group.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="group flex min-h-24 items-start justify-between gap-3 rounded-xl border border-ink-100 bg-white p-4 transition hover:border-pulse-200 hover:bg-pulse-50/30">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-800 group-hover:text-pulse-700">{link.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-ink-500">{link.detail}</span>
                  </span>
                  <span className="mt-0.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-pulse-600" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="border-t border-ink-100 pt-4 text-xs leading-5 text-ink-400">
        This overview uses existing navigation only. It does not load new statistics or make additional requests.
      </p>
    </div>
  );
}
