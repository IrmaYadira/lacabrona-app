import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaidTicket from '@/pages/cuenta/components/PaidTicket';

const mockItems = [
  { id: 1, product_name: 'Michelada Clásica', quantity: 2, unit_price: 65, folio_number: 1, delivered: true, created_at: '2025-01-15T20:00:00Z' },
  { id: 2, product_name: 'Alitas BBQ', quantity: 1, unit_price: 120, folio_number: 1, delivered: true, created_at: '2025-01-15T20:00:00Z' },
  { id: 3, product_name: 'Caguama', quantity: 1, unit_price: 55, folio_number: 2, delivered: true, created_at: '2025-01-15T20:30:00Z' },
];

const mockPayment = {
  id: 5001,
  payment_method: 'cash',
  subtotal: 305,
  card_fee: 0,
  total: 305,
  split_count: 1,
  mixed_payments: null,
  created_at: '2025-01-15T21:00:00Z',
};

const mockPaymentCard = {
  id: 5002,
  payment_method: 'credit_card',
  subtotal: 305,
  card_fee: 9.15,
  total: 314.15,
  split_count: 2,
  mixed_payments: null,
  created_at: '2025-01-15T21:00:00Z',
};

const mockPaymentMixed = {
  id: 5003,
  payment_method: 'cash',
  subtotal: 500,
  card_fee: 6,
  total: 506,
  split_count: 1,
  mixed_payments: [
    { method: 'cash', amount: 300 },
    { method: 'credit_card', amount: 206 },
  ],
  created_at: '2025-01-15T21:00:00Z',
};

describe('PaidTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ticket header with spot and logo', () => {
    render(
      <PaidTicket
        spot="Mesa 7"
        customerName="María"
        items={mockItems}
        payment={mockPayment}
      />
    );

    expect(screen.getByText('LA CABRONA')).toBeTruthy();
    expect(screen.getByText('Mesa 7')).toBeTruthy();
    expect(screen.getByText('María')).toBeTruthy();
  });

  it('shows ticket number', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPayment} />
    );

    expect(screen.getByText('#5001')).toBeTruthy();
  });

  it('groups items by round (folio)', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPayment} />
    );

    // Should show Ronda #01 and Ronda #02
    expect(screen.getByText(/Ronda #01/i)).toBeTruthy();
    expect(screen.getByText(/Ronda #02/i)).toBeTruthy();
  });

  it('shows correct subtotal and total', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPayment} />
    );

    // subtotal = 65*2 + 120 + 55 = 305
    expect(screen.getByText('$305.00')).toBeTruthy();
  });

  it('shows card fee when present', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPaymentCard} />
    );

    expect(screen.getByText('+$9.15')).toBeTruthy();
  });

  it('shows split count when > 1', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPaymentCard} />
    );

    // split_count = 2, perPerson = 157.08
    expect(screen.getByText('$157.08')).toBeTruthy();
  });

  it('renders mixed payments when present', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPaymentMixed} />
    );

    expect(screen.getByText('Pago Mixto')).toBeTruthy();
    expect(screen.getByText('Transferencia')).toBeTruthy();
    expect(screen.getByText('Tarjeta de Crédito')).toBeTruthy();
  });

  it('renders all action buttons', () => {
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPayment} />
    );

    expect(screen.getByText('Guardar en mi WhatsApp')).toBeTruthy();
    expect(screen.getByText('Enviar al bar por WhatsApp')).toBeTruthy();
    expect(screen.getByText('Guardar como imagen')).toBeTruthy();
    expect(screen.getByText('Copiar ticket como texto')).toBeTruthy();
  });

  it('copies ticket text to clipboard', async () => {
    const user = userEvent.setup();
    render(
      <PaidTicket spot="Mesa 7" items={mockItems} payment={mockPayment} />
    );

    const copyBtn = screen.getByText('Copiar ticket como texto');
    await user.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    // Should show success state
    expect(screen.getByText('¡Ticket copiado al portapapeles!')).toBeTruthy();
  });

  it('handles missing customer name gracefully', () => {
    render(
      <PaidTicket spot="Barra 1" items={mockItems} payment={mockPayment} />
    );

    expect(screen.getByText('Barra 1')).toBeTruthy();
    // Should not show customer name section
  });

  it('formats item with size/notes', () => {
    const itemsWithSize = [
      { id: 1, product_name: 'Michelada', quantity: 1, unit_price: 65, folio_number: 1, size: 'Sin sal', delivered: true, created_at: '2025-01-15T20:00:00Z' },
    ];

    render(
      <PaidTicket spot="Mesa 3" items={itemsWithSize} payment={mockPayment} />
    );

    // Should show the note in parentheses
    expect(screen.getByText(/Sin sal/)).toBeTruthy();
  });
});