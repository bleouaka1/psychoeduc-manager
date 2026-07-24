import { ScrollText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill } from '../_components/ui'

// §4.7 : "pas un log technique brut, une vue lisible pour le Directeur en cas de besoin de
// vérification" — traduit `(action, table_cible)` en une phrase française plutôt que d'exposer
// les noms de table Postgres bruts. Jamais de rendu de `donnees_avant`/`donnees_apres` (jsonb) :
// un entretien y transiterait en clair, la lisibilité ne doit jamais devenir une fuite.
const LIBELLE_TABLE: Record<string, string> = {
  assignations: 'une assignation',
  liens_parent_beneficiaire: 'un lien parent-bénéficiaire',
  presences: 'une présence',
  versements_scolarite: 'un versement de scolarité',
  documents_beneficiaires: 'une pièce de dossier',
  paiements_scolarite: 'un paiement de scolarité',
  factures_scolarite: 'une facture',
  entretiens: 'un entretien',
  classes_groupes: 'une classe/cohorte',
  inscriptions_classes: 'une inscription de classe',
  invitations_utilisateurs: 'une invitation',
  membres_organisations: 'un membre d’équipe',
  roles_utilisateurs: 'un rôle utilisateur',
  etablissements: 'un établissement',
  beneficiaires: 'un dossier bénéficiaire',
  organisations: 'les paramètres de l’organisation',
  evaluations_iga: 'une évaluation IGA',
  insertions_professionnelles: 'une insertion professionnelle',
}

const VERBE_ACTION: Record<string, string> = { INSERT: 'a créé', UPDATE: 'a modifié', DELETE: 'a supprimé' }

function resumeAudit(action: string, tableCible: string): string {
  const verbe = VERBE_ACTION[action] ?? action.toLowerCase()
  const cible = LIBELLE_TABLE[tableCible] ?? `un enregistrement (${tableCible})`
  return `${verbe} ${cible}`
}

export default async function AuditPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_logs')
    .select('id, action, table_cible, ligne_id, created_at, profiles(email), organisations(nom)')
    .order('created_at', { ascending: false })
    .limit(100)

  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <>
      <PageHeader eyebrowIcon={ScrollText} eyebrowText="Gouvernance" title="Journal d’audit" subtitle="Traçabilité complète, append-only, jamais modifiable." />
      <Panel title={`${data?.length ?? 0} entrée(s) — 100 plus récentes`}>
        <DataTable
          columns={['Auteur', 'Résumé', 'Organisation', 'Horodatage']}
          rows={(data ?? []).map((a: any) => [
            a.profiles?.email ?? 'système',
            <span key="r" className="flex items-center gap-2">
              <StatusPill status={a.action === 'DELETE' ? 'down' : a.action === 'INSERT' ? 'ok' : 'warn'}>{a.action}</StatusPill>
              {resumeAudit(a.action, a.table_cible)}
            </span>,
            a.organisations?.nom ?? '—',
            formatter.format(new Date(a.created_at)),
          ])}
          emptyText="Aucune entrée d’audit pour le moment."
        />
      </Panel>
    </>
  )
}
