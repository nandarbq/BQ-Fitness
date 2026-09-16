(function () {
  const stored = localStorage.getItem('bq_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(initial);

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('bq_theme', next);
    });
  });

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', mode === 'dark' ? '#0E0A0A' : '#B3122A');
    const sun = document.getElementById('iconSun');
    const moon = document.getElementById('iconMoon');
    if (sun && moon) {
      sun.style.display = mode === 'dark' ? 'none' : 'block';
      moon.style.display = mode === 'dark' ? 'block' : 'none';
    }
  }
})();
