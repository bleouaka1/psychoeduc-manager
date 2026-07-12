import type { SupabaseClient } from '@supabase/supabase-js'
import { estEnDecrochage } from './cerclesApprentissage'

export type MembreCercle = {
  id: string
  beneficiaireId: string
  nom: string
  prenoms: string
  statut: 'invite' | 'actif' | 'sorti'
  derniereActivite: string | null
  enDecrochage: boolean
}

/** La "dernière activité" est dérivée du dernier message envoyé dans la conversation
 * de groupe du cercle (vue plutôt que colonne dupliquée à maintenir à chaque envoi) —
 * à défaut, la date d'invitation sert de repère initial. */
export async function chargerMembresCercle(supabase: SupabaseClient, cercleId: string, conversationId: string | null): Promise<MembreCercle[]> {
  const [{ data: membres }, { data: messages }] = await Promise.all([
    supabase.from('cercles_membres').select('id, beneficiaire_id, statut, date_invitation, beneficiaires(nom, prenoms, profile_id)').eq('cercle_id', cercleId),
    conversationId ? supabase.from('messages').select('expediteur_id, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ])

  const dernierMessageParProfile = new Map<string, string>()
  for (const m of (messages ?? []) as any[]) {
    if (!dernierMessageParProfile.has(m.expediteur_id)) dernierMessageParProfile.set(m.expediteur_id, m.created_at)
  }

  return (membres ?? []).map((m: any) => {
    const profileId = m.beneficiaires?.profile_id as string | null
    const derniereActivite = (profileId && dernierMessageParProfile.get(profileId)) || m.date_invitation
    return {
      id: m.id,
      beneficiaireId: m.beneficiaire_id,
      nom: m.beneficiaires?.nom ?? '',
      prenoms: m.beneficiaires?.prenoms ?? '',
      statut: m.statut,
      derniereActivite,
      enDecrochage: m.statut === 'actif' && estEnDecrochage(derniereActivite),
    }
  })
}

export type MonCercle = { id: string; nom: string; description: string | null; charte: string | null; statut: 'invite' | 'actif' | 'sorti'; conversationId: string | null; organisationNom: string }

export async function chargerMesCercles(supabase: SupabaseClient, beneficiaireId: string): Promise<MonCercle[]> {
  const { data } = await supabase
    .from('cercles_membres')
    .select('statut, cercles_apprentissage(id, nom, description, charte, conversation_id, organisations(nom))')
    .eq('beneficiaire_id', beneficiaireId)

  return (data ?? [])
    .filter((m: any) => m.cercles_apprentissage)
    .map((m: any) => ({
      id: m.cercles_apprentissage.id,
      nom: m.cercles_apprentissage.nom,
      description: m.cercles_apprentissage.description,
      charte: m.cercles_apprentissage.charte,
      statut: m.statut,
      conversationId: m.cercles_apprentissage.conversation_id,
      organisationNom: m.cercles_apprentissage.organisations?.nom ?? '',
    }))
}
