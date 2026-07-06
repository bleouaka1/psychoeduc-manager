-- Étape 20 — Communication / WhatsApp (architecture v5)
-- Réf : docs/PsychoEduc_Manager_Architecture_v5.md, section 22
-- Champ officiel notifications.est_lue -- jamais "lu". Migration additive uniquement.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  expediteur_id uuid references public.profiles(id),
  destinataire_id uuid references public.profiles(id),
  destinataire_beneficiaire_id uuid references public.beneficiaires(id) on delete cascade,
  contenu text not null,
  canal text check (canal in ('interne','email','sms')),
  statut text not null default 'envoye' check (statut in ('envoye','lu','echoue')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages_whatsapp (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  destinataire_telephone text,
  contenu text,
  statut text not null default 'en_attente' check (statut in ('en_attente','envoye','livre','echoue')),
  reference_externe text,
  envoye_le timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.campagnes_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text not null,
  canal text check (canal in ('whatsapp','email','sms')),
  contenu_modele text,
  cible_type text,
  statut text not null default 'brouillon' check (statut in ('brouillon','en_cours','terminee')),
  date_lancement timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modeles_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  nom text not null,
  canal text,
  contenu text,
  variables jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  titre text,
  contenu text,
  type_notification text,
  est_lue boolean not null default false,
  created_at timestamptz not null default now()
);

-- index
create index if not exists idx_messages_organisation_id on public.messages(organisation_id);
create index if not exists idx_messages_expediteur_id on public.messages(expediteur_id);
create index if not exists idx_messages_destinataire_id on public.messages(destinataire_id);
create index if not exists idx_messages_whatsapp_organisation_id on public.messages_whatsapp(organisation_id);
create index if not exists idx_campagnes_messages_organisation_id on public.campagnes_messages(organisation_id);
create index if not exists idx_modeles_messages_organisation_id on public.modeles_messages(organisation_id);
create index if not exists idx_notifications_profile_id on public.notifications(profile_id);

create trigger set_updated_at before update on public.messages for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.campagnes_messages for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.modeles_messages for each row execute function public.set_updated_at();

-- seed permissions
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','messages', true, true, true, true),
  ('fondateur','messages_whatsapp', true, true, true, true),
  ('fondateur','campagnes_messages', true, true, true, true),
  ('fondateur','modeles_messages', true, true, true, true),
  ('administrateur','campagnes_messages', true, true, true, false),
  ('administrateur','modeles_messages', true, true, true, false),
  ('coordinateur','campagnes_messages', true, true, true, false)
on conflict (role, module) do nothing;

-- RLS
alter table public.messages enable row level security;
alter table public.messages_whatsapp enable row level security;
alter table public.campagnes_messages enable row level security;
alter table public.modeles_messages enable row level security;
alter table public.notifications enable row level security;

-- messages : visible par l'expediteur, le destinataire, ou le staff habilite
create policy messages_select on public.messages
  for select using (
    public.is_fondateur()
    or expediteur_id = auth.uid()
    or destinataire_id = auth.uid()
    or public.peut_lire('messages', organisation_id)
  );
create policy messages_insert on public.messages
  for insert with check (public.is_fondateur() or expediteur_id = auth.uid() or public.peut_creer('messages', organisation_id));
create policy messages_update on public.messages
  for update using (public.is_fondateur() or destinataire_id = auth.uid() or public.peut_modifier('messages', organisation_id));

create policy messages_whatsapp_select on public.messages_whatsapp for select using (public.is_fondateur() or public.peut_lire('messages_whatsapp', organisation_id));
create policy messages_whatsapp_insert on public.messages_whatsapp for insert with check (public.is_fondateur() or public.peut_creer('messages_whatsapp', organisation_id));
create policy messages_whatsapp_update on public.messages_whatsapp for update using (public.is_fondateur() or public.peut_modifier('messages_whatsapp', organisation_id));

create policy campagnes_messages_select on public.campagnes_messages for select using (public.is_fondateur() or public.peut_lire('campagnes_messages', organisation_id));
create policy campagnes_messages_insert on public.campagnes_messages for insert with check (public.is_fondateur() or public.peut_creer('campagnes_messages', organisation_id));
create policy campagnes_messages_update on public.campagnes_messages for update using (public.is_fondateur() or public.peut_modifier('campagnes_messages', organisation_id));
create policy campagnes_messages_delete on public.campagnes_messages for delete using (public.is_fondateur() or public.peut_supprimer('campagnes_messages', organisation_id));

create policy modeles_messages_select on public.modeles_messages for select using (public.is_fondateur() or organisation_id is null or public.peut_lire('modeles_messages', organisation_id));
create policy modeles_messages_insert on public.modeles_messages for insert with check (public.is_fondateur() or (organisation_id is not null and public.peut_creer('modeles_messages', organisation_id)));
create policy modeles_messages_update on public.modeles_messages for update using (public.is_fondateur() or (organisation_id is not null and public.peut_modifier('modeles_messages', organisation_id)));
create policy modeles_messages_delete on public.modeles_messages for delete using (public.is_fondateur() or (organisation_id is not null and public.peut_supprimer('modeles_messages', organisation_id)));

-- notifications : chacun voit et met a jour uniquement les siennes ; creation restreinte
-- (fondateur, soi-meme, ou personnel habilite de l'organisation ciblee) pour eviter le spam
create policy notifications_select on public.notifications for select using (public.is_fondateur() or profile_id = auth.uid());
create policy notifications_insert on public.notifications for insert with check (
  public.is_fondateur()
  or profile_id = auth.uid()
  or (organisation_id is not null and public.peut_creer('messages', organisation_id))
);
create policy notifications_update on public.notifications for update using (public.is_fondateur() or profile_id = auth.uid());
