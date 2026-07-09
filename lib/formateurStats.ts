import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Statistiques du profil public formateur — TOUJOURS calculées à la lecture,
 * jamais stockées en dur (cohérent avec IgaDial/vue_satisfaction_vendeur déjà
 * en place). Partagé entre /solo/profil (auto-édition), la page détail d'une
 * offre formation et le profil public formateur (vue visiteur).
 */
export type StatsFormateur = {
  organisation: { id: string; nom: string; type_organisation: string; created_at: string }
  profilPublic: { bio: string | null; specialites: string[]; specialitesDimensionsIga: string[]; photo_url: string | null; cv_url: string | null; cv_texte: string | null } | null
  ipp: { score: number; nombreEvenementsVerifies: number } | null
  ancienneteJours: number
  beneficiairesAccompagnes: number
  tauxReussite: number | null
  noteMoyenne: number | null
  nombreAvis: number
  clientsMarketplace: number
  formationsPubliees: { id: string; titre: string; prix: number | null; devise: string; duree_texte: string | null; mode_transmission: string | null }[]
  estFondateur: boolean
  /** Dérivé : au moins une formation publiée ET profil avec photo + bio remplis. */
  badgeVerifie: boolean
}

export async function calculerStatsFormateur(supabase: SupabaseClient, organisationId: string): Promise<StatsFormateur | null> {
  const [{ data: organisation }, { data: profilPublic }, { data: formationsPubliees }, { data: satisfaction }, { data: ipp }] = await Promise.all([
    supabase.from('organisations').select('id, nom, type_organisation, created_at').eq('id', organisationId).maybeSingle(),
    supabase.from('profils_publics_formateurs').select('bio, specialites, specialites_dimensions_iga, photo_url, cv_url, cv_texte').eq('organisation_id', organisationId).maybeSingle(),
    supabase.from('formations').select('id, titre, prix, devise, duree_texte, mode_transmission').eq('organisation_id', organisationId).eq('statut', 'publiee'),
    supabase.from('vue_satisfaction_vendeur').select('note_moyenne, nombre_avis').eq('organisation_id', organisationId).maybeSingle(),
    supabase.from('vue_ipp').select('score, nombre_evenements_verifies').eq('organisation_id', organisationId).maybeSingle(),
  ])

  if (!organisation) return null

  const [{ count: beneficiairesAccompagnes }, { count: reussitesConfirmees }, { data: offresOrg }] = await Promise.all([
    supabase.from('beneficiaires').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId),
    supabase.from('reussites_beneficiaires').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('statut', 'confirmee'),
    supabase.from('marketplace_offres').select('id').eq('organisation_id', organisationId),
  ])

  const formationIds = (formationsPubliees ?? []).map((f: any) => f.id)
  const offreIds = (offresOrg ?? []).map((o: any) => o.id)
  const [{ data: acheteursFormations }, { data: acheteursOffres }, { data: estFondateurData }] = await Promise.all([
    formationIds.length > 0 ? supabase.from('inscriptions_formations').select('acheteur_id').in('formation_id', formationIds) : Promise.resolve({ data: [] as any[] }),
    offreIds.length > 0 ? supabase.from('marketplace_commandes').select('acheteur_id').in('offre_id', offreIds) : Promise.resolve({ data: [] as any[] }),
    // Fonction SECURITY DEFINER : un visiteur externe n'est pas membre de cette
    // organisation, le RLS de membres_organisations/roles_utilisateurs lui masquerait
    // sinon systématiquement la réponse (même principe que is_fondateur()).
    supabase.rpc('organisation_est_fondateur', { p_organisation_id: organisationId }),
  ])

  const clientsMarketplace = new Set([...(acheteursFormations ?? []).map((a: any) => a.acheteur_id), ...(acheteursOffres ?? []).map((a: any) => a.acheteur_id)]).size
  const ancienneteJours = Math.floor((Date.now() - new Date(organisation.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const tauxReussite = (beneficiairesAccompagnes ?? 0) > 0 ? Math.round(((reussitesConfirmees ?? 0) / (beneficiairesAccompagnes ?? 1)) * 100) : null
  const estFondateur = Boolean(estFondateurData)
  const badgeVerifie = (formationsPubliees ?? []).length > 0 && Boolean(profilPublic?.photo_url) && Boolean(profilPublic?.bio)

  return {
    organisation,
    profilPublic: profilPublic
      ? {
          bio: profilPublic.bio,
          specialites: profilPublic.specialites ?? [],
          specialitesDimensionsIga: profilPublic.specialites_dimensions_iga ?? [],
          photo_url: profilPublic.photo_url,
          cv_url: profilPublic.cv_url,
          cv_texte: profilPublic.cv_texte,
        }
      : null,
    ipp: ipp ? { score: Number(ipp.score), nombreEvenementsVerifies: Number(ipp.nombre_evenements_verifies) } : null,
    ancienneteJours,
    beneficiairesAccompagnes: beneficiairesAccompagnes ?? 0,
    tauxReussite,
    noteMoyenne: satisfaction?.note_moyenne ?? null,
    nombreAvis: satisfaction?.nombre_avis ?? 0,
    clientsMarketplace,
    formationsPubliees: formationsPubliees ?? [],
    estFondateur,
    badgeVerifie,
  }
}
