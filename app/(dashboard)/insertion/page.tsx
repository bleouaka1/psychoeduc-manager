import { Rocket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, StatusPill } from '../_components/ui'

export default async function InsertionPage() {
  const supabase = await createClient()
  const [{ data: offres }, { data: candidatures }, { data: insertions }, { data: entreprises }] = await Promise.all([
    supabase.from('offres_emploi').select('id, titre, type_contrat, statut, entreprises_partenaires(nom)').order('date_publication', { ascending: false }).limit(50),
    supabase.from('candidatures').select('id, statut, date_candidature, beneficiaires(nom, prenoms), offres_emploi(titre)').order('date_candidature', { ascending: false }).limit(50),
    supabase.from('insertions_professionnelles').select('id, type_insertion, statut, date_debut, beneficiaires(nom, prenoms)').order('date_debut', { ascending: false }).limit(50),
    supabase.from('entreprises_partenaires').select('id, nom, secteur').limit(50),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={Rocket} eyebrowText="Parcours" title="Insertion professionnelle" subtitle="Offres, candidatures, insertions et entreprises partenaires." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Rocket} label="Offres d’emploi" value={offres?.length ?? 0} />
        <StatCard icon={Rocket} label="Candidatures" value={candidatures?.length ?? 0} />
        <StatCard icon={Rocket} label="Insertions suivies" value={insertions?.length ?? 0} />
        <StatCard icon={Rocket} label="Entreprises partenaires" value={entreprises?.length ?? 0} />
      </div>

      <div className="space-y-6">
        <Panel title="Insertions en cours">
          <DataTable
            columns={['Bénéficiaire', 'Type', 'Statut', 'Début']}
            rows={(insertions ?? []).map((i: any) => [
              i.beneficiaires ? `${i.beneficiaires.nom} ${i.beneficiaires.prenoms}` : '—',
              i.type_insertion ?? '—',
              <StatusPill key="s" status={i.statut === 'en_cours' ? 'ok' : i.statut === 'terminee' ? 'idle' : 'down'}>{i.statut}</StatusPill>,
              formatter.format(new Date(i.date_debut)),
            ])}
            emptyText="Aucune insertion professionnelle enregistrée."
          />
        </Panel>

        <Panel title="Candidatures récentes">
          <DataTable
            columns={['Bénéficiaire', 'Offre', 'Statut', 'Date']}
            rows={(candidatures ?? []).map((c: any) => [
              c.beneficiaires ? `${c.beneficiaires.nom} ${c.beneficiaires.prenoms}` : '—',
              c.offres_emploi?.titre ?? '—',
              c.statut,
              formatter.format(new Date(c.date_candidature)),
            ])}
            emptyText="Aucune candidature enregistrée."
          />
        </Panel>

        <Panel title="Offres d’emploi publiées">
          <DataTable
            columns={['Titre', 'Entreprise', 'Contrat', 'Statut']}
            rows={(offres ?? []).map((o: any) => [o.titre, o.entreprises_partenaires?.nom ?? '—', o.type_contrat ?? '—', o.statut])}
            emptyText="Aucune offre d’emploi publiée."
          />
        </Panel>
      </div>
    </>
  )
}
