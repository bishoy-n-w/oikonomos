import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { MobileViewToggle } from '../components/common/MobileViewToggle';
import { t } from '../services/i18n';

const TestConsumer: React.FC = () => {
  const { mobileViewMode, setMobileViewMode } = useApp();
  return (
    <div>
      <span data-testid="mode-indicator">{mobileViewMode}</span>
      <button onClick={() => setMobileViewMode('list')} data-testid="btn-set-list">
        Set List
      </button>
      <button onClick={() => setMobileViewMode('tiles')} data-testid="btn-set-tiles">
        Set Tiles
      </button>
      <MobileViewToggle />
    </div>
  );
};

describe('Mobile View Mode Architecture & Switcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides bilingual translations for view_tiles and view_list', () => {
    expect(t('view_tiles', 'en')).toBe('Tiles');
    expect(t('view_list', 'en')).toBe('List');
    expect(t('view_tiles', 'ar')).toBe('بطاقات');
    expect(t('view_list', 'ar')).toBe('قائمة');
  });

  it('provides bilingual translations for real-world ministry quick filters', () => {
    expect(t('filter_all', 'en')).toBe('All');
    expect(t('filter_empty', 'en')).toBe('Empty / Unspecified');
    expect(t('filter_needs_care', 'en')).toBe('Needs Follow-up');
    expect(t('filter_birthdays_month', 'en')).toBe('Birthdays');
    expect(t('filter_unassigned', 'en')).toBe('Unassigned');
    expect(t('filter_missing_phone', 'en')).toBe('Missing Phone');

    expect(t('filter_all', 'ar')).toBe('الكل');
    expect(t('filter_empty', 'ar')).toBe('فارغ / غير مسجل');
    expect(t('filter_needs_care', 'ar')).toBe('يحتاج افتقاد');
    expect(t('filter_birthdays_month', 'ar')).toBe('أعياد ميلاد الشهر');
    expect(t('filter_unassigned', 'ar')).toBe('غير مسكّن');
    expect(t('filter_missing_phone', 'ar')).toBe('بدون هاتف');
  });

  it('defaults mobileViewMode to "tiles"', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('mode-indicator').textContent).toBe('tiles');
  });

  it('loads mobileViewMode from localStorage if present', () => {
    localStorage.setItem('oikonomos_mobile_view_mode', 'list');

    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('mode-indicator').textContent).toBe('list');
  });

  it('persists mode change to localStorage and updates context state', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    const setListBtn = screen.getByTestId('btn-set-list');
    fireEvent.click(setListBtn);

    expect(screen.getByTestId('mode-indicator').textContent).toBe('list');
    expect(localStorage.getItem('oikonomos_mobile_view_mode')).toBe('list');

    const setTilesBtn = screen.getByTestId('btn-set-tiles');
    fireEvent.click(setTilesBtn);

    expect(screen.getByTestId('mode-indicator').textContent).toBe('tiles');
    expect(localStorage.getItem('oikonomos_mobile_view_mode')).toBe('tiles');
  });

  it('MobileViewToggle interacts correctly and switches modes', () => {
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    // Initial state is tiles
    expect(screen.getByTestId('mode-indicator').textContent).toBe('tiles');

    // Click list button inside MobileViewToggle (aria-label="List")
    const listToggleBtn = screen.getByLabelText('List');
    fireEvent.click(listToggleBtn);

    expect(screen.getByTestId('mode-indicator').textContent).toBe('list');
    expect(localStorage.getItem('oikonomos_mobile_view_mode')).toBe('list');

    // Click tiles button inside MobileViewToggle (aria-label="Tiles")
    const tilesToggleBtn = screen.getByLabelText('Tiles');
    fireEvent.click(tilesToggleBtn);

    expect(screen.getByTestId('mode-indicator').textContent).toBe('tiles');
    expect(localStorage.getItem('oikonomos_mobile_view_mode')).toBe('tiles');
  });
});
