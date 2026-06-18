import { createContext, useContext, type ReactNode } from 'react';
import { usePausedProducts } from '@/hooks/usePausedProducts';

interface PausedContextType {
  isPaused: (id: string) => boolean;
  paused: Set<string>;
}

const PausedContext = createContext<PausedContextType>({
  isPaused: () => false,
  paused: new Set(),
});

export function PausedProvider({ children }: { children: ReactNode }) {
  const { isPaused, paused } = usePausedProducts();
  return (
    <PausedContext.Provider value={{ isPaused, paused }}>
      {children}
    </PausedContext.Provider>
  );
}

export function usePaused() {
  return useContext(PausedContext);
}