-- Module "Quiz de révision" — T5 (encouragement/rappels, handoff v3 §9).
-- Aucune nouvelle table pour la progression/répétition espacée (calculée à la lecture
-- depuis quiz_revision_tentatives, déjà en place) — seule une petite table est
-- nécessaire pour le mot de reconnaissance du formateur (texte libre, saisi
-- manuellement, jamais généré). Migration additive uniquement.
create table if not exists public.notes_encouragement_revision (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  message text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  affichee_at timestamptz
);

create index if not exists idx_notes_encouragement_revision_beneficiaire_id on public.notes_encouragement_revision(beneficiaire_id);

alter table public.notes_encouragement_revision enable row level security;

create policy notes_encouragement_revision_select on public.notes_encouragement_revision
  for select using (
    public.is_fondateur()
    or public.peut_lire('notes_encouragement_revision', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = notes_encouragement_revision.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy notes_encouragement_revision_insert on public.notes_encouragement_revision
  for insert with check (
    public.is_fondateur() or public.peut_creer('notes_encouragement_revision', organisation_id)
  );
-- Marquer "affichée" est la seule écriture permise au bénéficiaire lui-même (pas de
-- modification du message par qui que ce soit d'autre que sa création initiale).
create policy notes_encouragement_revision_update_soi on public.notes_encouragement_revision
  for update using (
    exists (select 1 from public.beneficiaires b where b.id = notes_encouragement_revision.beneficiaire_id and b.profile_id = auth.uid())
  );

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','notes_encouragement_revision', true, true, false, false),
  ('directeur','notes_encouragement_revision', true, true, false, false),
  ('promoteur','notes_encouragement_revision', true, true, false, false),
  ('coordinateur','notes_encouragement_revision', true, true, false, false),
  ('educateur','notes_encouragement_revision', true, true, false, false),
  ('formateur','notes_encouragement_revision', true, true, false, false),
  ('administrateur','notes_encouragement_revision', true, true, false, false)
on conflict (role, module) do nothing;
