import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAccountToHistory,
  updateAccountInHistory,
  getAccountHistory,
  clearAccountHistory,
  removeAccountFromHistory,
  type AccountHistoryEntry,
} from '@/hooks/useAccountHistory';

describe('useAccountHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no history', () => {
    expect(getAccountHistory()).toEqual([]);
  });

  it('saves and retrieves account history', () => {
    saveAccountToHistory(
      { id: 100001, spot: 'Mesa 3', area: 'principal', customer_name: 'Edgar', status: 'open' },
      350,
      '/cuenta?id=100001',
    );

    const history = getAccountHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(100001);
    expect(history[0].spot).toBe('Mesa 3');
    expect(history[0].lastTotal).toBe(350);
    expect(history[0].lastStatus).toBe('open');
  });

  it('moves existing entry to top on re-save', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );
    saveAccountToHistory(
      { id: 2, spot: 'Mesa 2', area: 'principal', status: 'open' },
      200,
      '/cuenta?id=2',
    );
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      150,
      '/cuenta?id=1',
    );

    const history = getAccountHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe(1);
    expect(history[0].lastTotal).toBe(150);
    expect(history[1].id).toBe(2);
  });

  it('limits to MAX_ENTRIES (10)', () => {
    for (let i = 1; i <= 15; i++) {
      saveAccountToHistory(
        { id: i, spot: `Mesa ${i}`, area: 'principal', status: 'open' },
        i * 100,
        `/cuenta?id=${i}`,
      );
    }

    const history = getAccountHistory();
    expect(history.length).toBeLessThanOrEqual(10);
    // Most recent should be id 15
    expect(history[0].id).toBe(15);
  });

  it('updateAccountInHistory modifies existing entry', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );

    updateAccountInHistory(1, { lastStatus: 'closed', lastTotal: 150 });

    const history = getAccountHistory();
    expect(history[0].lastStatus).toBe('closed');
    expect(history[0].lastTotal).toBe(150);
  });

  it('updateAccountInHistory does nothing for unknown id', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );

    updateAccountInHistory(999, { lastStatus: 'closed' });

    const history = getAccountHistory();
    expect(history[0].lastStatus).toBe('open');
  });

  it('clearAccountHistory removes all entries', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );
    clearAccountHistory();
    expect(getAccountHistory()).toEqual([]);
  });

  it('removeAccountFromHistory removes specific entry', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );
    saveAccountToHistory(
      { id: 2, spot: 'Mesa 2', area: 'principal', status: 'open' },
      200,
      '/cuenta?id=2',
    );

    removeAccountFromHistory(1);
    const history = getAccountHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(2);
  });

  it('persists across calls (localStorage)', () => {
    saveAccountToHistory(
      { id: 1, spot: 'Mesa 1', area: 'principal', status: 'open' },
      100,
      '/cuenta?id=1',
    );

    // Reading again should get same data from localStorage
    const history = getAccountHistory();
    expect(history[0].id).toBe(1);
    expect(history[0].spot).toBe('Mesa 1');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('lc_account_history', 'not-valid-json');
    const history = getAccountHistory();
    expect(history).toEqual([]);
  });
});