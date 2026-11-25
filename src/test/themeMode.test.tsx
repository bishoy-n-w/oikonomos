import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../context/AppContext';

const ThemeTestConsumer: React.FC = () => {
  const { theme, toggleTheme, setTheme } = useApp();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button data-testid="btn-toggle" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="btn-set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="btn-set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
    </div>
  );
};

describe('Dynamic Dark & Light Theme System (v4.7)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  const setupMatchMedia = (matches: boolean) => {
    let changeListener: ((e: { matches: boolean }) => void) | null = null;
    const mql = {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, listener: (e: { matches: boolean }) => void) => {
        if (event === 'change') {
          changeListener = listener;
        }
      }),
      removeEventListener: vi.fn((event: string, listener: (e: { matches: boolean }) => void) => {
        if (event === 'change' && changeListener === listener) {
          changeListener = null;
        }
      }),
      dispatchEvent: vi.fn(),
    };

    window.matchMedia = vi.fn().mockImplementation(() => mql);

    return {
      triggerChange: (newMatches: boolean) => {
        mql.matches = newMatches;
        if (changeListener) {
          act(() => {
            changeListener!({ matches: newMatches });
          });
        }
      },
    };
  };

  it('first-time visit: defaults to dark mode if mobile/system preference is dark', () => {
    setupMatchMedia(true);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // User hasn't made an explicit selection yet
    expect(localStorage.getItem('oikonomos_theme')).toBeNull();
  });

  it('first-time visit: defaults to light mode if mobile/system preference is light', () => {
    setupMatchMedia(false);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('oikonomos_theme')).toBeNull();
  });

  it('prioritizes explicit saved selection in localStorage over system dark mode', () => {
    // System is dark, but user previously selected 'light'
    setupMatchMedia(true);
    localStorage.setItem('oikonomos_theme', 'light');

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('prioritizes explicit saved selection in localStorage over system light mode', () => {
    // System is light, but user previously selected 'dark'
    setupMatchMedia(false);
    localStorage.setItem('oikonomos_theme', 'dark');

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists explicit user toggle from dark to light and updates DOM classes', () => {
    setupMatchMedia(true);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Switch to light mode
    fireEvent.click(screen.getByTestId('btn-toggle'));

    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('oikonomos_theme')).toBe('light');

    // Switch back to dark mode
    fireEvent.click(screen.getByTestId('btn-toggle'));

    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('oikonomos_theme')).toBe('dark');
  });

  it('allows direct setTheme setting with localStorage persistence', () => {
    setupMatchMedia(false);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    fireEvent.click(screen.getByTestId('btn-set-dark'));
    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('oikonomos_theme')).toBe('dark');

    fireEvent.click(screen.getByTestId('btn-set-light'));
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('oikonomos_theme')).toBe('light');
  });

  it('synchronizes with live system media query changes when no preference is saved', () => {
    const { triggerChange } = setupMatchMedia(false);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('theme-val').textContent).toBe('light');

    // System switches to dark mode
    triggerChange(true);
    expect(screen.getByTestId('theme-val').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // System switches back to light mode
    triggerChange(false);
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores system media query changes once an explicit preference is saved', () => {
    const { triggerChange } = setupMatchMedia(false);

    render(
      <AppProvider>
        <ThemeTestConsumer />
      </AppProvider>
    );

    // User explicitly sets light
    fireEvent.click(screen.getByTestId('btn-set-light'));
    expect(localStorage.getItem('oikonomos_theme')).toBe('light');

    // System switches to dark, but user selection must be preserved
    triggerChange(true);
    expect(screen.getByTestId('theme-val').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
