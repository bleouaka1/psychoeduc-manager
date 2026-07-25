import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObjectifTuteur, PersonaTuteur, MessageTuteur } from './tuteurIa'

/** Fonctions de lecture pour l'Espace Tuteurs IA — partagées entre la page
 * bénéficiaire et une éventuelle vue équipe pédagogique future. Aucune écriture ici
 * (voir actions.ts de la route), même convention que quizRevisionServer.ts. */

export async function chargerPersonas(supabase: SupabaseClient, objectif?: ObjectifTuteur): Promise<PersonaTuteur[]> {
  let requete = supabase
    .from('tuteur_personas')
    .select('id, nom, domaine, description, objectif, prompt_systeme_base, cout_credits')
    .eq('actif', true)
    .order('nom', { ascending: true })
  if (objectif) requete = requete.eq('objectif', objectif)

  const { data } = await requete
  return (data ?? []).map((p: any) => ({
    id: p.id,
    nom: p.nom,
    domaine: p.domaine,
    description: p.description,
    objectif: p.objectif,
    promptSystemeBase: p.prompt_systeme_base,
    coutCredits: p.cout_credits,
  }))
}

export async function chargerPersona(supabase: SupabaseClient, personaId: string): Promise<PersonaTuteur | null> {
  const { data } = await supabase
    .from('tuteur_personas')
    .select('id, nom, domaine, description, objectif, prompt_systeme_base, cout_credits')
    .eq('id', personaId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    nom: data.nom,
    domaine: data.domaine,
    description: data.description,
    objectif: data.objectif,
    promptSystemeBase: data.prompt_systeme_base,
    coutCredits: data.cout_credits,
  }
}

export type SessionAffichee = {
  id: string
  personaNom: string
  personaDomaine: string
  objectif: ObjectifTuteur
  statut: 'active' | 'terminee'
  creditsConsommes: number
  createdAt: string
}

export async function chargerSessionsTuteur(supabase: SupabaseClient, beneficiaireId: string): Promise<SessionAffichee[]> {
  const { data } = await supabase
    .from('tuteur_sessions')
    .select('id, statut, credits_consommes, created_at, tuteur_personas(nom, domaine, objectif)')
    .eq('beneficiaire_id', beneficiaireId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((s: any) => ({
    id: s.id,
    personaNom: s.tuteur_personas?.nom ?? 'Tuteur',
    personaDomaine: s.tuteur_personas?.domaine ?? '',
    objectif: s.tuteur_personas?.objectif ?? 'tutorat',
    statut: s.statut,
    creditsConsommes: s.credits_consommes,
    createdAt: s.created_at,
  }))
}

export type SessionDetail = SessionAffichee & { personaId: string; documentId: string | null }

export async function chargerSession(supabase: SupabaseClient, sessionId: string): Promise<SessionDetail | null> {
  const { data } = await supabase
    .from('tuteur_sessions')
    .select('id, statut, credits_consommes, created_at, document_id, persona_id, tuteur_personas(nom, domaine, objectif)')
    .eq('id', sessionId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    personaId: data.persona_id,
    documentId: data.document_id,
    personaNom: (data as any).tuteur_personas?.nom ?? 'Tuteur',
    personaDomaine: (data as any).tuteur_personas?.domaine ?? '',
    objectif: (data as any).tuteur_personas?.objectif ?? 'tutorat',
    statut: data.statut,
    creditsConsommes: data.credits_consommes,
    createdAt: data.created_at,
  }
}

export async function chargerMessagesTuteur(supabase: SupabaseClient, sessionId: string): Promise<(MessageTuteur & { id: string; createdAt: string })[]> {
  const { data } = await supabase
    .from('tuteur_messages')
    .select('id, role, contenu, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((m: any) => ({ id: m.id, role: m.role, contenu: m.contenu, createdAt: m.created_at }))
}
