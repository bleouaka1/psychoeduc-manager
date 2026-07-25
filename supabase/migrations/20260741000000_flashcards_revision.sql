-- Dashboard bénéficiaire v3, Lot I — Flashcards à répétition espacée (§12.1-12.3).
-- Palier base : générées par le même pipeline NLP que le quiz gratuit (aucun coût).
-- Palier avancé : `mnemotechnique` rempli par Haiku (crédits), colonne nullable —
-- absente tant que non générée, jamais un texte inventé côté client.
create table if not exists public.flashcards_revision (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents_beneficiaires(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recto text not null,
  verso text not null,
  mnemotechnique text,
  niveau_maitrise int not null default 0,
  prochaine_revision_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_flashcards_revision_document_id on public.flashcards_revision(document_id);
create index if not exists idx_flashcards_revision_beneficiaire_id on public.flashcards_revision(beneficiaire_id);

alter table public.flashcards_revision enable row level security;

-- Même schéma de policies que documents_beneficiaires/quiz_revision : bénéficiaire
-- propriétaire + équipe pédagogique en lecture, jamais un autre bénéficiaire.
create policy flashcards_revision_select on public.flashcards_revision for select using (
  public.is_fondateur()
  or public.peut_lire('flashcards_revision', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = flashcards_revision.beneficiaire_id and b.profile_id = auth.uid())
);
create policy flashcards_revision_insert on public.flashcards_revision for insert with check (
  public.is_fondateur()
  or public.peut_creer('flashcards_revision', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = flashcards_revision.beneficiaire_id and b.profile_id = auth.uid())
);
create policy flashcards_revision_update on public.flashcards_revision for update using (
  public.is_fondateur()
  or public.peut_modifier('flashcards_revision', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = flashcards_revision.beneficiaire_id and b.profile_id = auth.uid())
);

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur', 'flashcards_revision', true, true, true, false),
  ('directeur', 'flashcards_revision', true, false, false, false),
  ('promoteur', 'flashcards_revision', true, false, false, false),
  ('coordinateur', 'flashcards_revision', true, false, false, false),
  ('educateur', 'flashcards_revision', true, false, false, false),
  ('formateur', 'flashcards_revision', true, false, false, false),
  ('administrateur', 'flashcards_revision', true, false, false, false)
on conflict (role, module) do nothing;
