-- Module "Quiz de révision" (handoff-quiz-revision-ia-2.md) — T1/8 : Schéma + RLS.
-- Écarts documentés par rapport au document source (voir PLAN_QUIZ_REVISION.md) :
-- réutilise `documents_beneficiaires` (Étape 5) plutôt qu'une nouvelle table
-- `quiz_documents` ; `profiles(id)` partout plutôt que `users(id)` (inexistante ici) ;
-- toute transaction avec mouvement d'argent réel écrit aussi dans `mouvements_financiers`
-- (Étape 15) plutôt qu'un deuxième ledger isolé.
-- **Collision de nom réelle détectée avant application** : une table `quiz` existe déjà
-- (système pédagogique lié à `cours`, sans rapport avec ce module) — nommé `quiz_revision`/
-- `quiz_revision_tentatives` ici pour l'éviter, jamais touché la table existante.
-- Migration additive uniquement.

-- ============================================================================
-- T1.1 — extension de documents_beneficiaires pour les sources de quiz
-- ============================================================================
alter table public.documents_beneficiaires
  add column if not exists type_source text not null default 'document' check (type_source in ('document', 'youtube_sous_titres', 'youtube_transcription', 'video_upload')),
  add column if not exists source_url text,
  add column if not exists duree_video_sec int,
  add column if not exists valide_par uuid references public.profiles(id),
  add column if not exists valide_at timestamptz;

-- Écart réel trouvé et corrigé au passage : documents_beneficiaires_select (Étape 5)
-- n'avait aucune clause pour le bénéficiaire lui-même (uniquement is_fondateur() OU
-- peut_lire scopé à membres_organisations) — un bénéficiaire ne pouvait jamais voir
-- ses propres documents, silencieusement. Même famille de bug que ICC/projets_vie/
-- insertion professionnelle (sessions précédentes). Policy additionnelle (Postgres
-- combine les policies SELECT d'une même table en OR).
create policy documents_beneficiaires_select_soi on public.documents_beneficiaires
  for select using (
    exists (select 1 from public.beneficiaires b where b.id = documents_beneficiaires.beneficiaire_id and b.profile_id = auth.uid())
  );

-- ============================================================================
-- T1.2 — quiz_revision, quiz_revision_tentatives
-- ============================================================================
create table if not exists public.quiz_revision (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents_beneficiaires(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  palier text not null check (palier in ('gratuit', 'payant')),
  niveau_difficulte text not null check (niveau_difficulte in ('standard', 'soutenu', 'excellence')),
  preference_initiale text check (preference_initiale in ('rapide', 'excellence')),
  chrono_mode text not null default 'aucun' check (chrono_mode in ('par_question', 'global', 'aucun')),
  chrono_duree_sec int,
  contenu_json jsonb not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_revision_tentatives (
  id uuid primary key default gen_random_uuid(),
  quiz_revision_id uuid not null references public.quiz_revision(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reponses_json jsonb not null,
  score numeric not null,
  temps_total_sec int,
  completed_at timestamptz not null default now()
);

create index if not exists idx_quiz_revision_beneficiaire_id on public.quiz_revision(beneficiaire_id);
create index if not exists idx_quiz_revision_document_id on public.quiz_revision(document_id);
create index if not exists idx_quiz_revision_tentatives_quiz_id on public.quiz_revision_tentatives(quiz_revision_id);
create index if not exists idx_quiz_revision_tentatives_beneficiaire_id on public.quiz_revision_tentatives(beneficiaire_id);
create index if not exists idx_documents_beneficiaires_type_source on public.documents_beneficiaires(type_source);

alter table public.quiz_revision enable row level security;
alter table public.quiz_revision_tentatives enable row level security;

create policy quiz_revision_select on public.quiz_revision
  for select using (
    public.is_fondateur()
    or public.peut_lire('quiz_revision', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = quiz_revision.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy quiz_revision_insert on public.quiz_revision
  for insert with check (
    public.is_fondateur()
    or public.peut_creer('quiz_revision', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = quiz_revision.beneficiaire_id and b.profile_id = auth.uid())
  );

create policy quiz_revision_tentatives_select on public.quiz_revision_tentatives
  for select using (
    public.is_fondateur()
    or public.peut_lire('quiz_revision_tentatives', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = quiz_revision_tentatives.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy quiz_revision_tentatives_insert on public.quiz_revision_tentatives
  for insert with check (
    public.is_fondateur()
    or exists (select 1 from public.beneficiaires b where b.id = quiz_revision_tentatives.beneficiaire_id and b.profile_id = auth.uid())
  );

-- ============================================================================
-- T1.3 — credits_revision, credits_transactions
-- Écriture réservée aux fonctions serveur (SECURITY DEFINER, à venir T6) — aucune
-- policy INSERT/UPDATE pour authenticated, même principe que audit_logs (Étape 1)
-- et log_audit(). Lecture : bénéficiaire propriétaire + Directeur/Promoteur de sa
-- structure (transparence des crédits offerts), jamais un autre bénéficiaire.
-- ============================================================================
create table if not exists public.credits_revision (
  beneficiaire_id uuid primary key references public.beneficiaires(id) on delete cascade,
  solde int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credits_transactions (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  payeur_type text not null check (payeur_type in ('beneficiaire', 'parent', 'structure')),
  payeur_id uuid not null references public.profiles(id),
  montant_credits int not null,
  montant_paye numeric not null,
  devise text not null default 'XOF',
  moyen_paiement text,
  transaction_ref text,
  statut text not null check (statut in ('en_attente', 'confirme', 'echoue')),
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_credits_transactions_beneficiaire_id on public.credits_transactions(beneficiaire_id);

alter table public.credits_revision enable row level security;
alter table public.credits_transactions enable row level security;

create policy credits_revision_select on public.credits_revision
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.beneficiaires b
      where b.id = credits_revision.beneficiaire_id
        and (b.profile_id = auth.uid() or public.peut_lire('credits_revision', b.organisation_id))
    )
  );

create policy credits_transactions_select on public.credits_transactions
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.beneficiaires b
      where b.id = credits_transactions.beneficiaire_id
        and (b.profile_id = auth.uid() or public.peut_lire('credits_transactions', b.organisation_id))
    )
  );

create trigger set_updated_at before update on public.credits_revision for each row execute function public.set_updated_at();

-- ============================================================================
-- T1.4 — permissions : équipe pédagogique (Directeur/Promoteur/Coordinateur/
-- Éducateur/Formateur), même quatuor que documents_beneficiaires (Étape Compte
-- Structure) + Éducateur explicitement nommé par le document source. Jamais de
-- peut_supprimer=true (suppression logique uniquement, comme partout ailleurs).
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','quiz_revision', true, true, true, true),
  ('fondateur','quiz_revision_tentatives', true, true, true, true),
  ('fondateur','credits_revision', true, true, true, false),
  ('fondateur','credits_transactions', true, true, false, false),
  ('directeur','quiz_revision', true, true, false, false),
  ('directeur','quiz_revision_tentatives', true, false, false, false),
  ('directeur','credits_revision', true, false, false, false),
  ('directeur','credits_transactions', true, false, false, false),
  ('promoteur','quiz_revision', true, true, false, false),
  ('promoteur','quiz_revision_tentatives', true, false, false, false),
  ('promoteur','credits_revision', true, false, false, false),
  ('promoteur','credits_transactions', true, false, false, false),
  ('coordinateur','quiz_revision', true, true, false, false),
  ('coordinateur','quiz_revision_tentatives', true, false, false, false),
  ('educateur','quiz_revision', true, true, false, false),
  ('educateur','quiz_revision_tentatives', true, false, false, false),
  ('formateur','quiz_revision', true, true, false, false),
  ('formateur','quiz_revision_tentatives', true, false, false, false),
  ('administrateur','quiz_revision', true, true, false, false),
  ('administrateur','quiz_revision_tentatives', true, false, false, false),
  ('administrateur','credits_revision', true, false, false, false),
  ('administrateur','credits_transactions', true, false, false, false)
on conflict (role, module) do nothing;
