'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ThemeId, ModeInteraction } from '@/lib/preferencesUtilisateur'

export async function mettreAJourPreferences(
  beneficiaireId: string,
  input: { themeId?: ThemeId; modeAccessibilite?: boolean; modeInteraction?: ModeInteraction },
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const payload: Record<string, unknown> = { profile_id: user.id, updated_at: new Date().toISOString() }
  if (input.themeId !== undefined) payload.theme_id = input.themeId
  if (input.modeAccessibilite !== undefined) payload.mode_accessibilite = input.modeAccessibilite
  if (input.modeInteraction !== undefined) payload.mode_interaction = input.modeInteraction

  const { error } = await supabase.from('preferences_utilisateur').upsert(payload, { onConflict: 'profile_id' })
  if (error) return { error: 'Impossible d’enregistrer tes préférences.' }

  revalidatePath(`/mon-espace/${beneficiaireId}`, 'layout')
  return { error: null }
}
