import { FileBarChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, EmptyState, StatCard, IgaDial } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { EnteteImpression } from '../../solo/_components/EnteteImpression'

const PERIODES = [
  { valeur: '30', label: '30 derniers jours' },
  { valeur: '90', label: 'Trimestre (90 jours)' },
  { valeur: '365', label: 'Année (365 jours)' },
]

export default async function RapportImpactPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { periode } = await searchParams
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={FileBarChart} eyebrowText="Gouvernance" title="Rapport d'impact" />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const peutConsulter = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))
  if (!peutConsulter) {
    return (
      <>
        <PageHeader eyebrowIcon={FileBarChart} eyebrowText="Gouvernance" title="Rapport d'impact" />
        <Panel>
          <EmptyState text="Réservé au Directeur et au Promoteur." />
        </Panel>
      </>
    )
  }

  const nbJours = ['30', '90', '365'].includes(periode ?? '') ? Number(periode) : 90
  const dateDebut = new Date(Date.now() - nbJours * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const supabase = await createClient()
  const [{ data: org }, { count: nbBeneficiairesActifs }, { data: evaluations }, { data: presencesPeriode }, { data: insertionsPeriode }] = await Promise.all([
    supabase.from('organisations').select('nom, type_organisation, logo_url').eq('id', organisation.id).single(),
    supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('organisation_id', organisation.id).eq('statut_beneficiaire', 'actif'),
    supabase.from('evaluations_iga').select('score_global').eq('organisation_id', organisation.id).gte('date_evaluation', dateDebut),
    supabase.from('presences').select('statut').eq('organisation_id', organisation.id).gte('date_seance', dateDebut),
    supabase.from('insertions_professionnelles').select('beneficiaire_id').eq('organisation_id', organisation.id).in('statut', ['en_cours', 'terminee']).gte('date_debut', dateDebut),
  ])

  const scoresValides = (evaluations ?? []).map((e) => e.score_global).filter((s): s is number => s !== null)
  const igaMoyen = scoresValides.length > 0 ? Math.round(scoresValides.reduce((a, b) => a + b, 0) / scoresValides.length) : null

  const totalPresences = (presencesPeriode ?? []).length
  const nbPresents = (presencesPeriode ?? []).filter((p) => p.statut === 'present').length
  const tauxPresence = totalPresences > 0 ? Math.round((nbPresents / totalPresences) * 100) : null

  const nbBeneficiairesInseres = new Set((insertionsPeriode ?? []).map((i) => i.beneficiaire_id)).size
  const tauxInsertion = nbBeneficiairesActifs && nbBeneficiairesActifs > 0 ? Math.round((nbBeneficiairesInseres / nbBeneficiairesActifs) * 100) : null

  const formatterPeriode = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
      {org && <EnteteImpression organisation={org} />}

      <PageHeader
        eyebrowIcon={FileBarChart}
        eyebrowText="Gouvernance"
        title="Rapport d'impact"
        subtitle={`${org?.nom ?? organisation.nom} — du ${formatterPeriode.format(new Date(dateDebut))} à aujourd'hui.`}
        actions={
          <div className="flex gap-2 print:hidden">
            {PERIODES.map((p) => (
              <a
                key={p.valeur}
                href={`/rapport-impact?periode=${p.valeur}`}
                className={`text-[12.5px] px-3.5 py-1.5 rounded-full border ${
                  p.valeur === String(nbJours) ? 'bg-accent-gold text-bg-base border-accent-gold font-semibold' : 'border-border-soft text-text-muted hover:text-text-primary'
                }`}
              >
                {p.label}
              </a>
            ))}
          </div>
        }
      />

      <p className="text-text-muted text-xs mb-6 print:hidden">
        Données agrégées uniquement — aucune fiche, aucun nom de bénéficiaire n'apparaît sur ce rapport, pensé pour être transmis à un bailleur ou partenaire.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <IgaDial value={igaMoyen} label="Score IGA moyen" />
        <StatCard icon={FileBarChart} label="Taux de présence" value={tauxPresence !== null ? `${tauxPresence}%` : '—'} hint={totalPresences > 0 ? `${totalPresences} séance(s) enregistrée(s)` : 'Aucune présence sur la période'} />
        <StatCard
          icon={FileBarChart}
          label="Taux d'insertion"
          value={tauxInsertion !== null ? `${tauxInsertion}%` : '—'}
          hint={`${nbBeneficiairesInseres} sur ${nbBeneficiairesActifs ?? 0} bénéficiaire(s) actif(s)`}
        />
      </div>

      <footer className="mt-10 text-text-muted text-[12.5px] font-display italic text-center">
        PsychoÉduc Manager — Transformer les potentiels en réussites durables.
      </footer>
    </>
  )
}
