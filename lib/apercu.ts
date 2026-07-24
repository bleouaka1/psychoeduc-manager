import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase/server'

export const COOKIE_APERCU = 'apercu_organisation_id'
/** Sauvegarde temporaire (1h) de la session réelle du Fondateur pendant une impersonation
 * bénéficiaire/parent (`app/(dashboard)/apercu/actions.ts`) — permet de la restaurer via
 * "Quitter l'impersonation" sans qu'il ait à se reconnecter. */
export const COOKIE_BACKUP_SESSION = 'fondateur_backup_session'

export type OrganisationApercu = {
  id: string
  nom: string
  type_organisation: string
  mode_whatsapp_defaut: string | null
  logo_url: string | null
  module_admin_actif: boolean | null
}

/**
 * Mode Aperçu ("voir en tant que") — réservé au Fondateur, pour tester chaque tableau de
 * bord avec de vraies données sans avoir à se reconnecter avec un compte de test différent
 * à chaque fois. Un simple cookie httpOnly suffit : il ne fait qu'orienter QUELLE organisation
 * le Fondateur consulte, jamais une élévation de privilège — `is_fondateur()` a déjà accès en
 * lecture/écriture à tout via RLS (`is_fondateur() OR peut_lire/creer/modifier(...)` partout),
 * et chaque lecture de ce cookie revérifie explicitement `is_fondateur()` avant de l'honorer.
 * Écritures faites en aperçu restent attribuées au vrai profil du Fondateur (created_by/
 * updated_by), jamais usurpées — traçabilité intacte.
 */
export async function resoudreOrganisationApercu(supabase: SupabaseClient, typesAttendus: string[]): Promise<OrganisationApercu | null> {
  const cookieStore = await cookies()
  const apercuId = cookieStore.get(COOKIE_APERCU)?.value
  if (!apercuId) return null

  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return null

  const { data: organisation } = await supabase
    .from('organisations')
    .select('id, nom, type_organisation, mode_whatsapp_defaut, logo_url, module_admin_actif')
    .eq('id', apercuId)
    .single()

  if (!organisation || !typesAttendus.includes(organisation.type_organisation)) return null
  return organisation
}

/** Vrai si une session Fondateur est actuellement sauvegardée en attente de restauration —
 * c'est-à-dire qu'une impersonation bénéficiaire/parent est en cours. Ne nécessite pas de
 * revérifier is_fondateur() ici : la session ACTIVE en ce moment est celle du bénéficiaire/
 * parent impersonné, pas celle du Fondateur (`demarrerImpersonation` l'a déjà vérifié avant
 * de poser ce cookie, seul endroit qui peut l'écrire). */
export async function impersonationActive(): Promise<boolean> {
  const cookieStore = await cookies()
  return Boolean(cookieStore.get(COOKIE_BACKUP_SESSION)?.value)
}

/** Résout l'aperçu actif quel que soit son type (utilisé par la bannière, pas par les
 * résolveurs d'organisation qui filtrent par type attendu). */
export async function organisationApercuActive(): Promise<OrganisationApercu | null> {
  const cookieStore = await cookies()
  const apercuId = cookieStore.get(COOKIE_APERCU)?.value
  if (!apercuId) return null

  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return null

  const { data: organisation } = await supabase
    .from('organisations')
    .select('id, nom, type_organisation, mode_whatsapp_defaut, logo_url, module_admin_actif')
    .eq('id', apercuId)
    .single()

  return organisation ?? null
}
