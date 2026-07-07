import { createClient } from '@/lib/supabase/server'
import type { ContactMessagerie } from '@/lib/messagerieDirecte'

export type ContactsBeneficiaire = {
  beneficiaire: ContactMessagerie | null
  parentsTuteurs: ContactMessagerie[]
  formateursResponsables: ContactMessagerie[]
}

/** Résout les 3 catégories de destinataire de la spec messagerie directe. Formateur/
 * Responsable n'a pas de table dédiée : c'est le personnel affecté au bénéficiaire
 * (`affectations_personnel`, cible polymorphe déjà en place depuis l'Étape 4). */
export async function chargerContactsBeneficiaire(beneficiaireId: string): Promise<ContactsBeneficiaire> {
  const supabase = await createClient()

  const [{ data: beneficiaire }, { data: parents }, { data: affectations }] = await Promise.all([
    supabase.from('beneficiaires').select('id, nom, prenoms, telephone, email').eq('id', beneficiaireId).maybeSingle(),
    supabase
      .from('parents_tuteurs')
      .select('id, nom, prenoms, telephone, email, lien_parente')
      .eq('beneficiaire_id', beneficiaireId),
    supabase
      .from('affectations_personnel')
      .select('id, fonction, membres_organisations(profiles(id, nom, prenoms, telephone, email))')
      .eq('cible_type', 'beneficiaire')
      .eq('cible_id', beneficiaireId)
      .eq('statut', 'active'),
  ])

  return {
    beneficiaire: beneficiaire
      ? { id: beneficiaire.id, nom: `${beneficiaire.prenoms} ${beneficiaire.nom}`.trim(), telephone: beneficiaire.telephone, email: beneficiaire.email }
      : null,
    parentsTuteurs: (parents ?? []).map((p: any) => ({
      id: p.id,
      nom: `${p.prenoms ?? ''} ${p.nom ?? ''}`.trim() || (p.lien_parente ?? 'Parent/Tuteur'),
      telephone: p.telephone,
      email: p.email,
    })),
    formateursResponsables: (affectations ?? [])
      .filter((a: any) => a.membres_organisations?.profiles)
      .map((a: any) => ({
        id: a.membres_organisations.profiles.id,
        nom: `${a.membres_organisations.profiles.prenoms ?? ''} ${a.membres_organisations.profiles.nom ?? ''}`.trim() || a.fonction || 'Formateur/Responsable',
        telephone: a.membres_organisations.profiles.telephone,
        email: a.membres_organisations.profiles.email,
      })),
  }
}
