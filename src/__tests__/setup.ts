import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ── Mock Supabase client ──
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  channel: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/pages/pos/supabasePos', () => ({
  supabasePos: mockSupabase,
}));

// ── Mock import.meta.env ──
vi.stubGlobal('import', { meta: { env: {} } });

// ── Mock window.matchMedia ──
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── Mock AudioContext ──
class MockAudioContext {
  state = 'running';
  currentTime = 0;
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  resume() { return Promise.resolve(); }
  get destination() { return {}; }
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('webkitAudioContext', MockAudioContext);

// ── Mock IntersectionObserver ──
vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

// ── Mock scrollIntoView ──
Element.prototype.scrollIntoView = vi.fn();

// ── Mock clipboard ──
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// ── Export mocks for reuse in tests ──
export { mockSupabase };