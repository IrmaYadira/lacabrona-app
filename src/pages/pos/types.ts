export type Area = 'principal' | 'af1' | 'af2' | 'llevar';

export interface Spot {
  id: string;
  area: Area;
  label: string;
  capacity?: number;
}

export interface PosAccountItem {
  id: number;
  account_id: number;
  product_name: string;
  product_id?: string;
  size?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  folio_number: number;
  delivered: boolean;
  customer_delivered?: boolean;
  created_at: string;
}

export interface PosAccount {
  id: number;
  area: string;
  spot: string;
  zona?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: number | null;
  customer_selfie_url?: string | null;
  customer_loyalty_points?: number | null;
  opened_by?: string | null;
  status: 'open' | 'closed';
  notes?: string;
  folio_counter: number;
  created_at: string;
  closed_at?: string;
  updated_at: string;
  pos_account_items?: PosAccountItem[];
}

export type PaymentMethod = 'cash' | 'transfer' | 'credit_card' | 'debit_card';

export const SPOTS: Spot[] = [
  // PRINCIPAL
  { id: 'principal-barra-1', area: 'principal', label: 'Barra 1' },
  { id: 'principal-barra-2', area: 'principal', label: 'Barra 2' },
  { id: 'principal-barra-3', area: 'principal', label: 'Barra 3' },
  { id: 'principal-barra-4', area: 'principal', label: 'Barra 4' },
  { id: 'principal-barra-5', area: 'principal', label: 'Barra 5' },
  { id: 'principal-sillon-1', area: 'principal', label: 'Sillón 1' },
  { id: 'principal-sillon-2', area: 'principal', label: 'Sillón 2' },
  { id: 'principal-periquera-1', area: 'principal', label: 'Periquera 1' },
  { id: 'principal-periquera-2', area: 'principal', label: 'Periquera 2' },
  { id: 'principal-mesa-1', area: 'principal', label: 'Mesa 1' },
  // AF1
  { id: 'af1-mesa-1', area: 'af1', label: 'Mesa 1' },
  { id: 'af1-mesa-2', area: 'af1', label: 'Mesa 2' },
  { id: 'af1-mesa-3', area: 'af1', label: 'Mesa 3' },
  { id: 'af1-mesa-4', area: 'af1', label: 'Mesa 4' },
  // AF2
  { id: 'af2-sillon-1', area: 'af2', label: 'Sillón 1' },
  { id: 'af2-sillon-2', area: 'af2', label: 'Sillón 2' },
  { id: 'af2-sillon-3', area: 'af2', label: 'Sillón 3' },
  { id: 'af2-sillon-4', area: 'af2', label: 'Sillón 4' },
  { id: 'af2-periquera-1', area: 'af2', label: 'Periquera 1' },
  { id: 'af2-periquera-2', area: 'af2', label: 'Periquera 2' },
  { id: 'af2-periquera-3', area: 'af2', label: 'Periquera 3' },
  { id: 'af2-periquera-4', area: 'af2', label: 'Periquera 4' },
  // LLEVAR
  { id: 'llevar-1', area: 'llevar', label: 'Llevar #1' },
  { id: 'llevar-2', area: 'llevar', label: 'Llevar #2' },
  { id: 'llevar-3', area: 'llevar', label: 'Llevar #3' },
  { id: 'llevar-4', area: 'llevar', label: 'Llevar #4' },
  { id: 'llevar-5', area: 'llevar', label: 'Llevar #5' },
  { id: 'llevar-6', area: 'llevar', label: 'Llevar #6' },
];

export const AREA_LABELS: Record<Area, string> = {
  principal: 'Principal',
  af1: 'AF1 - Área de Fumar 1',
  af2: 'AF2 - Área de Fumar 2',
  llevar: 'Para Llevar / Recoger',
};