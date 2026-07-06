import { CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatCard, StatusPill } from '../_components/ui'

const STATUT_STYLE: Record<string, 'ok' | 'warn' | 'down' | 'idle'> = {
  publie: 'ok',
  en_attente_validation: 'warn',
  refuse: 'down',
  annule: 'down',
  termine: 'idle',
}

export default async function EvenementsPage() {
  const supabase = await createClient()
  const [{ data: evenements }, { data: inscriptions }] = await Promise.all([
    supabase
      .from('evenements')
      .select('id, titre, type_evenement, statut, date_debut, lieu_type, organisations(nom)')
      .order('date_debut', { ascending: false })
      .limit(50),
    supabase.from('evenements_inscriptions').select('id, statut_paiement, date_inscription, evenements(titre)').order('date_inscription', { ascending: false }).limit(30),
  ])

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const publies = (evenements ?? []).filter((e: any) => e.statut === 'publie').length
  const enAttente = (evenements ?? []).filter((e: any) => e.statut === 'en_attente_validation').length

  return (
    <>
      <PageHeader
        eyebrowIcon={CalendarDays}
        eyebrowText="Activité"
        title="Événements"
        subtitle="Événements gratuits et payants — publication directe pour le Fondateur, validation requise pour les autres."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard icon={CalendarDays} label="Événements publiés" value={publies} />
        <StatCard icon={CalendarDays} label="En attente de validation" value={enAttente} />
        <StatCard icon={CalendarDays} label="Inscriptions récentes" value={inscriptions?.length ?? 0} />
      </div>

      <div className="space-y-6">
        <Panel title={`${evenements?.length ?? 0} événement(s)`}>
          <DataTable
            columns={['Titre', 'Type', 'Organisation', 'Lieu', 'Statut', 'Date']}
            rows={(evenements ?? []).map((e: any) => [
              e.titre,
              e.type_evenement ?? '—',
              e.organisations?.nom ?? 'Fondateur',
              e.lieu_type ?? '—',
              <StatusPill key="s" status={STATUT_STYLE[e.statut] ?? 'idle'}>{e.statut}</StatusPill>,
              e.date_debut ? formatter.format(new Date(e.date_debut)) : '—',
            ])}
            emptyText="Aucun événement pour le moment."
          />
        </Panel>

        <Panel title="Inscriptions récentes">
          <DataTable
            columns={['Événement', 'Statut paiement', 'Date']}
            rows={(inscriptions ?? []).map((i: any) => [i.evenements?.titre ?? '—', i.statut_paiement, formatter.format(new Date(i.date_inscription))])}
            emptyText="Aucune inscription pour le moment."
          />
        </Panel>
      </div>
    </>
  )
}
