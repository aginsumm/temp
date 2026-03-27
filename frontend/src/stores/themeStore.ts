import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'amber' | 'jade';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const themeConfigs = {
  light: {
    primary: '#3b82f6',
    secondary: '#f59e0b',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
  },
  dark: {
    primary: '#60a5fa',
    secondary: '#fbbf24',
    background: '#111827',
    surface: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
  },
  amber: {
    primary: '#d97706',
    secondary: '#92400e',
    background: '#fffbeb',
    surface: '#fef3c7',
    text: '#78350f',
    textSecondary: '#92400e',
    border: '#fcd34d',
  },
  jade: {
    primary: '#059669',
    secondary: '#047857',
    background: '#ecfdf5',
    surface: '#d1fae5',
    text: '#064e3b',
    textSecondary: '#065f46',
    border: '#6ee7b7',
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => {
        const themes: Theme[] = ['light', 'dark', 'amber', 'jade'];
        const currentIndex = themes.indexOf(state.theme);
        return { theme: themes[(currentIndex + 1) % themes.length] };
      }),
    }),
    {
      name: 'theme-storage',
    }
  )
);

export const getThemeConfig = (theme: Theme) => themeConfigs[theme];
