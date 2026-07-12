-- Tableau de bord bénéficiaire — Phase 3 : ICC (Indice de Compétences du Bénéficiaire).
-- Réf : CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §4.
-- Voir PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md pour les décisions détaillées.
-- Migration additive uniquement.

-- ============================================================================
-- Garde-fou méthodologique (§4.3 du document, respecté à la lettre) : référentiel
-- local à CHAQUE formation, défini par le formateur qui la crée — jamais un
-- référentiel "officiel" par métier généré automatiquement. icc_competences est
-- donc rattachée à formation_id, jamais à un catalogue métier global.
-- ============================================================================
create table if not exists public.icc_competences (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type text not null check (type in ('savoir', 'savoir_faire')),
  libelle text not null,
  ordre int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pilier Savoirs : évalué par le praticien avant/après (pas un quiz auto-administré
-- avec correction automatique — le document ne précise pas de format de question
-- exploitable pour ça ; "maîtrisé" avant/après capture le même delta demandé,
-- écart assumé et documenté plutôt qu'un moteur de quiz hors de portée de cette V1).
create table if not exists public.icc_evaluations_savoir (
  id uuid primary key default gen_random_uuid(),
  competence_id uuid not null references public.icc_competences(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  moment text not null check (moment in ('avant', 'apres')),
  maitrise boolean not null,
  evalue_par uuid references public.profiles(id),
  date_evaluation timestamptz not null default now(),
  unique (competence_id, beneficiaire_id, moment)
);

-- Pilier Savoir-faire : échelle débutant/intermédiaire/autonome/expert (§4.2.2).
create table if not exists public.icc_evaluations_savoir_faire (
  id uuid primary key default gen_random_uuid(),
  competence_id uuid not null references public.icc_competences(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  niveau text not null check (niveau in ('debutant', 'intermediaire', 'autonome', 'expert')),
  evalue_par uuid references public.profiles(id),
  date_evaluation timestamptz not null default now(),
  unique (competence_id, beneficiaire_id)
);

-- ============================================================================
-- Pilier Savoir-être : le document (§4.2.3) suppose une réutilisation directe des
-- "tags d'observation comportementale déjà saisis dans les fiches entretien
-- spécialisées" sans nouvelle saisie. Vérifié faux dans ce projet : ces tags
-- existants (entretiens.donnees->comportements, cf. lib/entretiens.ts
-- COMPORTEMENTS_PRESETS) sont des signaux cliniques de vigilance (agression,
-- anxiété, absentéisme...), pas des observations de compétence comportementale
-- positive — les réutiliser pour un score de compétence public détournerait des
-- données cliniques sensibles de leur usage prévu. Décision : un mécanisme dédié,
-- minimal et découplé du système d'entretiens (jamais touché), sur un référentiel
-- fixe de tags positifs (cf. lib/icc.ts), rattaché à une formation précise
-- (cohérent avec "propre à la formation en cours", §4.1).
-- ============================================================================
create table if not exists public.icc_observations_savoir_etre (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  formation_id uuid not null references public.formations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  tag text not null,
  evalue_par uuid references public.profiles(id),
  date_observation timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_icc_competences_formation_id on public.icc_competences(formation_id);
create index if not exists idx_icc_evaluations_savoir_beneficiaire_id on public.icc_evaluations_savoir(beneficiaire_id);
create index if not exists idx_icc_evaluations_savoir_faire_beneficiaire_id on public.icc_evaluations_savoir_faire(beneficiaire_id);
create index if not exists idx_icc_observations_savoir_etre_beneficiaire_id on public.icc_observations_savoir_etre(beneficiaire_id);

create trigger set_updated_at before update on public.icc_competences for each row execute function public.set_updated_at();
create trigger audit_icc_competences after insert or update or delete on public.icc_competences for each row execute function public.log_audit();
create trigger audit_icc_evaluations_savoir after insert or update or delete on public.icc_evaluations_savoir for each row execute function public.log_audit();
create trigger audit_icc_evaluations_savoir_faire after insert or update or delete on public.icc_evaluations_savoir_faire for each row execute function public.log_audit();
create trigger audit_icc_observations_savoir_etre after insert or update or delete on public.icc_observations_savoir_etre for each row execute function public.log_audit();

alter table public.icc_competences enable row level security;
alter table public.icc_evaluations_savoir enable row level security;
alter table public.icc_evaluations_savoir_faire enable row level security;
alter table public.icc_observations_savoir_etre enable row level security;

-- icc_competences : lecture ouverte au bénéficiaire concerné (le référentiel de sa
-- propre formation, jamais celui d'un autre bénéficiaire), écriture praticien.
create policy icc_competences_select on public.icc_competences for select using (
  public.is_fondateur()
  or public.peut_lire('icc_competences', organisation_id)
  or exists (
    select 1 from public.beneficiaires b
    join public.inscriptions_formations i on i.formation_id = icc_competences.formation_id and i.acheteur_id = b.profile_id
    where b.profile_id = auth.uid()
  )
);
create policy icc_competences_insert on public.icc_competences for insert with check (public.is_fondateur() or public.peut_creer('icc_competences', organisation_id));
create policy icc_competences_update on public.icc_competences for update using (public.is_fondateur() or public.peut_modifier('icc_competences', organisation_id));
create policy icc_competences_delete on public.icc_competences for delete using (public.is_fondateur() or public.peut_supprimer('icc_competences', organisation_id));

-- icc_evaluations_savoir / icc_evaluations_savoir_faire / icc_observations_savoir_etre :
-- même règle — le bénéficiaire lit ses propres évaluations, jamais celles d'un autre ;
-- écriture réservée au praticien (jamais auto-évalué par le bénéficiaire lui-même,
-- cohérent avec le reste du projet où le praticien reste seul évaluateur).
create policy icc_evaluations_savoir_select on public.icc_evaluations_savoir for select using (
  public.is_fondateur()
  or public.peut_lire('icc_evaluations_savoir', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = icc_evaluations_savoir.beneficiaire_id and b.profile_id = auth.uid())
);
create policy icc_evaluations_savoir_insert on public.icc_evaluations_savoir for insert with check (public.is_fondateur() or public.peut_creer('icc_evaluations_savoir', organisation_id));
create policy icc_evaluations_savoir_update on public.icc_evaluations_savoir for update using (public.is_fondateur() or public.peut_modifier('icc_evaluations_savoir', organisation_id));

create policy icc_evaluations_savoir_faire_select on public.icc_evaluations_savoir_faire for select using (
  public.is_fondateur()
  or public.peut_lire('icc_evaluations_savoir_faire', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = icc_evaluations_savoir_faire.beneficiaire_id and b.profile_id = auth.uid())
);
create policy icc_evaluations_savoir_faire_insert on public.icc_evaluations_savoir_faire for insert with check (public.is_fondateur() or public.peut_creer('icc_evaluations_savoir_faire', organisation_id));
create policy icc_evaluations_savoir_faire_update on public.icc_evaluations_savoir_faire for update using (public.is_fondateur() or public.peut_modifier('icc_evaluations_savoir_faire', organisation_id));

create policy icc_observations_savoir_etre_select on public.icc_observations_savoir_etre for select using (
  public.is_fondateur()
  or public.peut_lire('icc_observations_savoir_etre', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = icc_observations_savoir_etre.beneficiaire_id and b.profile_id = auth.uid())
);
create policy icc_observations_savoir_etre_insert on public.icc_observations_savoir_etre for insert with check (public.is_fondateur() or public.peut_creer('icc_observations_savoir_etre', organisation_id));

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','icc_competences', true, true, true, true),
  ('administrateur','icc_competences', true, true, true, false),
  ('educateur','icc_competences', true, true, true, false),
  ('psychologue','icc_competences', true, true, true, false),
  ('coordinateur','icc_competences', true, true, true, false),
  ('fondateur','icc_evaluations_savoir', true, true, true, true),
  ('administrateur','icc_evaluations_savoir', true, true, true, false),
  ('educateur','icc_evaluations_savoir', true, true, true, false),
  ('psychologue','icc_evaluations_savoir', true, true, true, false),
  ('coordinateur','icc_evaluations_savoir', true, true, true, false),
  ('fondateur','icc_evaluations_savoir_faire', true, true, true, true),
  ('administrateur','icc_evaluations_savoir_faire', true, true, true, false),
  ('educateur','icc_evaluations_savoir_faire', true, true, true, false),
  ('psychologue','icc_evaluations_savoir_faire', true, true, true, false),
  ('coordinateur','icc_evaluations_savoir_faire', true, true, true, false),
  ('fondateur','icc_observations_savoir_etre', true, true, true, true),
  ('administrateur','icc_observations_savoir_etre', true, true, false, false),
  ('educateur','icc_observations_savoir_etre', true, true, false, false),
  ('psychologue','icc_observations_savoir_etre', true, true, false, false),
  ('coordinateur','icc_observations_savoir_etre', true, true, false, false)
on conflict (role, module) do nothing;
