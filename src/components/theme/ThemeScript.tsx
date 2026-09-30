/**
 * Runs before paint (blocking inline script in <head>) so the page never
 * flashes the wrong theme. Reads the saved choice from localStorage,
 * falling back to the admin's default and then the OS preference.
 */
export function ThemeScript({ serverDefault }: { serverDefault: 'system' | 'light' | 'dark' }) {
  const code = `
(function() {
  try {
    var KEY = 'cl-theme';
    var stored = window.localStorage.getItem(KEY);
    var mode = stored || ${JSON.stringify(serverDefault)};
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
