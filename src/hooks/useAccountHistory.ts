/**
 * useAccountHistory
 * Guarda y recupera el historial de cuentas visitadas por el cliente
 * usando localStorage. Máximo 10 cuentas recientes.
 */

const STORAGE_KEY = 'lc_account_history';
const MAX_ENTRIES = 10;

export interface AccountHistoryEntry {
  id: number;
  spot: string;
  area: string;
  customer_name?: string;
  /** URL completa para volver a la cuenta */
  url: string;
  /** Fecha en que se visitó por primera vez */
  firstSeen: string;
  /** Fecha de la última visita */
  lastSeen: string;
  /** Total al momento de guardar */
  lastTotal: number;
  /** Status al momento de guardar */
  lastStatus: 'open' | 'closed';
}

function readHistory(): AccountHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AccountHistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(entries: AccountHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (e) {
    console.warn('[AccountHistory] writeHistory failed:', e);
  }
}

export function saveAccountToHistory(
  account: {
    id: number;
    spot: string;
    area: string;
    customer_name?: string;
    status: 'open' | 'closed';
  },
  total: number,
  currentUrl: string,
): void {
  const history = readHistory();
  const now = new Date().toISOString();

  const existing = history.findIndex(e => e.id === account.id);
  const entry: AccountHistoryEntry = {
    id: account.id,
    spot: account.spot,
    area: account.area,
    customer_name: account.customer_name,
    url: currentUrl,
    firstSeen: existing >= 0 ? history[existing].firstSeen : now,
    lastSeen: now,
    lastTotal: total,
    lastStatus: account.status,
  };

  if (existing >= 0) {
    history.splice(existing, 1);
  }
  // Insertar al inicio (más reciente primero)
  history.unshift(entry);
  writeHistory(history);
}

export function updateAccountInHistory(
  accountId: number,
  updates: Partial<Pick<AccountHistoryEntry, 'lastTotal' | 'lastStatus' | 'lastSeen'>>,
): void {
  const history = readHistory();
  const idx = history.findIndex(e => e.id === accountId);
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...updates };
    writeHistory(history);
  }
}

export function getAccountHistory(): AccountHistoryEntry[] {
  return readHistory();
}

export function clearAccountHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[AccountHistory] clearAccountHistory failed:', e);
  }
}

export function removeAccountFromHistory(accountId: number): void {
  const history = readHistory();
  const filtered = history.filter(e => e.id !== accountId);
  writeHistory(filtered);
}