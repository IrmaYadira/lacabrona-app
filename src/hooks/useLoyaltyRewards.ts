// ── Configuración central del programa de lealtad ──

export interface RewardTier {
  id: string;
  points: number;       // puntos necesarios
  pesos: number;        // equivalente en pesos
  title: string;
  description: string;
  items: string[];      // lista de lo que incluye
  emoji: string;
  color: string;        // clase tailwind del color principal
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const REWARD_TIERS: RewardTier[] = [
  {
    id: 'tier1',
    points: 10,
    pesos: 1000,
    title: 'Premio Nivel 1',
    description: '¡Primera recompensa!',
    items: [
      '1 Cerveza de medio, michelada de 1 litro o tarro de barril (clara u oscura)',
    ],
    emoji: '🍺',
    color: 'amber',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-400',
  },
  {
    id: 'tier2',
    points: 15,
    pesos: 1500,
    title: 'Premio Nivel 2',
    description: '¡Nivel especial!',
    items: [
      '1 Hamburguesa con papas (gajo o francesa)',
      '1 Cerveza de medio',
    ],
    emoji: '🍔',
    color: 'orange',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-400',
  },
];

// ── Regla de puntos ──
export const PESOS_PER_POINT = 100; // $100 = 1 punto

// ── Helpers ──
export function getTierProgress(points: number) {
  return REWARD_TIERS.map(tier => ({
    ...tier,
    achieved: points >= tier.points,
    progress: Math.min((points / tier.points) * 100, 100),
    remaining: Math.max(tier.points - points, 0),
  }));
}