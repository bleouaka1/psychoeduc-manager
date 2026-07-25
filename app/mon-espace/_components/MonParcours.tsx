'use client'

import { useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import type { CompetenceLigne } from '@/lib/iccServer'
import { SpeakButton } from './voix/SpeakButton'

const ONGLETS = [
  { id: 'savoirs', label: 'Savoirs' },
  { id: 'savoirFaire', label: 'Savoir-faire' },
  { id: 'savoirEtre', label: 'Savoir-être' },
] as const

type OngletId = (typeof ONGLETS)[number]['id']

/**
 * "Mon parcours" à onglets (dashboard bénéficiaire v3) — remplace l'ancien affichage
 * en 3 colonnes de pourcentages par formation par une liste plate de compétences
 * concrètes, groupée par dimension.
 */
export function MonParcours({ savoirs, savoirFaire, savoirEtre }: { savoirs: CompetenceLigne[]; savoirFaire: CompetenceLigne[]; savoirEtre: CompetenceLigne[] }) {
  const [onglet, setOnglet] = useState<OngletId>('savoirs')
  const lignes = onglet === 'savoirs' ? savoirs : onglet === 'savoirFaire' ? savoirFaire : savoirEtre

  return (
    <div>
      <div className="flex gap-6 border-b border-border-soft mb-4">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`text-[13px] pb-2.5 -mb-px ${onglet === o.id ? 'text-accent-gold font-semibold border-b-2 border-accent-gold' : 'text-text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {lignes.length === 0 ? (
        <p className="text-text-muted text-sm py-6 text-center">Aucune compétence enregistrée dans cette dimension pour l’instant.</p>
      ) : (
        <div className="space-y-2">
          {lignes.map((ligne, i) => (
            <div key={`${ligne.libelle}-${i}`} className="flex items-center gap-3 bg-bg-card border border-border-soft rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-[13px] font-medium">{ligne.libelle}</p>
                {ligne.description && <p className="text-text-muted text-[11.5px] mt-0.5">{ligne.description}</p>}
              </div>
              {ligne.statut === 'valide' ? (
                <span className="font-data text-[10.5px] text-status-ok bg-status-ok-bg border border-status-ok/30 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={11} /> Validé
                </span>
              ) : (
                <span className="font-data text-[10.5px] text-accent-gold bg-accent-gold/10 border border-accent-gold-dim/30 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">
                  <Clock size={11} /> En cours
                </span>
              )}
              <SpeakButton texte={ligne.description ? `${ligne.libelle}. ${ligne.description}` : ligne.libelle} taille={14} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
