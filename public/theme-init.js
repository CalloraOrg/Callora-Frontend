// Pre-paint theme resolution to prevent flash of incorrect theme
(function () {
  try {
    let savedTheme = localStorage.getItem('callora-theme');
    try {
      savedTheme = JSON.parse(localStorage.getItem('callora.prefs') || '{}').theme || savedTheme;
    } catch (_) {}
    let theme = 'dark'; // default (matches userPrefs)

    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme = savedTheme;
    } else if (savedTheme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // Fallback to dark if localStorage is not available (e.g., in private browsing)
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
