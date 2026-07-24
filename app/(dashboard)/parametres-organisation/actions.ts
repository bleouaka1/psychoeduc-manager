'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMonOrganisation } from '../_lib/getMonOrganisation'

/** §4.1 : le module Gestion Administrative reste désactivable — jamais imposé par défaut
 * à un compte Structure qui ne le souhaite pas (ex. une ONG sans gestion de scolarité). */
export async function basculerModuleAdmin(formData: FormData): Promise<void> {
  const organisation = await getMonOrganisation()
  if (!organisation) return
  if (!organisation.roles.some((r) => ['directeur', 'promoteur'].includes(r))) return

  const actif = formData.get('module_admin_actif') === 'on'
  const supabase = await createClient()
  await supabase.from('organisations').update({ module_admin_actif: actif }).eq('id', organisation.id)

  revalidatePath('/parametres-organisation')
  revalidatePath('/dashboard')
}
