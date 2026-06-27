import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useActiveAccount,
  getActiveAccount,
  persistActiveAccount,
  clearPersistedAccount,
  type ActiveAccount,
} from '@/hooks/useActiveAccount';

describe('useActiveAccount', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getActiveAccount (pure)', () => {
    it('returns null when no saved account', () => {
      expect(getActiveAccount()).toBeNull();
    });

    it('returns saved account within expiry window', () => {
      persistActiveAccount({
        accountId: 100005,
        spot: 'Mesa 8',
        area: 'principal',
        customerName: 'Laura',
      });

      const saved = getActiveAccount();
      expect(saved).not.toBeNull();
      expect(saved!.accountId).toBe(100005);
      expect(saved!.spot).toBe('Mesa 8');
      expect(saved!.customerName).toBe('Laura');
    });
  });

  describe('persistActiveAccount', () => {
    it('adds timestamp and saves to localStorage', () => {
      const result = persistActiveAccount({
        accountId: 100010,
        spot: 'Barra 1',
        area: 'principal',
      });

      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.accountId).toBe(100010);

      const saved = getActiveAccount();
      expect(saved!.accountId).toBe(100010);
      expect(saved!.timestamp).toBe(result.timestamp);
    });

    it('overwrites previous active account', () => {
      persistActiveAccount({ accountId: 1, spot: 'Mesa 1', area: 'principal' });
      persistActiveAccount({ accountId: 2, spot: 'Mesa 2', area: 'principal' });

      const saved = getActiveAccount();
      expect(saved!.accountId).toBe(2);
    });
  });

  describe('clearPersistedAccount', () => {
    it('removes saved account from localStorage', () => {
      persistActiveAccount({ accountId: 1, spot: 'Mesa 1', area: 'principal' });
      clearPersistedAccount();
      expect(getActiveAccount()).toBeNull();
    });
  });

  describe('useActiveAccount hook', () => {
    it('loads saved account on mount', () => {
      persistActiveAccount({ accountId: 999, spot: 'VIP 1', area: 'principal' });

      const { result } = renderHook(() => useActiveAccount());

      expect(result.current.activeAccount).not.toBeNull();
      expect(result.current.activeAccount!.accountId).toBe(999);
    });

    it('setActiveAccount persists and updates state', () => {
      const { result } = renderHook(() => useActiveAccount());

      act(() => {
        result.current.setActiveAccount({
          accountId: 777,
          spot: 'Sillón 3',
          area: 'principal',
          customerName: 'Carlos',
        });
      });

      expect(result.current.activeAccount!.accountId).toBe(777);
      expect(result.current.activeAccount!.spot).toBe('Sillón 3');

      // Should also persist
      const saved = getActiveAccount();
      expect(saved!.accountId).toBe(777);
    });

    it('clearActiveAccount removes state and localStorage', () => {
      persistActiveAccount({ accountId: 555, spot: 'Mesa 5', area: 'principal' });

      const { result } = renderHook(() => useActiveAccount());

      act(() => { result.current.clearActiveAccount(); });

      expect(result.current.activeAccount).toBeNull();
      expect(getActiveAccount()).toBeNull();
    });

    it('returns null on mount when no saved account', () => {
      const { result } = renderHook(() => useActiveAccount());
      expect(result.current.activeAccount).toBeNull();
    });
  });
});