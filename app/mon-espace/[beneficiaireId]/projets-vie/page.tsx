import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { chargerProjetsAvecProgression, chargerFilActivite, chargerObjectifsAvecCompetence } from '@/lib/projetVie'
import { creerProjetVieBeneficiaireAction } from '../actions'

const STATUT_LABEL: Record<string, string> = {
  en_construction: 'En construction',
  valide: 'Validé',
  en_cours: 'En cours',
  atteint: 'Atteint',
  abandonne: 'Abandonné',
}

const STATUT_OBJECTIF_LABEL: Record<string, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  atteint: 'Atteint',
}

export default async function MesProjetsViePage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const [dossiers, projets, fil, objectifs] = await Promise.all([
    chargerDossiersBeneficiaire(supabase),
    chargerProjetsAvecProgression(supabase, beneficiaireId),
    chargerFilActivite(supabase, beneficiaireId),
    chargerObjectifsAvecCompetence(supabase, beneficiaireId),
  ])
  if (!dossiers.find((d) => d.id === beneficiaireId)) notFound()

  const formatterDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">Mes projets de vie</h1>
      <p className="text-text-muted text-sm mb-6">Chaque projet avance à son rythme, avec ses propres jalons.</p>

      <form action={creerProjetVieBeneficiaireAction.bind(null, beneficiaireId)} className="bg-bg-card border border-border-soft rounded-2xl p-5 mb-6 flex flex-wrap gap-2.5">
        <input
          name="titre"
          required
          placeholder="Nom du nouveau projet"
          className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
        <input
          name="description"
          placeholder="Description (optionnel)"
          className="flex-1 min-w-[200px] bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold-dim"
        />
        <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
          Créer un projet
        </button>
      </form>

      {projets.length === 0 ? (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-10 text-center mb-6">
          <p className="text-text-muted text-sm">Aucun projet de vie pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {projets.map((p) => (
            <div key={p.id} className="bg-bg-card border border-border-soft rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary font-medium">{p.titre}</span>
                <span className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full">{STATUT_LABEL[p.statut] ?? p.statut}</span>
              </div>
              {p.description && <p className="text-text-muted text-[12.5px] mb-2">{p.description}</p>}
              {p.progression != null && (
                <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-accent-gold to-accent-gold-dim rounded-full" style={{ width: `${p.progression}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {objectifs.length > 0 && (
        <div className="bg-bg-card border border-border-soft rounded-2xl p-6 mb-6">
          <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">Mes objectifs</h2>
          <div className="space-y-3">
            {objectifs.map((o) => (
              <div key={o.id} className="border-b border-border-soft/60 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="text-text-primary text-[13.5px] font-medium">{o.titre}</span>
                  <span className="text-[11px] bg-bg-surface border border-border-soft text-text-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                    {STATUT_OBJECTIF_LABEL[o.statut] ?? o.statut}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-text-muted">
                  {o.dateCible && <span>Échéance : {formatterDate.format(new Date(o.dateCible))}</span>}
                  {o.competenceLibelle && <span className="text-accent-gold">Compétence liée : {o.competenceLibelle}</span>}
                </div>
                {o.competenceLibelle && o.statut !== 'atteint' && (
                  <Link href={`/mon-espace/${beneficiaireId}/revisions`} className="text-accent-gold text-[11.5px] mt-1 inline-block hover:underline">
                    Réviser pour progresser →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-border-soft rounded-2xl p-6">
        <h2 className="font-display font-medium text-[16.5px] text-text-primary mb-4">Fil d'activité</h2>
        {fil.length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Rien à afficher pour l'instant.</p>
        ) : (
          <ul className="space-y-3">
            {fil.map((e, i) => (
              <li key={i} className="text-[13px] text-text-primary border-b border-border-soft/60 last:border-0 pb-3">
                {e.message}
                <p className="text-text-muted text-[11px] mt-0.5">
                  {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(e.date))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
