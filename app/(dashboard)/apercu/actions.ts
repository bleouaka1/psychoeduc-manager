'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { COOKIE_APERCU } from '@/lib/apercu'

const DESTINATION_PAR_TYPE: Record<string, string> = {
  solo: '/solo',
  employeur: '/employeur',
}

/** Active le mode Aperçu pour l'organisation choisie puis redirige directement vers son
 * tableau de bord — Solo/Employeur ont leur propre console, tout le reste (Structure)
 * passe par le Cockpit générique (`/dashboard`), même logique que `resoudreDestinationConnexion`. */
export async function activerApercuEtRedirection(formData: FormData): Promise<void> {
  const organisationId = String(formData.get('organisation_id') ?? '')
  if (!organisationId) return

  const supabase = await createClient()
  const { data: estFondateur } = await supabase.rpc('is_fondateur')
  if (!estFondateur) return

  const { data: organisation } = await supabase.from('organisations').select('type_organisation').eq('id', organisationId).single()
  if (!organisation) return

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_APERCU, organisationId, { httpOnly: true, sameSite: 'lax', path: '/' })

  redirect(DESTINATION_PAR_TYPE[organisation.type_organisation] ?? '/dashboard')
}

export async function quitterApercuAction(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_APERCU)
  redirect('/apercu')
}
