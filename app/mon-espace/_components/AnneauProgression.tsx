/** Anneau de progression (donut) — utilisé par les cartes stats du dashboard
 * bénéficiaire v3 (IGA, ICC). SVG pur, aucune dépendance graphique ajoutée.
 * Halo lumineux + dégradé pour un rendu plus vif (retour utilisateur : le rendu
 * initial (trait fin, couleur plate) paraissait trop terne/froid). */
export function AnneauProgression({
  pourcentage,
  taille = 56,
  epaisseur = 7,
  couleurDebut = 'var(--accent-gold)',
  couleurFin = '#ffd76a',
}: {
  pourcentage: number
  taille?: number
  epaisseur?: number
  couleurDebut?: string
  couleurFin?: string
}) {
  const rayon = (taille - epaisseur) / 2
  const circonference = 2 * Math.PI * rayon
  const offset = circonference * (1 - Math.min(100, Math.max(0, pourcentage)) / 100)
  const idGradient = `anneau-${Math.round(pourcentage * 1000)}-${taille}-${epaisseur}`

  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} style={{ filter: `drop-shadow(0 0 6px ${couleurDebut}66)` }}>
      <defs>
        <linearGradient id={idGradient} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={couleurFin} />
          <stop offset="100%" stopColor={couleurDebut} />
        </linearGradient>
      </defs>
      <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" stroke="var(--border-soft)" strokeWidth={epaisseur} opacity={0.6} />
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={rayon}
        fill="none"
        stroke={`url(#${idGradient})`}
        strokeWidth={epaisseur}
        strokeDasharray={circonference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${taille / 2} ${taille / 2})`}
      />
    </svg>
  )
}
