import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'
import { estMineur } from '@/lib/cerclesApprentissage'

export default async function IntelligenceEconomiqueBeneficiairePage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  // Version simplifiée (découverte de secteurs) pour un mineur, complète pour un adulte
  // (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §6) — contenu global uniquement (organisation_id
  // is null), curé manuellement par le Fondateur, jamais un système de veille automatisé.
  const estAdulte = !estMineur(dossier.dateNaissance)

  const [{ data: metiers }, { data: analyses }, resteAdulte] = await Promise.all([
    supabase.from('metiers_porteurs').select('id, nom_metier, secteur, niveau_demande').is('organisation_id', null).limit(30),
    supabase.from('analyses_marche').select('id, titre, secteur, date_publication').is('organisation_id', null).order('date_publication', { ascending: false }).limit(20),
    estAdulte
      ? Promise.all([
          supabase.from('opportunites').select('id, titre, type_opportunite, secteur, date_expiration').is('organisation_id', null).order('date_publication', { ascending: false }).limit(20),
          supabase.from('bourses').select('id, titre, organisme, montant, date_limite').is('organisation_id', null).order('created_at', { ascending: false }).limit(20),
          supabase.from('financements').select('id, titre, organisme, montant_max').is('organisation_id', null).order('created_at', { ascending: false }).limit(20),
        ])
      : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }] as const),
  ])
  const [{ data: opportunites }, { data: bourses }, { data: financements }] = resteAdulte

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Explorer</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Intelligence économique</h1>
      <p className="text-text-muted text-sm mb-7">
        {estAdulte ? 'Opportunités, bourses, financements et tendances du marché.' : 'Découvre des secteurs et métiers porteurs pour t’aider à t’orienter.'}
      </p>

      <div className="space-y-5">
        <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
          <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Métiers porteurs</h2>
          {(metiers ?? []).length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">Aucun métier référencé pour le moment.</p>
          ) : (
            <ul className="space-y-2.5">
              {(metiers ?? []).map((m: any) => (
                <li key={m.id} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                  <span className="text-text-primary">{m.nom_metier}</span>
                  <span className="text-text-muted text-[12px]">{m.secteur ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
          <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Analyses de marché</h2>
          {(analyses ?? []).length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">Aucune analyse publiée pour le moment.</p>
          ) : (
            <ul className="space-y-2.5">
              {(analyses ?? []).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                  <span className="text-text-primary">{a.titre}</span>
                  <span className="text-text-muted text-[12px]">{formatter.format(new Date(a.date_publication))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {estAdulte && (
          <>
            <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
              <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Opportunités</h2>
              {(opportunites ?? []).length === 0 ? (
                <p className="text-text-muted text-sm py-4 text-center">Aucune opportunité pour le moment.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(opportunites ?? []).map((o: any) => (
                    <li key={o.id} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                      <span className="text-text-primary">{o.titre}</span>
                      <span className="text-text-muted text-[12px]">{o.secteur ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
              <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Bourses & financements</h2>
              {(bourses ?? []).length === 0 && (financements ?? []).length === 0 ? (
                <p className="text-text-muted text-sm py-4 text-center">Aucune bourse ni financement pour le moment.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(bourses ?? []).map((b: any) => (
                    <li key={`b-${b.id}`} className="flex items-center justify-between text-[13.5px] border-b border-border-soft pb-2.5">
                      <span className="text-text-primary">{b.titre}</span>
                      <span className="text-text-muted text-[12px]">{b.organisme ?? '—'}</span>
                    </li>
                  ))}
                  {(financements ?? []).map((f: any) => (
                    <li key={`f-${f.id}`} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                      <span className="text-text-primary">{f.titre}</span>
                      <span className="text-text-muted text-[12px]">{f.montant_max != null ? `${f.montant_max} FCFA max` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
