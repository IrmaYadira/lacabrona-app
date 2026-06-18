import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  shape: 'circle' | 'square';
}

const COLORS = ['#f59e0b', '#ef4444', '#ffffff', '#fbbf24', '#f97316', '#fde047'];

function generateParticles(count = 45): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * 60, // 20-80% del ancho de pantalla
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 6,
    delay: Math.random() * 0.4,
    duration: 0.9 + Math.random() * 0.7,
    drift: -80 + Math.random() * 160,
    shape: Math.random() > 0.5 ? 'circle' : 'square',
  }));
}

export function useConfetti() {
  const [active, setActive] = useState(false);

  const trigger = () => {
    setActive(true);
    setTimeout(() => setActive(false), 1800);
  };

  return { active, trigger };
}

export default function ConfettiOverlay({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      setParticles(generateParticles());
    } else {
      setParticles([]);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 confetti-particle"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}