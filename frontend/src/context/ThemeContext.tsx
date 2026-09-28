import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlayTheme, setOverlayTheme] = useState<Theme>('light');

  // Sync dark class on <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setOverlayTheme(nextTheme);
    setIsTransitioning(true);

    // Switch theme state immediately so UI updates seamlessly under overlay
    setTheme(nextTheme);

    // Fade overlay out
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}

      {/* Full-screen transition overlay */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
          isTransitioning ? 'opacity-100' : 'opacity-0'
        } ${overlayTheme === 'dark' ? 'bg-[#0d1a10]' : 'bg-[#f0fdf4]'}`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-4xl shadow-2xl transition-transform duration-300 ${
            overlayTheme === 'dark'
              ? 'bg-[#1a2e1f] text-yellow-300'
              : 'bg-white text-[#166534]'
          }`}>
            {overlayTheme === 'dark' ? '🌙' : '☀️'}
          </div>
          <span className={`text-xl font-bold tracking-wide ${
            overlayTheme === 'dark' ? 'text-[#86efac]' : 'text-[#166534]'
          }`}>
            {overlayTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
        </div>
      </div>
    </ThemeContext.Provider>
  );
};
