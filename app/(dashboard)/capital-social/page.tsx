import { HeartHandshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard } from '../_components/ui'

export default async function CapitalSocialPage() {
  const supabase = await createClient()
  const [{ data: evaluations }, { data: reseau }, { data: personnes }, { data: soutiens }] = await Promise.all([
    supabase
      .from('evaluations_capital_social')
      .select('id, score_global, niveau, date_evaluation, beneficiaires(nom, prenoms)')
      .order('date_evaluation', { ascending: false })
      .limit(50),
    supabase.from('reseau_soutien').select('id, nom, type_lien, beneficiaires(nom, prenoms)').limit(50),
    supabase.from('personnes_ressources').select('id, nom, prenoms, profession, type_ressource').limit(50),
    supabase.from('soutiens_beneficiaires').select('id, type_soutien, date_soutien, beneficiaires(nom, prenoms)').order('date_soutien', { ascending: false }).limit(50),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={HeartHandshake} eyebrowText="Parcours" title="Capital social" subtitle="Réseau de soutien, personnes ressources et évaluations du capital social des bénéficiaires." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={HeartHandshake} label="Évaluations récentes" value={evaluations?.length ?? 0} />
        <StatCard icon={HeartHandshake} label="Membres du réseau de soutien" value={reseau?.length ?? 0} />
        <StatCard icon={HeartHandshake} label="Personnes ressources" value={personnes?.length ?? 0} />
      </div>

      <div className="space-y-6">
        <Panel title="Dernières évaluations de capital social">
          <DataTable
            columns={['Bénéficiaire', 'Score', 'Niveau', 'Date']}
            rows={(evaluations ?? []).map((e: any) => [
              e.beneficiaires ? `${e.beneficiaires.nom} ${e.beneficiaires.prenoms}` : '—',
              e.score_global ?? '—',
              e.niveau ?? '—',
              formatter.format(new Date(e.date_evaluation)),
            ])}
            emptyText="Aucune évaluation de capital social enregistrée."
          />
        </Panel>

        <Panel title="Réseau de soutien">
          <DataTable
            columns={['Bénéficiaire', 'Nom du contact', 'Lien']}
            rows={(reseau ?? []).map((r: any) => [r.beneficiaires ? `${r.beneficiaires.nom} ${r.beneficiaires.prenoms}` : '—', r.nom ?? '—', r.type_lien ?? '—'])}
            emptyText="Aucun réseau de soutien renseigné."
          />
        </Panel>

        <Panel title="Personnes ressources (annuaire)">
          <DataTable
            columns={['Nom', 'Profession', 'Type']}
            rows={(personnes ?? []).map((p: any) => [`${p.nom ?? ''} ${p.prenoms ?? ''}`.trim() || '—', p.profession ?? '—', p.type_ressource ?? '—'])}
            emptyText="Aucune personne ressource enregistrée."
          />
        </Panel>

        <Panel title="Soutiens apportés récemment">
          <DataTable
            columns={['Bénéficiaire', 'Type de soutien', 'Date']}
            rows={(soutiens ?? []).map((s: any) => [s.beneficiaires ? `${s.beneficiaires.nom} ${s.beneficiaires.prenoms}` : '—', s.type_soutien ?? '—', formatter.format(new Date(s.date_soutien))])}
            emptyText="Aucun soutien enregistré."
          />
        </Panel>
      </div>
    </>
  )
}
