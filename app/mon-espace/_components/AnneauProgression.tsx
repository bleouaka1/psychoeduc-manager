/** Anneau de progression (donut) — utilisé par les cartes stats du dashboard
 * bénéficiaire v3 (IGA, ICC). SVG pur, aucune dépendance graphique ajoutée. */
export function AnneauProgression({ pourcentage, taille = 56, epaisseur = 6 }: { pourcentage: number; taille?: number; epaisseur?: number }) {
  const rayon = (taille - epaisseur) / 2
  const circonference = 2 * Math.PI * rayon
  const offset = circonference * (1 - Math.min(100, Math.max(0, pourcentage)) / 100)

  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
      <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke="var(--border-soft)" strokeWidth={epaisseur} />
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={rayon}
        fill="none"
        stroke="var(--accent-gold)"
        strokeWidth={epaisseur}
        strokeDasharray={circonference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
      />
    </svg>
  )
}
