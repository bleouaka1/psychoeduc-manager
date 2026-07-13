/** Radar SVG natif (aucune librairie de graphiques ajoutée, même principe que le
 * recadrage de photo par Canvas natif ailleurs dans le projet). Le nombre de
 * dimensions varie selon le référentiel IGA actif du bénéficiaire (6 à 8) — le
 * radar s'adapte au nombre réel plutôt que de forcer un total fixe. */
/** Motif décoratif affiché tant qu'aucune évaluation IGA n'existe — un octogone en
 * pointillés, sans labels ni polygone de score : ce n'est pas un référentiel réel
 * (aucun total de dimensions n'est présumé), juste une signature visuelle d'attente. */
function RadarVide() {
  const taille = 280
  const centre = taille / 2
  const rayon = 95
  const n = 8
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n
    return { x: centre + rayon * ratio * Math.cos(angle), y: centre + rayon * ratio * Math.sin(angle) }
  }
  const contour = Array.from({ length: n }, (_, i) => point(i, 1))
  const pointsContour = contour.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} className="w-full max-w-[280px] mx-auto">
      {[0.35, 0.65, 1].map((ratio) => {
        const anneau = Array.from({ length: n }, (_, i) => point(i, ratio))
        return (
          <polygon key={ratio} points={anneau.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" className="text-border-soft" strokeWidth={1} opacity={0.6} />
        )
      })}
      {contour.map((p, i) => (
        <line key={i} x1={centre} y1={centre} x2={p.x} y2={p.y} stroke="currentColor" className="text-border-soft" strokeWidth={1} />
      ))}
      <polygon points={pointsContour} fill="none" stroke="currentColor" className="text-accent-gold" strokeWidth={1.4} strokeDasharray="4 5" opacity={0.55} />
      <text x={centre} y={centre - 6} textAnchor="middle" className="fill-text-muted font-data" style={{ fontSize: 26 }}>
        —
      </text>
      <text x={centre} y={centre + 14} textAnchor="middle" className="fill-text-muted font-data uppercase" style={{ fontSize: 10, letterSpacing: '0.08em' }}>
        Aucune évaluation
      </text>
    </svg>
  )
}

export function RadarAutonomie({ dimensions }: { dimensions: { nom: string; score: number }[] }) {
  const taille = 280
  const centre = taille / 2
  const rayon = 95
  const n = dimensions.length

  if (n === 0) {
    return <RadarVide />
  }

  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n
    return { x: centre + rayon * ratio * Math.cos(angle), y: centre + rayon * ratio * Math.sin(angle) }
  }

  const polygonScores = dimensions.map((d, i) => point(i, Math.max(0, Math.min(100, d.score)) / 100))
  const pointsScores = polygonScores.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} className="w-full max-w-[320px] mx-auto">
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const anneau = dimensions.map((_, i) => point(i, ratio))
        return (
          <polygon key={ratio} points={anneau.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" className="text-border-soft" strokeWidth={1} />
        )
      })}

      {dimensions.map((_, i) => {
        const bord = point(i, 1)
        return <line key={i} x1={centre} y1={centre} x2={bord.x} y2={bord.y} stroke="currentColor" className="text-border-soft" strokeWidth={1} />
      })}

      <polygon points={pointsScores} fill="currentColor" className="text-accent-gold/25" stroke="currentColor" strokeWidth={2} />
      <polygon points={pointsScores} fill="none" stroke="currentColor" className="text-accent-gold" strokeWidth={2} />

      {dimensions.map((d, i) => {
        const label = point(i, 1.2)
        const ancrage = Math.abs(label.x - centre) < 8 ? 'middle' : label.x > centre ? 'start' : 'end'
        return (
          <text key={d.nom} x={label.x} y={label.y} textAnchor={ancrage} dominantBaseline="middle" className="fill-text-muted" style={{ fontSize: 9.5 }}>
            {d.nom}
          </text>
        )
      })}
    </svg>
  )
}
