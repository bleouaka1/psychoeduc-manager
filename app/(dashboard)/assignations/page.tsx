import { UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill, EmptyState } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { assignerFormateur, terminerAssignation } from './actions'

const ROLES_PEUVENT_ASSIGNER = ['directeur', 'coordinateur', 'promoteur', 'administrateur', 'fondateur']

export default async function AssignationsPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={UserCog} eyebrowText="Parcours" title="Assignations" subtitle="Qui accompagne qui." />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()

  const [{ data: beneficiaires }, { data: formateurs }, { data: assignations }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).eq('statut_beneficiaire', 'actif').order('nom'),
    supabase
      // FK explicite : membres_organisations a 3 FK vers profiles (created_by/profile_id/
      // updated_by), PostgREST refuse de deviner et renvoie une erreur silencieuse sinon.
      .from('membres_organisations')
      .select('id, profiles!membres_organisations_profile_id_fkey(nom, prenoms), roles_utilisateurs(role, actif)')
      .eq('organisation_id', organisation.id)
      .eq('statut', 'actif'),
    supabase
      .from('assignations')
      .select('id, role_assignation, date_debut, date_fin, beneficiaires(nom, prenoms), formateur_membre_organisation_id')
      .eq('organisation_id', organisation.id)
      .order('date_debut', { ascending: false }),
  ])

  const formateursEligibles = (formateurs ?? [])
    .filter((m: any) => (m.roles_utilisateurs ?? []).some((r: any) => r.actif && r.role === 'formateur'))
    .map((m: any) => ({ id: m.id, nom: `${m.profiles?.prenoms ?? ''} ${m.profiles?.nom ?? ''}`.trim() || 'Formateur' }))

  const nomFormateurParMembre = new Map((formateurs ?? []).map((m: any) => [m.id, `${m.profiles?.prenoms ?? ''} ${m.profiles?.nom ?? ''}`.trim() || 'Formateur']))

  const peutAssigner = organisation.roles.some((r) => ROLES_PEUVENT_ASSIGNER.includes(r))
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader
        eyebrowIcon={UserCog}
        eyebrowText="Parcours"
        title="Assignations"
        subtitle="L'accès d'un formateur à un bénéficiaire suit uniquement une assignation active — jamais le rôle seul."
      />

      {peutAssigner && (
        <Panel title="Nouvelle assignation" className="mb-6">
          {beneficiaires?.length === 0 || formateursEligibles.length === 0 ? (
            <p className="text-text-muted text-sm py-2">
              {beneficiaires?.length === 0 ? 'Aucun bénéficiaire actif dans cette organisation.' : 'Aucun formateur actif (rôle "formateur") dans cette organisation.'}
            </p>
          ) : (
            <form action={assignerFormateur} className="flex flex-wrap items-center gap-2.5">
              <select name="beneficiaire_id" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[200px]">
                {(beneficiaires ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.nom} {b.prenoms}
                  </option>
                ))}
              </select>
              <select name="formateur_membre_organisation_id" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[200px]">
                {formateursEligibles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
              <input
                name="role_assignation"
                placeholder="Rôle (ex. formateur_insertion)"
                className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[180px]"
              />
              <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
                Assigner
              </button>
            </form>
          )}
        </Panel>
      )}

      <Panel title={`${(assignations ?? []).length} assignation(s)`}>
        <DataTable
          columns={['Bénéficiaire', 'Formateur', 'Rôle', 'Début', 'Statut', 'Actions']}
          rows={(assignations ?? []).map((a: any) => [
            `${a.beneficiaires?.nom ?? ''} ${a.beneficiaires?.prenoms ?? ''}`.trim(),
            nomFormateurParMembre.get(a.formateur_membre_organisation_id) ?? '—',
            a.role_assignation ?? '—',
            formatter.format(new Date(a.date_debut)),
            <StatusPill key="s" status={a.date_fin ? 'idle' : 'ok'}>{a.date_fin ? 'Terminée' : 'Active'}</StatusPill>,
            !a.date_fin && peutAssigner ? (
              <form key="actions" action={terminerAssignation.bind(null, a.id)}>
                <button type="submit" className="text-[11.5px] text-danger border border-danger/40 rounded-full px-3 py-1">
                  Terminer
                </button>
              </form>
            ) : (
              <span key="actions" />
            ),
          ])}
          emptyText="Aucune assignation pour le moment."
        />
      </Panel>
    </>
  )
}
