import { useState, useEffect, useCallback } from 'react';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  lastUsed: number;
}

const STORAGE_KEY = 'lc_customer_profiles';
const ACTIVE_KEY = 'lc_active_customer_id';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadProfiles(): CustomerProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown) =>
        p &&
        typeof (p as CustomerProfile).name === 'string' &&
        typeof (p as CustomerProfile).phone === 'string'
    ) as CustomerProfile[];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: CustomerProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.slice(0, 10)));
  } catch (e) {
    console.warn('[PersistentCustomer] saveProfiles failed:', e);
  }
}

export function getCustomerProfiles(): CustomerProfile[] {
  return loadProfiles();
}

export function getActiveCustomer(): CustomerProfile | null {
  const profiles = loadProfiles();
  const activeId = localStorage.getItem(ACTIVE_KEY);
  if (activeId) {
    return profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  }
  return profiles[0] ?? null;
}

export function saveCustomerProfile(name: string, phone: string): CustomerProfile {
  const profiles = loadProfiles();
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const now = Date.now();

  const existingIdx = profiles.findIndex((p) => p.phone === trimmedPhone);
  let updated: CustomerProfile;

  if (existingIdx >= 0) {
    updated = {
      ...profiles[existingIdx],
      name: trimmedName,
      lastUsed: now,
    };
    profiles.splice(existingIdx, 1);
  } else {
    updated = {
      id: generateId(),
      name: trimmedName,
      phone: trimmedPhone,
      createdAt: new Date().toISOString(),
      lastUsed: now,
    };
  }

  const newProfiles = [updated, ...profiles].slice(0, 10);
  saveProfiles(newProfiles);
  localStorage.setItem(ACTIVE_KEY, updated.id);
  return updated;
}

export function setActiveCustomerByPhone(phone: string): CustomerProfile | null {
  const profiles = loadProfiles();
  const found = profiles.find((p) => p.phone === phone.trim());
  if (found) {
    localStorage.setItem(ACTIVE_KEY, found.id);
    return found;
  }
  return null;
}

export function clearActiveCustomer() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function usePersistentCustomer() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const active = getActiveCustomer();
    setProfile(active);
    setLoading(false);
  }, []);

  const saveCustomer = useCallback((name: string, phone: string) => {
    const updated = saveCustomerProfile(name, phone);
    setProfile(updated);
  }, []);

  const setActiveByPhone = useCallback((phone: string) => {
    const found = setActiveCustomerByPhone(phone);
    setProfile(found);
  }, []);

  const clearActive = useCallback(() => {
    clearActiveCustomer();
    setProfile(null);
  }, []);

  return {
    profile,
    loading,
    saveCustomer,
    setActiveByPhone,
    clearActive,
  };
}