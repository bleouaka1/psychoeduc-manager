-- Messagerie interne (Inbox) — PLAN_MESSAGERIE_INTERNE.md.
-- Réf : CLAUDE-CODE-Messagerie-Interne.md, adapté aux conventions du projet :
-- `dossiers` -> `beneficiaires` (pivot déjà utilisé partout ailleurs), `messages`
-- déjà existante (Étape 20) étendue plutôt que recréée (collision de nom évitée,
-- même principe déjà appliqué à `entretiens`/`marketplace_offre_id`).
-- Migration additive uniquement.

-- ============================================================================
-- T1 — conversations + participants. Un profil (compte réel : Fondateur ou
-- personnel Solo/Structure/Employeur) est toujours le participant, jamais un
-- bénéficiaire/parent-tuteur directement (aucun portail/authentification pour
-- ces deux profils à ce jour — cf. PLAN_MESSAGERIE_INTERNE.md, décision
-- explicitement non construite ici).
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid references public.beneficiaires(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  titre text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_participant text not null default 'staff' check (role_participant in ('fondateur', 'staff')),
  created_at timestamptz not null default now(),
  unique (conversation_id, profile_id)
);

-- ============================================================================
-- T2 — messages étendue : conversation_id (regroupement en fil), type_document +
-- statut_demande (demande de pièce justificative). type_message élargi (Étape 20,
-- déjà élargi 2 fois cette session pour signalement/moderation_marketplace).
-- ============================================================================
alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade,
  add column if not exists type_document text,
  add column if not exists statut_demande text check (statut_demande in ('en_attente', 'recu'));

alter table public.messages drop constraint if exists messages_type_message_check;
alter table public.messages add constraint messages_type_message_check
  check (type_message in ('suivi', 'entretien', 'signalement', 'moderation_marketplace', 'demande_piece'));

create index if not exists idx_messages_conversation_id on public.messages(conversation_id);

-- ============================================================================
-- T3 — pieces_jointes : jamais d'URL publique stockée, uniquement le chemin
-- dans le bucket Storage (URL signée générée à la demande côté serveur).
-- ============================================================================
create table if not exists public.pieces_jointes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  fichier_path text not null,
  nom_original text not null,
  taille_octets bigint,
  type_mime text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pieces_jointes_message_id on public.pieces_jointes(message_id);

create trigger set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create trigger audit_conversations after insert or update or delete on public.conversations
  for each row execute function public.log_audit();
create trigger audit_pieces_jointes after insert or update or delete on public.pieces_jointes
  for each row execute function public.log_audit();

-- ============================================================================
-- T4 — Storage : bucket privé dédié, jamais public.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('messagerie-pieces-jointes', 'messagerie-pieces-jointes', false)
on conflict (id) do nothing;

-- convention de chemin : <conversation_id>/<fichier> — la policy Storage vérifie
-- que l'utilisateur est bien participant de CETTE conversation via le préfixe.
drop policy if exists messagerie_pieces_jointes_storage_select on storage.objects;
create policy messagerie_pieces_jointes_storage_select on storage.objects
  for select using (
    bucket_id = 'messagerie-pieces-jointes'
    and (
      public.is_fondateur()
      or exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = ((storage.foldername(name))[1])::uuid and cp.profile_id = auth.uid()
      )
    )
  );

drop policy if exists messagerie_pieces_jointes_storage_insert on storage.objects;
create policy messagerie_pieces_jointes_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'messagerie-pieces-jointes'
    and (
      public.is_fondateur()
      or exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = ((storage.foldername(name))[1])::uuid and cp.profile_id = auth.uid()
      )
    )
  );

-- Pas de policy delete/update : aucune suppression physique (cf. limite stricte du document).

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.pieces_jointes enable row level security;

-- conversations : visible par ses participants, ou par le fondateur (lecture
-- seule pour lui tant qu'il n'est pas lui-même participant — §RLS du document :
-- "il doit d'abord être ajouté comme participant s'il veut écrire").
create policy conversations_select on public.conversations
  for select using (
    public.is_fondateur()
    or exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversations.id and cp.profile_id = auth.uid())
  );
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() is not null);
create policy conversations_update on public.conversations
  for update using (
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversations.id and cp.profile_id = auth.uid())
  );

-- conversation_participants : un profil ne voit que les conversations où il est
-- lui-même participant (+ fondateur, lecture globale).
create policy conversation_participants_select on public.conversation_participants
  for select using (
    public.is_fondateur()
    or profile_id = auth.uid()
    or exists (select 1 from public.conversation_participants cp2 where cp2.conversation_id = conversation_participants.conversation_id and cp2.profile_id = auth.uid())
  );
-- Insertion : le créateur de la conversation s'ajoute lui-même, ou ajoute un
-- autre profil s'il est déjà lui-même participant (ou fondateur) — la règle
-- métier fine ("bénéficiaire commun requis entre deux comptes staff") est
-- vérifiée applicativement (creerConversation, lib/messagerieInterne.ts),
-- pas dans cette policy (RLS = garde-fou, pas moteur de règles métier ici).
create policy conversation_participants_insert on public.conversation_participants
  for insert with check (
    public.is_fondateur()
    or profile_id = auth.uid()
    or exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversation_participants.conversation_id and cp.profile_id = auth.uid())
  );

-- messages : la policy existante (Étape 20) reste inchangée pour les usages déjà
-- en place (marketplace, bénéficiaire direct) ; élargie en OR pour couvrir
-- l'accès par conversation (nouveau canal de cette feature).
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    public.is_fondateur()
    or expediteur_id = auth.uid()
    or destinataire_id = auth.uid()
    or public.peut_lire('messages', organisation_id)
    or (conversation_id is not null and exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.profile_id = auth.uid()))
  );
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    public.is_fondateur()
    or expediteur_id = auth.uid()
    or public.peut_creer('messages', organisation_id)
  );

-- pieces_jointes : accès scopé via les participants de la conversation du message parent.
create policy pieces_jointes_select on public.pieces_jointes
  for select using (
    public.is_fondateur()
    or exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = pieces_jointes.message_id and cp.profile_id = auth.uid()
    )
  );
create policy pieces_jointes_insert on public.pieces_jointes
  for insert with check (
    public.is_fondateur()
    or exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_id and cp.profile_id = auth.uid()
    )
  );
