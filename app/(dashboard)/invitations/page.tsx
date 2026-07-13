import { UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, Panel, DataTable, StatusPill, EmptyState } from '../_components/ui'
import { getMonOrganisation } from '../_lib/getMonOrganisation'
import { inviterMembreEquipe, inviterParent, revoquerInvitation, regenererInvitation } from './actions'

const ROLES_EQUIPE = ['directeur', 'coordinateur', 'educateur', 'formateur', 'promoteur']
const ROLE_LABEL: Record<string, string> = {
  directeur: 'Directeur',
  coordinateur: 'Coordinateur',
  educateur: 'Éducateur',
  formateur: 'Formateur',
  promoteur: 'Promoteur',
  parent: 'Parent',
  tuteur: 'Tuteur',
}
const STATUT_LABEL: Record<string, string> = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée', expiree: 'Expirée', revoquee: 'Révoquée' }

export default async function InvitationsPage() {
  const organisation = await getMonOrganisation()
  if (!organisation) {
    return (
      <>
        <PageHeader eyebrowIcon={UserPlus} eyebrowText="Gouvernance" title="Invitations" subtitle="Équipe et parents/tuteurs." />
        <Panel>
          <EmptyState text="Aucune organisation Structure rattachée à ce compte." />
        </Panel>
      </>
    )
  }

  const supabase = await createClient()

  const [{ data: invitations }, { data: beneficiaires }] = await Promise.all([
    supabase.from('invitations_utilisateurs').select('id, email, role_propose, statut, token, expire_le, beneficiaires(nom, prenoms)').eq('organisation_id', organisation.id).order('created_at', { ascending: false }),
    supabase.from('beneficiaires').select('id, nom, prenoms').eq('organisation_id', organisation.id).eq('statut_beneficiaire', 'actif').order('nom'),
  ])

  const peutInviter = organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <PageHeader eyebrowIcon={UserPlus} eyebrowText="Gouvernance" title="Invitations" subtitle="Équipe et parents/tuteurs — chaque lien expire après 14 jours si non utilisé." />

      {peutInviter && (
        <>
          <Panel title="Inviter un membre d'équipe" className="mb-6">
            <form action={inviterMembreEquipe} className="flex flex-wrap items-center gap-2.5">
              <input name="email" type="email" required placeholder="email@exemple.com" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[220px]" />
              <select name="role_propose" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
                {ROLES_EQUIPE.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
                Inviter
              </button>
            </form>
          </Panel>

          <Panel title="Inviter un parent / tuteur" className="mb-6">
            {beneficiaires?.length === 0 ? (
              <p className="text-text-muted text-sm py-2">Aucun bénéficiaire actif dans cette organisation.</p>
            ) : (
              <form action={inviterParent} className="flex flex-wrap items-center gap-2.5">
                <input name="email" type="email" required placeholder="email@exemple.com" className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[220px]" />
                <select name="beneficiaire_id" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary min-w-[180px]">
                  {(beneficiaires ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.nom} {b.prenoms}
                    </option>
                  ))}
                </select>
                <select name="role_propose" required className="bg-bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-text-primary">
                  <option value="parent">Parent</option>
                  <option value="tuteur">Tuteur</option>
                </select>
                <button type="submit" className="bg-gradient-to-br from-accent-gold to-accent-gold-dim text-bg-base font-semibold text-[13px] px-4 py-2 rounded-full">
                  Inviter
                </button>
              </form>
            )}
          </Panel>
        </>
      )}

      <Panel title={`${(invitations ?? []).length} invitation(s)`}>
        <DataTable
          columns={['Email', 'Rôle', 'Bénéficiaire', 'Lien', 'Expire le', 'Statut', 'Actions']}
          rows={(invitations ?? []).map((i: any) => [
            i.email,
            ROLE_LABEL[i.role_propose] ?? i.role_propose,
            i.beneficiaires ? `${i.beneficiaires.nom} ${i.beneficiaires.prenoms}` : '—',
            i.statut === 'en_attente' ? (
              <a key="lien" href={`/invitation?token=${i.token}`} target="_blank" rel="noopener noreferrer" className="text-accent-gold hover:underline text-[12.5px]">
                Ouvrir le lien
              </a>
            ) : (
              <span key="lien">—</span>
            ),
            formatter.format(new Date(i.expire_le)),
            <StatusPill key="s" status={i.statut === 'acceptee' ? 'ok' : i.statut === 'en_attente' ? 'warn' : 'idle'}>{STATUT_LABEL[i.statut] ?? i.statut}</StatusPill>,
            peutInviter && i.statut === 'en_attente' ? (
              <div key="actions" className="flex gap-2">
                <form action={revoquerInvitation.bind(null, i.id)}>
                  <button type="submit" className="text-[11.5px] text-danger border border-danger/40 rounded-full px-3 py-1">
                    Révoquer
                  </button>
                </form>
                <form action={regenererInvitation.bind(null, i.id)}>
                  <button type="submit" className="text-[11.5px] text-accent-gold border border-accent-gold-dim/50 rounded-full px-3 py-1">
                    Régénérer
                  </button>
                </form>
              </div>
            ) : (
              <span key="actions" />
            ),
          ])}
          emptyText="Aucune invitation pour le moment."
        />
      </Panel>
    </>
  )
}
