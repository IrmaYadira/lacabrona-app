import { useState, useEffect, useCallback } from 'react';

export interface ActiveAccount {
  accountId: number;
  spot: string;
  area?: string;
  customerName?: string;
  customerPhone?: string;
  timestamp: number;
}

const STORAGE_KEY = 'lc_active_account';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

function loadActiveAccount(): ActiveAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveAccount;
    if (Date.now() - parsed.timestamp > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveActiveAccount(account: ActiveAccount) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // ignore storage errors
  }
}

export function getActiveAccount(): ActiveAccount | null {
  return loadActiveAccount();
}

export function persistActiveAccount(account: Omit<ActiveAccount, 'timestamp'>) {
  const withTimestamp: ActiveAccount = { ...account, timestamp: Date.now() };
  saveActiveAccount(withTimestamp);
  return withTimestamp;
}

export function clearPersistedAccount() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useActiveAccount() {
  const [activeAccount, setActiveAccountState] = useState<ActiveAccount | null>(null);

  useEffect(() => {
    setActiveAccountState(loadActiveAccount());
  }, []);

  const setActiveAccount = useCallback((account: Omit<ActiveAccount, 'timestamp'>) => {
    const withTimestamp = persistActiveAccount(account);
    setActiveAccountState(withTimestamp);
  }, []);

  const clearActiveAccount = useCallback(() => {
    clearPersistedAccount();
    setActiveAccountState(null);
  }, []);

  return {
    activeAccount,
    setActiveAccount,
    clearActiveAccount,
  };
}