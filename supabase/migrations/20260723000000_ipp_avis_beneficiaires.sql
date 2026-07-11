-- IPP (4 piliers) + Avis bénéficiaires — PLAN_IPP_PROFIL_FORMATEUR.md.
-- Réf : CLAUDE-CODE-IPP.md, CLAUDE-CODE-PROFIL-FORMATEUR.md (statut "Validé pour
-- implémentation"). Remplace l'usage de l'ancien evenements_ipp/vue_ipp (conservés
-- tels quels, plus utilisés par le profil public) par un calcul réel sur 4 piliers.
-- Migration additive uniquement.

-- ============================================================================
-- T1 — avis_beneficiaires (témoignages), même vocabulaire de statut que la
-- modération marketplace déjà en place (en_verification/publie/masque/retiree).
-- Jamais de nom complet exposé publiquement (RGPD, mineurs) — géré à l'affichage
-- (prénom + initiale), le nom complet reste nécessaire en base pour la modération.
-- ============================================================================
create table if not exists public.avis_beneficiaires (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  auteur_type text not null check (auteur_type in ('beneficiaire', 'parent_tuteur')),
  parent_tuteur_id uuid references public.parents_tuteurs(id) on delete set null,
  note int not null check (note between 1 and 5),
  texte text,
  duree_jours_suivi int not null default 0,
  palier text check (palier in ('reussir_1', 'reussir_2', 'terminus')),
  declencheur text not null check (declencheur in ('jalon', 'periodique', 'silencieux')),
  statut text not null default 'en_verification' check (statut in ('en_verification', 'publie', 'masque', 'retiree')),
  valide_par uuid references public.profiles(id),
  date_validation timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_avis_beneficiaires_organisation_id on public.avis_beneficiaires(organisation_id);
create index if not exists idx_avis_beneficiaires_beneficiaire_id on public.avis_beneficiaires(beneficiaire_id);

create trigger set_updated_at before update on public.avis_beneficiaires
  for each row execute function public.set_updated_at();
create trigger audit_avis_beneficiaires after insert or update or delete on public.avis_beneficiaires
  for each row execute function public.log_audit();

alter table public.avis_beneficiaires enable row level security;

-- Lecture ouverte pour les avis publiés (vitrine marketplace), staff org-scope
-- voit tout le sien (y compris en attente de modération), fondateur voit tout.
create policy avis_beneficiaires_select on public.avis_beneficiaires
  for select using (
    statut = 'publie'
    or public.is_fondateur()
    or public.peut_lire('avis_beneficiaires', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = avis_beneficiaires.beneficiaire_id and b.profile_id = auth.uid())
  );
-- Insertion : le bénéficiaire lui-même (s'il a un compte) ou le staff en son nom
-- (déclencheur jalon/périodique déclenché applicativement), jamais par un tiers.
create policy avis_beneficiaires_insert on public.avis_beneficiaires
  for insert with check (
    public.is_fondateur()
    or public.peut_creer('avis_beneficiaires', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and b.profile_id = auth.uid())
  );
-- Modération (changement de statut) : Fondateur uniquement, même règle que la
-- modération marketplace (cf. PLAN_MODERATION_MARKETPLACE.md).
create policy avis_beneficiaires_update on public.avis_beneficiaires
  for update using (public.is_fondateur());

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','avis_beneficiaires', true, true, true, true),
  ('administrateur','avis_beneficiaires', true, true, false, false),
  ('coordinateur','avis_beneficiaires', true, true, false, false),
  ('educateur','avis_beneficiaires', true, true, false, false),
  ('psychologue','avis_beneficiaires', true, true, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- T2 — Vue des deltas IGA par période de responsabilité (Pilier 1, §3.1 et 3.4
-- du document IPP). Le "snapshot" de début/fin est dérivé de la première/dernière
-- évaluation IGA dans la fenêtre [date_debut, coalesce(date_fin, now())] de
-- l'affectation — pas une nouvelle table de snapshots dupliquée (principe déjà
-- appliqué à IgaDial/vue_satisfaction_vendeur). Un bénéficiaire sans évaluation
-- dans la fenêtre n'apparaît simplement pas dans cette vue (jamais traité comme 0,
-- garde-fou explicite du document).
-- ============================================================================
create or replace view public.vue_deltas_iga_par_affectation
with (security_invoker = true) as
select
  ap.id as affectation_id,
  ap.organisation_id,
  ap.cible_id as beneficiaire_id,
  ap.date_debut,
  ap.date_fin,
  (
    select e.score_global from public.evaluations_iga e
    where e.beneficiaire_id = ap.cible_id
      and e.date_evaluation >= ap.date_debut
      and (ap.date_fin is null or e.date_evaluation <= ap.date_fin)
    order by e.date_evaluation asc limit 1
  ) as score_debut,
  (
    select e.score_global from public.evaluations_iga e
    where e.beneficiaire_id = ap.cible_id
      and e.date_evaluation >= ap.date_debut
      and (ap.date_fin is null or e.date_evaluation <= ap.date_fin)
    order by e.date_evaluation desc limit 1
  ) as score_fin,
  (
    select count(*) from public.evaluations_iga e
    where e.beneficiaire_id = ap.cible_id
      and e.date_evaluation >= ap.date_debut
      and (ap.date_fin is null or e.date_evaluation <= ap.date_fin)
  ) as nombre_evaluations
from public.affectations_personnel ap
where ap.cible_type = 'beneficiaire';
