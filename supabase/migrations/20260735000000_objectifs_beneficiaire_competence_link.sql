-- Dashboard bénéficiaire v2, Lot C — lien Objectifs↔ICC (prompt du 2026-07-25 §15-16).
-- Additif et nullable : un objectif reste parfaitement valide sans compétence liée.
-- `on delete set null` (pas cascade) : la suppression d'une compétence ICC ne doit
-- jamais entraîner la suppression silencieuse d'un objectif du bénéficiaire.
alter table public.objectifs_beneficiaire
  add column if not exists competence_id uuid references public.icc_competences(id) on delete set null;

create index if not exists idx_objectifs_beneficiaire_competence_id on public.objectifs_beneficiaire(competence_id);
