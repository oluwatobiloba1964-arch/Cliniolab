// File: src/app/admin/page.tsx
import Link from 'next/link';

const groups = [
  {
    eyebrow: 'Learning content',
    title: 'Manage learning materials',
    description: 'Keep quizzes, clinical practice content, resources and supporting study content organized.',
    icon: '▤',
    accent: 'from-sky-500/10 to-cyan-500/5',
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
    icon: '✦',
    accent: 'from-violet-500/10 to-fuchsia-500/5',
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
    icon: '◎',
    accent: 'from-emerald-500/10 to-teal-500/5',
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
    icon: '⚙',
    accent: 'from-amber-500/10 to-orange-500/5',
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

const shortcuts = [
  { href: '/admin/quizzes', icon: '📝', title: 'Quizzes', text: 'Manage question content', tone: 'bg-sky-50 text-sky-700' },
  { href: '/admin/blog', icon: '📚', title: 'Blog', text: 'Manage articles', tone: 'bg-violet-50 text-violet-700' },
  { href: '/admin/reports', icon: '🛡️', title: 'Reports', text: 'Review submitted reports', tone: 'bg-amber-50 text-amber-700' },
  { href: '/admin/flags', icon: '⚙️', title: 'Feature flags', text: 'Manage feature availability', tone: 'bg-emerald-50 text-emerald-700' },
];

export default function AdminOverviewPage() {
  const totalTools = groups.reduce((total, group) => total + group.links.length, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 pb-8 sm:space-y-10">
      <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-ink-900 to-pulse-900 px-5 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 -z-10 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Cliniolab administration
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60">Workspace overview</span>
        </div>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Admin workspace</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              Your central place to manage learning content, the website experience, the community and platform operations.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:self-auto">
            View public site <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
          {[
            { value: String(groups.length).padStart(2, '0'), label: 'Workspace areas' },
            { value: String(totalTools).padStart(2, '0'), label: 'Management tools' },
            { value: '04', label: 'Quick shortcuts' },
            { value: '24/7', label: 'Access to tools' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/[0.06] px-3 py-3 sm:bg-transparent sm:px-0">
              <p className="text-xl font-bold tracking-tight sm:text-2xl">{stat.value}</p>
              <p className="mt-1 text-xs text-white/55">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      <section aria-labelledby="admin-shortcuts-heading">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-pulse-600">Quick access</p>
            <h2 id="admin-shortcuts-heading" className="mt-1 font-display text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">Common tasks</h2>
            <p className="mt-1 text-sm leading-6 text-ink-500">Jump straight into the tools you use most often.</p>
          </div>
          <span className="mt-2 text-xs text-ink-400 sm:mt-0">4 shortcuts</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-pulse-200 hover:shadow-lg hover:shadow-ink-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${item.tone}`} aria-hidden="true">{item.icon}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-ink-400 transition group-hover:bg-pulse-50 group-hover:text-pulse-700" aria-hidden="true">↗</span>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink-900 transition group-hover:text-pulse-700">{item.title}</h3>
              <p className="mt-1 text-sm leading-5 text-ink-500">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="space-y-9 sm:space-y-11">
        {groups.map((group, index) => (
          <section key={group.eyebrow} aria-labelledby={`group-${group.eyebrow.replaceAll(' ', '-')}`}>
            <div className="mb-4 flex items-start gap-3 sm:mb-5">
              <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${group.accent} text-xl text-ink-800 ring-1 ring-ink-100/70`} aria-hidden="true">{group.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-ink-400">{group.eyebrow}</p>
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-semibold text-ink-500">{String(group.links.length).padStart(2, '0')} tools</span>
                </div>
                <h2 id={`group-${group.eyebrow.replaceAll(' ', '-')}`} className="mt-1 font-display text-lg font-bold tracking-tight text-ink-900 sm:text-xl">{group.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">{group.description}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="group flex min-h-[100px] items-center justify-between gap-4 rounded-2xl border border-ink-100/90 bg-white p-4 shadow-sm shadow-ink-900/[0.02] transition duration-200 hover:-translate-y-0.5 hover:border-pulse-200 hover:bg-pulse-50/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 sm:p-5">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-5 text-ink-800 transition group-hover:text-pulse-700">{link.label}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-ink-500">{link.detail}</span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-100 bg-white text-sm text-ink-300 transition group-hover:border-pulse-200 group-hover:bg-pulse-600 group-hover:text-white" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <footer className="flex flex-col gap-2 border-t border-ink-100 pt-5 text-xs leading-5 text-ink-400 sm:flex-row sm:items-center sm:justify-between">
        <p>This overview uses existing navigation only. It does not load new statistics or make additional requests.</p>
        <p className="shrink-0">Cliniolab Admin · {totalTools} tools across {groups.length} areas</p>
      </footer>
    </div>
  );
}
