import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CloseAccountModal from '@/pages/pos/components/CloseAccountModal';
import type { PosAccount, PosAccountItem, PaymentMethod } from '@/pages/pos/types';

// Mock PrintTicketModal
vi.mock('@/pages/pos/components/PrintTicketModal', () => ({
  default: () => <div data-testid="print-ticket-modal">Print Modal</div>,
}));

// Mock extrasPrice
vi.mock('@/pages/pos/utils/extrasPrice', () => ({
  detectExtras: () => [],
}));

const baseItems: PosAccountItem[] = [
  { id: 1, account_id: 100, product_name: 'Michelada Clásica', quantity: 2, unit_price: 65, folio_number: 1, delivered: true, created_at: '2025-01-15T20:00:00Z' },
  { id: 2, account_id: 100, product_name: 'Alitas BBQ', quantity: 1, unit_price: 120, folio_number: 1, delivered: true, created_at: '2025-01-15T20:00:00Z' },
  { id: 3, account_id: 100, product_name: 'Caguama', quantity: 1, unit_price: 55, folio_number: 2, delivered: false, created_at: '2025-01-15T20:30:00Z' },
];

const baseAccount: PosAccount = {
  id: 100,
  area: 'principal',
  spot: 'Mesa 5',
  customer_name: 'Edgar',
  customer_phone: '3312345678',
  status: 'open',
  folio_counter: 2,
  created_at: '2025-01-15T20:00:00Z',
  updated_at: '2025-01-15T20:30:00Z',
  pos_account_items: baseItems,
};

const CARD_FEE_RATE = 0.03;

describe('CloseAccountModal — Payment Calculations', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Subtotal calculation ──

  it('calculates correct subtotal from items', () => {
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    // subtotal = 65*2 + 120 + 55 = 305
    expect(screen.getByText('MXN$305.00')).toBeTruthy();
  });

  // ── Card fee ──

  it('shows no card fee for cash (default)', () => {
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    // Card fee should NOT be shown for cash
    const feeElements = screen.queryAllByText(/Cargo terminal/i);
    expect(feeElements.length).toBe(0);
  });

  it('shows 3% card fee when credit_card selected', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    const cardBtn = screen.getByText('Tarjeta Crédito');
    await user.click(cardBtn);

    // fee = 305 * 0.03 = 9.15
    expect(screen.getByText(/\+MXN\$9\.15/)).toBeTruthy();
  });

  it('shows 3% card fee when debit_card selected', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    const debitBtn = screen.getByText('Tarjeta Débito');
    await user.click(debitBtn);

    // fee = 305 * 0.03 = 9.15
    expect(screen.getByText(/\+MXN\$9\.15/)).toBeTruthy();
  });

  // ── Tip ──

  it('adds tip to total', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    const tipInput = screen.getByPlaceholderText('0.00');
    await user.type(tipInput, '30.50');

    // Total should be 305 + 30.50 = 335.50
    expect(screen.getByText('MXN$335.50')).toBeTruthy();
  });

  // ── Total calculation ──

  it('total = subtotal when cash and no tip', () => {
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    // Default: cash, no tip → total = subtotal = 305
    expect(screen.getByText('MXN$305.00')).toBeTruthy();
  });

  it('total = subtotal + fee + tip for credit card', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    await user.click(screen.getByText('Tarjeta Crédito'));
    const tipInput = screen.getByPlaceholderText('0.00');
    await user.type(tipInput, '20');

    // Total = 305 + 9.15 + 20 = 334.15
    expect(screen.getByText('MXN$334.15')).toBeTruthy();
  });

  // ── Split ──

  it('calculates per-person amount with split', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    // Click the + button twice (from 1 to 3)
    const addBtn = screen.getAllByRole('button').find(b => b.querySelector('.ri-add-line'));
    if (addBtn) {
      await user.click(addBtn);
      await user.click(addBtn);
    }

    // perPerson = 305 / 3 = 101.67
    expect(screen.getByText('MXN$101.67')).toBeTruthy();
  });

  // ── Transfer info ──

  it('shows transfer data when transferencia selected', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    await user.click(screen.getByText('Transferencia'));

    expect(screen.getByText('036320500328209850')).toBeTruthy();
    expect(screen.getByText('Irma Leal')).toBeTruthy();
  });

  // ── Mixed payments ──

  it('enables mixed payment mode', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    const mixedBtn = screen.getByText('Pago Mixto');
    await user.click(mixedBtn);

    // Should show "Faltan: $305.00" since no payments added yet
    expect(screen.getByText(/Faltan: \$305\.00/)).toBeTruthy();
  });

  it('shows overpayment when mixed exceeds total', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    // Enable mixed mode
    await user.click(screen.getByText('Pago Mixto'));

    // Find amount input and type 400
    const amountInput = screen.getByPlaceholderText('305.00');
    await user.type(amountInput, '400');

    // Click add button (the + icon button in the mixed section)
    const addButtons = screen.getAllByRole('button');
    const addPaymentBtn = addButtons.find(b => b.innerHTML.includes('ri-add-line'));
    if (addPaymentBtn) await user.click(addPaymentBtn);

    // Should show overpayment
    expect(screen.getByText(/Sobrepago/)).toBeTruthy();
  });

  // ── Confirm callback ──

  it('calls onConfirm with correct data for cash', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    const confirmBtn = screen.getByText('Cerrar Cuenta');
    await user.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith(
      'cash',
      1,
      305,
      0,
      undefined,
      0,
      undefined,
    );
  });

  it('calls onConfirm with tip and split for card', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    await user.click(screen.getByText('Tarjeta Débito'));

    const tipInput = screen.getByPlaceholderText('0.00');
    await user.type(tipInput, '50');

    // Split to 2
    const addBtn = screen.getAllByRole('button').find(b => b.innerHTML.includes('ri-add-line'));
    if (addBtn) await user.click(addBtn);

    const confirmBtn = screen.getByText('Cerrar Cuenta');
    await user.click(confirmBtn);

    // subtotal=305, fee=9.15, tip=50, total=364.15
    expect(onConfirm).toHaveBeenCalledWith(
      'debit_card',
      2,
      364.15,
      9.15,
      undefined,
      50,
      undefined,
    );
  });

  // ── Print preview button ──

  it('shows print preview button', () => {
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    expect(screen.getByText('Imprimir Ticket Previo')).toBeTruthy();
  });

  // ── CLABE copy ──

  it('copies CLABE to clipboard', async () => {
    const user = userEvent.setup();
    render(
      <CloseAccountModal account={baseAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    await user.click(screen.getByText('Transferencia'));

    // Click the CLABE copy button
    const clabeBtn = screen.getByText('036320500328209850').closest('button');
    if (clabeBtn) await user.click(clabeBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('036320500328209850');
  });

  // ── Empty items handling ──

  it('handles account with no items', () => {
    const emptyAccount = {
      ...baseAccount,
      pos_account_items: [],
    };

    render(
      <CloseAccountModal account={emptyAccount} onClose={onClose} onConfirm={onConfirm} />
    );

    expect(screen.getByText('MXN$0.00')).toBeTruthy();
  });
});