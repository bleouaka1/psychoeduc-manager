'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

/** Seul 'lien_simple' est implémenté en V1 (spec messagerie directe §3, mode API Business
 * = chantier à part) — refusé côté serveur, pas seulement caché côté UI, si jamais sollicité. */
export async function definirModeWhatsAppDefaut(mode: string): Promise<void> {
  if (mode !== 'lien_simple') return

  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const supabase = await createClient()
  await supabase.from('organisations').update({ mode_whatsapp_defaut: mode }).eq('id', organisation.id)

  revalidatePath('/solo/parametres')
}
