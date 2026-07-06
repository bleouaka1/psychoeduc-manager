-- Étape 18 — Réussites (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 20
-- Migration additive uniquement.

create table if not exists public.reussites_beneficiaires (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  projet_vie_id uuid references public.projets_vie(id) on delete set null,
  insertion_id uuid references public.insertions_professionnelles(id) on delete set null,
  statut text not null default 'proposee_systeme' check (statut in ('proposee_systeme','confirmee','rejetee')),
  score_iga_au_moment numeric,
  duree_insertion_mois int,
  projet_vie_valide boolean,
  confirmee_par uuid references public.profiles(id),
  date_confirmation timestamptz,
  temoignage text,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Proposition automatique : projet de vie valide ET maintien en poste >= 3 mois (~90 jours).
-- Reste 'proposee_systeme' (invisible des stats officielles) jusqu'a confirmation humaine.
-- Le trigger ne fait que PROPOSER, jamais confirmer -- decision humaine toujours requise.
create or replace function public.check_propose_reussite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insertion public.insertions_professionnelles%rowtype;
  v_projet_vie public.projets_vie%rowtype;
  v_score_iga numeric;
  v_deja_existe boolean;
  v_duree_mois int;
begin
  select * into v_insertion from public.insertions_professionnelles where id = new.insertion_id;
  if not found then
    return new;
  end if;

  select * into v_projet_vie from public.projets_vie where beneficiaire_id = v_insertion.beneficiaire_id;
  if not found or v_projet_vie.statut <> 'valide' then
    return new;
  end if;

  if new.statut_maintien is distinct from 'maintenu' then
    return new;
  end if;

  if (new.date_suivi - v_insertion.date_debut) < 90 then
    return new;
  end if;

  select exists(
    select 1 from public.reussites_beneficiaires
    where beneficiaire_id = v_insertion.beneficiaire_id and insertion_id = v_insertion.id
  ) into v_deja_existe;
  if v_deja_existe then
    return new;
  end if;

  select score_global into v_score_iga
  from public.evaluations_iga
  where beneficiaire_id = v_insertion.beneficiaire_id
  order by date_evaluation desc, created_at desc
  limit 1;

  v_duree_mois := extract(year from age(new.date_suivi, v_insertion.date_debut))::int * 12
    + extract(month from age(new.date_suivi, v_insertion.date_debut))::int;

  insert into public.reussites_beneficiaires (
    beneficiaire_id, projet_vie_id, insertion_id, statut,
    score_iga_au_moment, duree_insertion_mois, projet_vie_valide, organisation_id
  ) values (
    v_insertion.beneficiaire_id, v_projet_vie.id, v_insertion.id, 'proposee_systeme',
    v_score_iga, v_duree_mois, true, v_insertion.organisation_id
  );

  return new;
end;
$$;

create trigger on_suivi_post_insertion_check_reussite
  after insert or update on public.suivis_post_insertion
  for each row execute function public.check_propose_reussite();

-- index
create index if not exists idx_reussites_beneficiaires_beneficiaire_id on public.reussites_beneficiaires(beneficiaire_id);
create index if not exists idx_reussites_beneficiaires_organisation_id on public.reussites_beneficiaires(organisation_id);
create index if not exists idx_reussites_beneficiaires_statut on public.reussites_beneficiaires(statut);

create trigger audit_reussites_beneficiaires after insert or update or delete on public.reussites_beneficiaires
  for each row execute function public.log_audit();

-- seed permissions : confirmation/rejet reserves aux roles habilites
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','reussites_beneficiaires', true, true, true, true),
  ('administrateur','reussites_beneficiaires', true, false, false, false),
  ('coordinateur','reussites_beneficiaires', true, false, true, false),
  ('educateur','reussites_beneficiaires', true, false, true, false),
  ('coach','reussites_beneficiaires', true, false, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.reussites_beneficiaires enable row level security;

create policy reussites_beneficiaires_select on public.reussites_beneficiaires
  for select using (public.is_fondateur() or public.peut_lire('reussites_beneficiaires', organisation_id));
create policy reussites_beneficiaires_update on public.reussites_beneficiaires
  for update using (public.is_fondateur() or public.peut_modifier('reussites_beneficiaires', organisation_id));
