/**
 * BluetoothPrinterContext
 * Singleton compartido del hook useBluetoothPrinter para toda la vista de cuenta.
 * Así PrintTicketModal y YaSabeMenu comparten la misma conexión BT.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useBluetoothPrinter } from '../hooks/useBluetoothPrinter';
import type { BtStatus, EscPosTicketData } from '../hooks/useBluetoothPrinter';

interface BluetoothPrinterContextValue {
  status: BtStatus;
  deviceName: string | null;
  errorMsg: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  print: (data: EscPosTicketData) => Promise<void>;
  isSupported: boolean;
  isConnected: boolean;
}

const BluetoothPrinterContext = createContext<BluetoothPrinterContextValue | null>(null);

export function BluetoothPrinterProvider({ children }: { children: ReactNode }) {
  const bt = useBluetoothPrinter();
  const isConnected = bt.status === 'connected' || bt.status === 'printing' || bt.status === 'success';
  return (
    <BluetoothPrinterContext.Provider value={{ ...bt, isConnected }}>
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

export function useBluetoothPrinterContext(): BluetoothPrinterContextValue {
  const ctx = useContext(BluetoothPrinterContext);
  if (!ctx) throw new Error('useBluetoothPrinterContext must be used inside BluetoothPrinterProvider');
  return ctx;
}