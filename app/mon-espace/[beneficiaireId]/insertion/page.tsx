import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { chargerDossiersBeneficiaire } from '@/lib/beneficiaireDashboard'

const STATUT_LABEL: Record<string, string> = { soumise: 'Soumise', en_cours: 'En cours', acceptee: 'Acceptée', refusee: 'Refusée' }

export default async function InsertionBeneficiairePage({ params }: { params: Promise<{ beneficiaireId: string }> }) {
  const { beneficiaireId } = await params
  const supabase = await createClient()

  const dossiers = await chargerDossiersBeneficiaire(supabase)
  const dossier = dossiers.find((d) => d.id === beneficiaireId)
  if (!dossier) notFound()

  const [{ data: offres }, { data: candidatures }] = await Promise.all([
    supabase
      .from('offres_emploi')
      .select('id, titre, type_contrat, lieu, salaire_propose, entreprises_partenaires(nom)')
      .eq('organisation_id', dossier.organisationId)
      .eq('statut', 'ouverte')
      .order('date_publication', { ascending: false })
      .limit(30),
    supabase
      .from('candidatures')
      .select('id, statut, date_candidature, offres_emploi(titre)')
      .eq('beneficiaire_id', beneficiaireId)
      .order('date_candidature', { ascending: false }),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <p className="font-data text-[11px] tracking-[0.15em] text-accent-gold uppercase mb-2.5">Explorer</p>
      <h1 className="font-cinzel font-semibold text-3xl text-text-primary mb-1">Insertion professionnelle</h1>
      <p className="text-text-muted text-sm mb-7">Offres publiées par ta structure et suivi de tes candidatures.</p>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6 mb-6">
        <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Mes candidatures</h2>
        {(candidatures ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">
            Aucune candidature enregistrée pour le moment. Parles-en à ton formateur ou éducateur référent.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {(candidatures ?? []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between text-[13.5px] border-b border-border-soft last:border-0 pb-2.5 last:pb-0">
                <span className="text-text-primary">{c.offres_emploi?.titre ?? '—'}</span>
                <span className="text-text-muted text-[12px]">
                  {STATUT_LABEL[c.statut] ?? c.statut} — {formatter.format(new Date(c.date_candidature))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-bg-card border border-border-soft rounded-[10px] p-6">
        <h2 className="font-cinzel text-[15px] text-text-primary mb-4">Offres d’emploi disponibles</h2>
        {(offres ?? []).length === 0 ? (
          <p className="text-text-muted text-sm py-4 text-center">Aucune offre ouverte pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {(offres ?? []).map((o: any) => (
              <li key={o.id} className="border-b border-border-soft last:border-0 pb-3 last:pb-0">
                <p className="text-text-primary text-[14px] font-medium">{o.titre}</p>
                <p className="text-text-muted text-[12px] mt-0.5">
                  {o.entreprises_partenaires?.nom ?? '—'} · {o.type_contrat ?? '—'} {o.lieu ? `· ${o.lieu}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-text-muted text-[12px] mt-4">
          Pour postuler, contacte ton formateur ou éducateur référent via la messagerie.
        </p>
      </div>
    </div>
  )
}
