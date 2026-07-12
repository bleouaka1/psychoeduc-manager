-- Tableau de bord bénéficiaire — Phase 2 : Projet de vie (multi, fil d'activité par règles).
-- Réf : CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §3.
-- Voir PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md pour les décisions détaillées.
-- Migration additive uniquement.

-- ============================================================================
-- T1 — rattachement d'un objectif à un projet de vie (simple champ de sélection
-- ajouté au formulaire existant, aucune saisie supplémentaire de contenu requise
-- — §3.2 du document). entretiens.projet_vie_id ajouté pour la même raison côté
-- praticien (filtrage), mais reste hors du fil d'activité bénéficiaire dans cette
-- V1 : le contenu d'un entretien (compte_rendu, donnees jsonb libre) n'est jamais
-- exposé au bénéficiaire lui-même, décision de prudence documentée dans
-- PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md plutôt qu'une extension RLS
-- non réfléchie d'un contenu potentiellement sensible.
-- ============================================================================
alter table public.objectifs_beneficiaire add column if not exists projet_vie_id uuid references public.projets_vie(id) on delete set null;
alter table public.entretiens add column if not exists projet_vie_id uuid references public.projets_vie(id) on delete set null;

create index if not exists idx_objectifs_beneficiaire_projet_vie_id on public.objectifs_beneficiaire(projet_vie_id);
create index if not exists idx_entretiens_projet_vie_id on public.entretiens(projet_vie_id);

-- ============================================================================
-- T2 — projets_vie : le bénéficiaire lit et gère ses propres projets (levier
-- "Autonomie" du document, §1) en plus du praticien déjà couvert par la matrice
-- de permissions existante (Étape 7). DROP + CREATE nécessaire pour étendre une
-- policy existante (pas d'ALTER POLICY pour ajouter une clause en Postgres).
-- ============================================================================
drop policy if exists projets_vie_select on public.projets_vie;
create policy projets_vie_select on public.projets_vie for select using (
  public.is_fondateur()
  or public.peut_lire('projets_vie', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = projets_vie.beneficiaire_id and b.profile_id = auth.uid())
);

drop policy if exists projets_vie_insert on public.projets_vie;
create policy projets_vie_insert on public.projets_vie for insert with check (
  public.is_fondateur()
  or public.peut_creer('projets_vie', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = projets_vie.beneficiaire_id and b.profile_id = auth.uid())
);

drop policy if exists projets_vie_update on public.projets_vie;
create policy projets_vie_update on public.projets_vie for update using (
  public.is_fondateur()
  or public.peut_modifier('projets_vie', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = projets_vie.beneficiaire_id and b.profile_id = auth.uid())
);
-- Suppression volontairement laissée au seul praticien/Fondateur (projets_vie_delete
-- inchangée) : un bénéficiaire abandonne un projet via statut='abandonne', jamais une
-- suppression qui effacerait l'historique du fil d'activité.
