-- Compte Solo — améliorations (PROMPT-AMELIORATIONS-COMPTE-SOLO-1.md)
-- Réutilise l'existant au maximum : messagerie directe = table `messages` (Étape 20,
-- déjà dotée de destinataire_beneficiaire_id) ; centre de notifications = table
-- `notifications` (Étape 20) alimentée par de nouveaux triggers, pas de nouvelle table.
-- Migration additive uniquement.

-- ============================================================================
-- Correctif de trou de permission réel : le propriétaire d'un Compte Solo a le rôle
-- 'administrateur' (trigger de bootstrap), pas 'fondateur'. Or aucune ligne de
-- permissions n'existait pour 'administrateur' sur inscriptions_formations/
-- progression_formation/certificats/paiements_formation (Étape Compte Solo initiale
-- ne couvrait que fondateur/formateur/coach/consultant/enseignant). Sans ce correctif,
-- un compte Solo non-fondateur ne peut pas lire ses propres ventes de formations.
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('administrateur','inscriptions_formations', true, false, true, false),
  ('administrateur','progression_formation', true, true, true, false),
  ('administrateur','certificats', true, false, false, false),
  ('administrateur','paiements_formation', true, true, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- T1 — objectifs_beneficiaire (jalons / feuille de route par bénéficiaire)
-- ============================================================================
create table if not exists public.objectifs_beneficiaire (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  titre text not null,
  description text,
  statut text not null default 'a_venir' check (statut in ('a_venir','en_cours','atteint')),
  ordre int not null default 0,
  date_cible date,
  atteint_le timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_objectifs_beneficiaire_beneficiaire_id on public.objectifs_beneficiaire(beneficiaire_id);
create index if not exists idx_objectifs_beneficiaire_organisation_id on public.objectifs_beneficiaire(organisation_id);

create trigger set_updated_at before update on public.objectifs_beneficiaire
  for each row execute function public.set_updated_at();
create trigger audit_objectifs_beneficiaire after insert or update or delete on public.objectifs_beneficiaire
  for each row execute function public.log_audit();

alter table public.objectifs_beneficiaire enable row level security;

-- même logique que dossiers_beneficiaires (Étape 5) : staff org-scope OU le bénéficiaire
-- lui-même en lecture seule sur sa propre ligne (jamais peut_lire=true org-large pour 'beneficiaire').
create policy objectifs_beneficiaire_select on public.objectifs_beneficiaire
  for select using (
    public.is_fondateur()
    or public.peut_lire('objectifs_beneficiaire', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = objectifs_beneficiaire.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy objectifs_beneficiaire_insert on public.objectifs_beneficiaire
  for insert with check (public.is_fondateur() or public.peut_creer('objectifs_beneficiaire', organisation_id));
create policy objectifs_beneficiaire_update on public.objectifs_beneficiaire
  for update using (public.is_fondateur() or public.peut_modifier('objectifs_beneficiaire', organisation_id));
create policy objectifs_beneficiaire_delete on public.objectifs_beneficiaire
  for delete using (public.is_fondateur() or public.peut_supprimer('objectifs_beneficiaire', organisation_id));

-- ============================================================================
-- T2 — avis_formations (notes et commentaires des élèves)
-- ============================================================================
create table if not exists public.avis_formations (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  acheteur_id uuid not null references public.profiles(id),
  note int not null check (note between 1 and 5),
  commentaire text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (formation_id, acheteur_id)
);

create index if not exists idx_avis_formations_formation_id on public.avis_formations(formation_id);
create index if not exists idx_avis_formations_organisation_id on public.avis_formations(organisation_id);

create trigger set_updated_at before update on public.avis_formations
  for each row execute function public.set_updated_at();

-- vue : note moyenne + nombre d'avis par formation, jamais stockée en dur sur formations
create or replace view public.vue_notes_formations
with (security_invoker = true) as
select formation_id, round(avg(note)::numeric, 1) as note_moyenne, count(*) as nombre_avis
from public.avis_formations
group by formation_id;

alter table public.avis_formations enable row level security;

-- lecture : même visibilité que la formation elle-même (publique si publiée, ou vendeur/acheteur)
create policy avis_formations_select on public.avis_formations
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.formations f where f.id = avis_formations.formation_id and f.statut = 'publiee')
    or public.peut_lire('avis_formations', organisation_id)
    or acheteur_id = auth.uid()
  );
-- écriture : seul un acheteur ayant réellement une inscription à cette formation peut laisser un avis
create policy avis_formations_insert on public.avis_formations
  for insert with check (
    acheteur_id = auth.uid()
    and exists (select 1 from public.inscriptions_formations i where i.formation_id = avis_formations.formation_id and i.acheteur_id = auth.uid())
  );
create policy avis_formations_update on public.avis_formations
  for update using (acheteur_id = auth.uid());
create policy avis_formations_delete on public.avis_formations
  for delete using (acheteur_id = auth.uid() or public.is_fondateur());

-- ============================================================================
-- T3 — profils_publics_formateurs (bio + spécialités affichées sur le profil public)
-- ============================================================================
create table if not exists public.profils_publics_formateurs (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  bio text,
  specialites text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.profils_publics_formateurs
  for each row execute function public.set_updated_at();

alter table public.profils_publics_formateurs enable row level security;

create policy profils_publics_formateurs_select on public.profils_publics_formateurs
  for select using (true); -- même visibilité ouverte que formations_select_publique (vitrine marketplace)
create policy profils_publics_formateurs_insert on public.profils_publics_formateurs
  for insert with check (public.is_fondateur() or public.peut_creer('formations', organisation_id));
create policy profils_publics_formateurs_update on public.profils_publics_formateurs
  for update using (public.is_fondateur() or public.peut_modifier('formations', organisation_id));

-- ============================================================================
-- T4 — seances (calendrier : suivi bénéficiaire ou session live de formation)
-- ============================================================================
create table if not exists public.seances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  beneficiaire_id uuid references public.beneficiaires(id) on delete cascade,
  formation_id uuid references public.formations(id) on delete cascade,
  titre text not null,
  type_seance text not null check (type_seance in ('suivi','session_live')),
  date_heure timestamptz not null,
  statut text not null default 'planifiee' check (statut in ('planifiee','terminee','annulee')),
  rappel_envoye boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (beneficiaire_id is not null or formation_id is not null)
);

create index if not exists idx_seances_organisation_id on public.seances(organisation_id);
create index if not exists idx_seances_beneficiaire_id on public.seances(beneficiaire_id);
create index if not exists idx_seances_date_heure on public.seances(date_heure);

create trigger set_updated_at before update on public.seances
  for each row execute function public.set_updated_at();
create trigger audit_seances after insert or update or delete on public.seances
  for each row execute function public.log_audit();

alter table public.seances enable row level security;

create policy seances_select on public.seances
  for select using (
    public.is_fondateur()
    or public.peut_lire('seances', organisation_id)
    or exists (select 1 from public.beneficiaires b where b.id = seances.beneficiaire_id and b.profile_id = auth.uid())
  );
create policy seances_insert on public.seances
  for insert with check (public.is_fondateur() or public.peut_creer('seances', organisation_id));
create policy seances_update on public.seances
  for update using (public.is_fondateur() or public.peut_modifier('seances', organisation_id));
create policy seances_delete on public.seances
  for delete using (public.is_fondateur() or public.peut_supprimer('seances', organisation_id));

-- ============================================================================
-- T5 — ressources_formation (fichiers joints, Supabase Storage bucket privé)
-- ============================================================================
create table if not exists public.ressources_formation (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom_fichier text not null,
  chemin_storage text not null,
  taille_octets bigint,
  type_mime text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_ressources_formation_formation_id on public.ressources_formation(formation_id);

alter table public.ressources_formation enable row level security;

create policy ressources_formation_select on public.ressources_formation
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.formations f where f.id = ressources_formation.formation_id and f.statut = 'publiee')
    or public.peut_lire('ressources_formation', organisation_id)
  );
create policy ressources_formation_insert on public.ressources_formation
  for insert with check (public.is_fondateur() or public.peut_creer('ressources_formation', organisation_id));
create policy ressources_formation_delete on public.ressources_formation
  for delete using (public.is_fondateur() or public.peut_supprimer('ressources_formation', organisation_id));

-- bucket privé : le contrôle d'accès passe par les policies storage.objects ci-dessous,
-- jamais par une URL publique statique (donnée pédagogique = pas de lien non authentifié).
insert into storage.buckets (id, name, public)
values ('ressources-formations', 'ressources-formations', false)
on conflict (id) do nothing;

-- convention de chemin : <formation_id>/<nom_fichier> — (storage.foldername(name))[1] = formation_id
create policy ressources_formation_storage_select on storage.objects
  for select using (
    bucket_id = 'ressources-formations'
    and (
      public.is_fondateur()
      or exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1] and f.statut = 'publiee')
      or exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1] and public.peut_lire('ressources_formation', f.organisation_id))
    )
  );
create policy ressources_formation_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'ressources-formations'
    and exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1] and (public.is_fondateur() or public.peut_creer('ressources_formation', f.organisation_id)))
  );
create policy ressources_formation_storage_delete on storage.objects
  for delete using (
    bucket_id = 'ressources-formations'
    and exists (select 1 from public.formations f where f.id::text = (storage.foldername(name))[1] and (public.is_fondateur() or public.peut_supprimer('ressources_formation', f.organisation_id)))
  );

-- ============================================================================
-- T6 — centre de notifications : réutilise `notifications` (Étape 20), aucune
-- nouvelle table. Fonction générique + triggers sur les événements réels du
-- Compte Solo (nouvelle inscription, paiement confirmé, nouvel avis).
-- ============================================================================
create or replace function public.notifier_membres_organisation(p_organisation_id uuid, p_titre text, p_contenu text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (profile_id, organisation_id, titre, contenu, type_notification)
  select mo.profile_id, p_organisation_id, p_titre, p_contenu, p_type
  from public.membres_organisations mo
  where mo.organisation_id = p_organisation_id and mo.statut = 'actif';
end;
$$;

create or replace function public.notifier_nouvelle_inscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre_formation text;
begin
  select titre into v_titre_formation from public.formations where id = new.formation_id;
  perform public.notifier_membres_organisation(
    new.organisation_id,
    'Nouvelle inscription',
    format('Un élève vient de s''inscrire à « %s ».', coalesce(v_titre_formation, 'une formation')),
    'inscription_formation'
  );
  return new;
end;
$$;

create trigger on_inscription_notifier
  after insert on public.inscriptions_formations
  for each row execute function public.notifier_nouvelle_inscription();

create or replace function public.notifier_paiement_confirme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id uuid;
begin
  if new.statut = 'confirme' then
    select organisation_id into v_organisation_id from public.inscriptions_formations where id = new.inscription_id;
    perform public.notifier_membres_organisation(
      v_organisation_id,
      'Paiement reçu',
      format('Un paiement de %s %s a été confirmé.', new.montant, new.devise),
      'paiement_formation'
    );
  end if;
  return new;
end;
$$;

create trigger on_paiement_formation_notifier
  after insert on public.paiements_formation
  for each row execute function public.notifier_paiement_confirme();

create or replace function public.notifier_nouvel_avis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre_formation text;
begin
  select titre into v_titre_formation from public.formations where id = new.formation_id;
  perform public.notifier_membres_organisation(
    new.organisation_id,
    'Nouvel avis reçu',
    format('Un élève a laissé un avis (%s/5) sur « %s ».', new.note, coalesce(v_titre_formation, 'une formation')),
    'avis_formation'
  );
  return new;
end;
$$;

create trigger on_avis_formation_notifier
  after insert on public.avis_formations
  for each row execute function public.notifier_nouvel_avis();

-- ============================================================================
-- T7 — rappels de séances : pas d'infrastructure de tâche planifiée (cron) dans
-- ce projet à ce jour, ni d'envoi d'email nulle part ailleurs dans l'app (vérifié :
-- aucune lib d'email dans package.json). Rappel implémenté en notification interne
-- uniquement, calculé paresseusement à l'ouverture de la page Calendrier plutôt que
-- par un job planifié — limite assumée et documentée dans DECISIONS_LOG.md.
-- ============================================================================
create or replace function public.verifier_rappels_seances(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance record;
begin
  for v_seance in
    select id, titre, date_heure from public.seances
    where organisation_id = p_organisation_id
      and statut = 'planifiee'
      and rappel_envoye = false
      and date_heure between now() and now() + interval '24 hours'
  loop
    perform public.notifier_membres_organisation(
      p_organisation_id,
      'Rappel de séance',
      format('« %s » est prévue le %s.', v_seance.titre, to_char(v_seance.date_heure, 'DD/MM/YYYY à HH24:MI')),
      'rappel_seance'
    );
    update public.seances set rappel_envoye = true where id = v_seance.id;
  end loop;
end;
$$;

-- ============================================================================
-- T8 — seed permissions pour les nouveaux modules
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','objectifs_beneficiaire', true, true, true, true),
  ('fondateur','avis_formations', true, true, true, true),
  ('fondateur','seances', true, true, true, true),
  ('fondateur','ressources_formation', true, true, true, true),
  ('administrateur','objectifs_beneficiaire', true, true, true, false),
  ('administrateur','seances', true, true, true, false),
  ('administrateur','ressources_formation', true, true, false, true),
  ('educateur','objectifs_beneficiaire', true, true, true, false),
  ('psychologue','objectifs_beneficiaire', true, true, true, false),
  ('assistant_social','objectifs_beneficiaire', true, true, true, false),
  ('formateur','seances', true, true, true, false),
  ('formateur','ressources_formation', true, true, false, true),
  ('coach','seances', true, true, true, false),
  ('coach','ressources_formation', true, true, false, true),
  ('consultant','seances', true, true, true, false),
  ('enseignant','seances', true, true, true, false),
  ('enseignant','ressources_formation', true, true, false, true)
on conflict (role, module) do nothing;
