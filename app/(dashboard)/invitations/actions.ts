'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

const ROLES_EQUIPE_INVITABLES = ['directeur', 'coordinateur', 'educateur', 'formateur', 'promoteur']

/** Invitation membre d'équipe (§4.4) — initiée uniquement par Directeur/Promoteur
 * (peut_creer('invitations_utilisateurs', ...) déjà restreint à ces rôles + fondateur). */
export async function inviterMembreEquipe(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const rolePropose = String(formData.get('role_propose') ?? '')
  if (!email || !ROLES_EQUIPE_INVITABLES.includes(rolePropose)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('invitations_utilisateurs').insert({
    organisation_id: organisation.id,
    email,
    role_propose: rolePropose,
    invite_par: user?.id,
  })

  revalidatePath('/invitations')
}

/** Invitation Parent/Tuteur (§4.4) — liée à un bénéficiaire précis, jamais d'auto-inscription
 * libre. Un bénéficiaire peut avoir plusieurs tuteurs : pas de contrôle "un seul actif". */
export async function inviterParent(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const beneficiaireId = String(formData.get('beneficiaire_id') ?? '')
  const rolePropose = String(formData.get('role_propose') ?? 'parent')
  if (!email || !beneficiaireId || !['parent', 'tuteur'].includes(rolePropose)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('invitations_utilisateurs').insert({
    organisation_id: organisation.id,
    beneficiaire_id: beneficiaireId,
    email,
    role_propose: rolePropose,
    invite_par: user?.id,
  })

  revalidatePath('/invitations')
}

export async function revoquerInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('invitations_utilisateurs').update({ statut: 'revoquee' }).eq('id', invitationId)
  revalidatePath('/invitations')
}

/** Régénérer = nouveau token + nouvelle échéance sur la même ligne, plutôt qu'une
 * nouvelle invitation — conserve l'historique (qui a été invité, par qui, quand). */
export async function regenererInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('invitations_utilisateurs')
    .update({ statut: 'en_attente', token: randomBytes(32).toString('hex'), expire_le: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', invitationId)
  revalidatePath('/invitations')
}
