import { useEffect, useState } from 'react'

const COLORS = ['#00c8ff','#10b981','#f59e0b','#7c3aed','#ef4444','#f0f4ff','#f97316']

interface Particle { id: number; left: number; delay: number; dur: number; color: string; rot: number; size: number }

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.9,
    dur: 1.2 + Math.random() * 1.2, color: COLORS[i % COLORS.length],
    rot: Math.random() * 360, size: 5 + Math.random() * 6,
  }))
}

export default function Confetti({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false)
  const [particles] = useState(() => makeParticles(60))

  useEffect(() => {
    if (!active) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(t)
  }, [active])

  if (!visible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: `rotate(${p.rot}deg)`,
            animation: `confettiFall ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
