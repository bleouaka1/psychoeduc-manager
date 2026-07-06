-- Étape 17 — Événements (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 19
-- Migration additive uniquement.

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  createur_type text check (createur_type in ('fondateur','organisation','solo')),
  createur_id uuid,
  titre text not null,
  description text,
  type_evenement text check (type_evenement in ('gratuit','payant')),
  prix numeric,
  devise text not null default 'FCFA',
  date_debut timestamptz,
  date_fin timestamptz,
  lieu_type text check (lieu_type in ('physique','en_ligne')),
  lieu_details text,
  capacite_max int,
  places_restantes int,
  statut text not null default 'en_attente_validation' check (statut in ('en_attente_validation','publie','refuse','annule','termine')),
  valide_par uuid references public.profiles(id),
  date_validation timestamptz,
  organisation_id uuid references public.organisations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si createur_type = fondateur -> publie directement. Sinon en_attente_validation,
-- meme file que la marketplace. Transition ulterieure vers publie/refuse reservee au fondateur.
create or replace function public.enforce_evenement_statut()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.createur_type = 'fondateur' then
      new.statut := 'publie';
      new.date_validation := now();
    else
      new.statut := 'en_attente_validation';
    end if;
  elsif TG_OP = 'UPDATE' and new.statut is distinct from old.statut and new.statut in ('publie','refuse') then
    if not public.is_fondateur() then
      raise exception 'Seul le fondateur peut valider ou refuser un evenement';
    end if;
    new.date_validation := now();
  end if;
  return new;
end;
$$;

create trigger enforce_evenement_statut before insert or update on public.evenements
  for each row execute function public.enforce_evenement_statut();

-- append-only (meme pattern que marketplace_commandes)
create table if not exists public.evenements_inscriptions (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  participant_id uuid references public.profiles(id),
  statut_paiement text not null default 'non_requis' check (statut_paiement in ('non_requis','initie','confirme','echoue','rembourse')),
  montant_paye numeric,
  mouvement_financier_id uuid references public.mouvements_financiers(id),
  date_inscription timestamptz not null default now()
);

create table if not exists public.evenements_rappels (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  canal text check (canal in ('whatsapp','email')),
  envoye_le timestamptz not null default now()
);

-- index
create index if not exists idx_evenements_organisation_id on public.evenements(organisation_id);
create index if not exists idx_evenements_createur_id on public.evenements(createur_id);
create index if not exists idx_evenements_inscriptions_evenement_id on public.evenements_inscriptions(evenement_id);
create index if not exists idx_evenements_rappels_evenement_id on public.evenements_rappels(evenement_id);

create trigger set_updated_at before update on public.evenements for each row execute function public.set_updated_at();
create trigger audit_evenements after insert or update or delete on public.evenements for each row execute function public.log_audit();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','evenements', true, true, true, true),
  ('fondateur','evenements_inscriptions', true, true, false, false),
  ('fondateur','evenements_rappels', true, true, true, true),
  ('administrateur','evenements', true, true, true, false),
  ('coordinateur','evenements', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.evenements enable row level security;
alter table public.evenements_inscriptions enable row level security;
alter table public.evenements_rappels enable row level security;

create policy evenements_select on public.evenements
  for select using (
    statut = 'publie'
    or public.is_fondateur()
    or createur_id = auth.uid()
    or (organisation_id is not null and public.peut_lire('evenements', organisation_id))
  );
create policy evenements_insert on public.evenements
  for insert with check (
    public.is_fondateur()
    or createur_id = auth.uid()
    or (organisation_id is not null and public.peut_creer('evenements', organisation_id))
  );
create policy evenements_update on public.evenements
  for update using (
    public.is_fondateur()
    or createur_id = auth.uid()
    or (organisation_id is not null and public.peut_modifier('evenements', organisation_id))
  );
create policy evenements_delete on public.evenements
  for delete using (public.is_fondateur() or createur_id = auth.uid());

create policy evenements_inscriptions_select on public.evenements_inscriptions
  for select using (
    public.is_fondateur()
    or participant_id = auth.uid()
    or exists (select 1 from public.evenements e where e.id = evenements_inscriptions.evenement_id and (e.createur_id = auth.uid() or (e.organisation_id is not null and public.peut_lire('evenements_inscriptions', e.organisation_id))))
  );
create policy evenements_inscriptions_insert on public.evenements_inscriptions
  for insert with check (public.is_fondateur() or participant_id = auth.uid());

create policy evenements_rappels_select on public.evenements_rappels
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.evenements e where e.id = evenements_rappels.evenement_id and (e.createur_id = auth.uid() or (e.organisation_id is not null and public.peut_lire('evenements_rappels', e.organisation_id))))
  );
create policy evenements_rappels_insert on public.evenements_rappels
  for insert with check (
    public.is_fondateur()
    or exists (select 1 from public.evenements e where e.id = evenements_rappels.evenement_id and (e.createur_id = auth.uid() or (e.organisation_id is not null and public.peut_creer('evenements_rappels', e.organisation_id))))
  );
