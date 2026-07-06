'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSoloOrganisation } from '../_lib/getSoloOrg'

export async function creerSeance(formData: FormData): Promise<void> {
  const organisation = await getSoloOrganisation()
  if (!organisation) return

  const titre = String(formData.get('titre') ?? '').trim()
  const type_seance = String(formData.get('type_seance') ?? '')
  const date_heure = String(formData.get('date_heure') ?? '')
  const beneficiaire_id = String(formData.get('beneficiaire_id') ?? '') || null
  const formation_id = String(formData.get('formation_id') ?? '') || null

  if (!titre || !date_heure || (!beneficiaire_id && !formation_id)) return
  if (type_seance !== 'suivi' && type_seance !== 'session_live') return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('seances').insert({
    organisation_id: organisation.id,
    beneficiaire_id,
    formation_id,
    titre,
    type_seance,
    date_heure: new Date(date_heure).toISOString(),
    created_by: user?.id,
  })

  revalidatePath('/solo/calendrier')
}

export async function annulerSeance(seanceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('seances').update({ statut: 'annulee' }).eq('id', seanceId)
  revalidatePath('/solo/calendrier')
}

export async function terminerSeance(seanceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('seances').update({ statut: 'terminee' }).eq('id', seanceId)
  revalidatePath('/solo/calendrier')
}
