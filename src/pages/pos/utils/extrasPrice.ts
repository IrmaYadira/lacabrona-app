export interface ExtraInfo {
  label: string;
  price: number;
}

export function detectExtras(note: string | null | undefined): ExtraInfo[] {
  if (!note) return [];
  const extras: ExtraInfo[] = [];
  if (note.includes("extra ranch (+$15)") || note.includes("Extra aderezo ranch (+$15)")) {
    extras.push({ label: "Extra ranch", price: 15 });
  }
  if (note.includes("Extra queso (+$10)")) {
    extras.push({ label: "Extra queso", price: 10 });
  }
  if (note.includes("Extra salsa BBQ (+$10)")) {
    extras.push({ label: "Extra salsa BBQ", price: 10 });
  }
  return extras;
}

export function getExtrasTotal(note: string | null | undefined): number {
  return detectExtras(note).reduce((sum, e) => sum + e.price, 0);
}