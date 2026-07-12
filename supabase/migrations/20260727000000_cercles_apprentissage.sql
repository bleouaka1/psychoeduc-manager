-- Tableau de bord bénéficiaire — Phase 4 : Cercles d'apprentissage.
-- Réf : CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §5.
-- Voir PLAN_COMPTES_MULTIPROFILS_DASHBOARD_BENEFICIAIRE.md pour les décisions détaillées.
-- Migration additive uniquement.

-- ============================================================================
-- T1 — cercles_apprentissage + cercles_membres. Réutilise conversations/messages
-- (Messagerie interne, déjà multi-participants via conversation_participants)
-- pour la discussion de groupe plutôt qu'un système de chat dédié — cercle_id
-- pointe vers la conversation de groupe associée.
-- ============================================================================
create table if not exists public.cercles_apprentissage (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  animateur_profile_id uuid not null references public.profiles(id),
  conversation_id uuid references public.conversations(id) on delete set null,
  nom text not null,
  description text,
  charte text,
  reserve_adultes boolean not null default false,
  tarif numeric,
  devise text not null default 'XOF',
  taux_commission numeric not null default public.get_parametre_numerique('taux_commission_marketplace', 0.15),
  statut text not null default 'actif' check (statut in ('actif', 'ferme')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Modération obligatoire si mineur présent (§5.2) : appliquée à l'invitation (logique
-- TypeScript via calculer_age(), pas un trigger — même principe que le reste du
-- projet pour la logique métier). reserve_adultes sert de garde-fou déclaratif :
-- un cercle marqué "réservé aux adultes" ne peut jamais accueillir de mineur.
create table if not exists public.cercles_membres (
  id uuid primary key default gen_random_uuid(),
  cercle_id uuid not null references public.cercles_apprentissage(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  statut text not null default 'invite' check (statut in ('invite', 'actif', 'sorti')),
  invite_par uuid references public.profiles(id),
  date_invitation timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cercle_id, beneficiaire_id)
);

-- ============================================================================
-- T2 — conversation_participants.role_participant élargi pour inclure un
-- bénéficiaire (jamais possible jusqu'ici, la messagerie interne était staff-only).
-- messages_insert autorise déjà expediteur_id = auth.uid() sans condition
-- supplémentaire : aucune extension RLS nécessaire sur messages elles-mêmes.
-- ============================================================================
alter table public.conversation_participants drop constraint if exists conversation_participants_role_participant_check;
alter table public.conversation_participants add constraint conversation_participants_role_participant_check
  check (role_participant in ('fondateur', 'staff', 'beneficiaire'));

create index if not exists idx_cercles_apprentissage_organisation_id on public.cercles_apprentissage(organisation_id);
create index if not exists idx_cercles_membres_cercle_id on public.cercles_membres(cercle_id);
create index if not exists idx_cercles_membres_beneficiaire_id on public.cercles_membres(beneficiaire_id);

create trigger set_updated_at before update on public.cercles_apprentissage for each row execute function public.set_updated_at();
create trigger audit_cercles_apprentissage after insert or update or delete on public.cercles_apprentissage for each row execute function public.log_audit();
create trigger audit_cercles_membres after insert or update or delete on public.cercles_membres for each row execute function public.log_audit();

alter table public.cercles_apprentissage enable row level security;
alter table public.cercles_membres enable row level security;

-- cercles_apprentissage : praticien de l'organisation (CRUD), + tout bénéficiaire
-- membre ACTIF peut lire le cercle (charte, description) mais jamais le modifier.
create policy cercles_apprentissage_select on public.cercles_apprentissage for select using (
  public.is_fondateur()
  or public.peut_lire('cercles_apprentissage', organisation_id)
  or exists (
    select 1 from public.cercles_membres m
    join public.beneficiaires b on b.id = m.beneficiaire_id
    where m.cercle_id = cercles_apprentissage.id and b.profile_id = auth.uid() and m.statut = 'actif'
  )
);
create policy cercles_apprentissage_insert on public.cercles_apprentissage for insert with check (public.is_fondateur() or public.peut_creer('cercles_apprentissage', organisation_id));
create policy cercles_apprentissage_update on public.cercles_apprentissage for update using (public.is_fondateur() or public.peut_modifier('cercles_apprentissage', organisation_id));
create policy cercles_apprentissage_delete on public.cercles_apprentissage for delete using (public.is_fondateur() or public.peut_supprimer('cercles_apprentissage', organisation_id));

-- cercles_membres : le praticien gère (CRUD), un bénéficiaire voit la liste des
-- membres de SES PROPRES cercles actifs (composition visible entre membres d'un
-- même cercle — nécessaire pour l'affichage de groupe) mais jamais d'un cercle où
-- il n'est pas membre. Un bénéficiaire peut modifier SON PROPRE statut (accepter
-- une invitation 'invite'->'actif', ou sortir 'actif'->'sorti' sans trace négative
-- visible aux autres, §5.3) mais jamais celui d'un autre membre.
create policy cercles_membres_select on public.cercles_membres for select using (
  public.is_fondateur()
  or public.peut_lire('cercles_membres', (select organisation_id from public.cercles_apprentissage c where c.id = cercles_membres.cercle_id))
  or exists (select 1 from public.beneficiaires b where b.id = cercles_membres.beneficiaire_id and b.profile_id = auth.uid())
  or exists (
    select 1 from public.cercles_membres autre
    join public.beneficiaires b on b.id = autre.beneficiaire_id
    where autre.cercle_id = cercles_membres.cercle_id and b.profile_id = auth.uid() and autre.statut = 'actif'
  )
);
create policy cercles_membres_insert on public.cercles_membres for insert with check (
  public.is_fondateur()
  or public.peut_creer('cercles_membres', (select organisation_id from public.cercles_apprentissage c where c.id = cercles_membres.cercle_id))
);
create policy cercles_membres_update on public.cercles_membres for update using (
  public.is_fondateur()
  or public.peut_modifier('cercles_membres', (select organisation_id from public.cercles_apprentissage c where c.id = cercles_membres.cercle_id))
  or exists (select 1 from public.beneficiaires b where b.id = cercles_membres.beneficiaire_id and b.profile_id = auth.uid())
);

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur','cercles_apprentissage', true, true, true, true),
  ('administrateur','cercles_apprentissage', true, true, true, false),
  ('educateur','cercles_apprentissage', true, true, true, false),
  ('psychologue','cercles_apprentissage', true, true, true, false),
  ('coordinateur','cercles_apprentissage', true, true, true, false),
  ('fondateur','cercles_membres', true, true, true, true),
  ('administrateur','cercles_membres', true, true, true, false),
  ('educateur','cercles_membres', true, true, true, false),
  ('psychologue','cercles_membres', true, true, true, false),
  ('coordinateur','cercles_membres', true, true, true, false)
on conflict (role, module) do nothing;
