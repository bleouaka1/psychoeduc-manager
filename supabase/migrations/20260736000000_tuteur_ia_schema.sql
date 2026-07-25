-- Dashboard bénéficiaire v2, Lot D — Espace Tuteurs IA (+ Simulation d'entretien comme
-- mode spécialisé, cf. PLAN_DASHBOARD_BENEFICIAIRE_V2.md, écart 2). Un seul système de
-- conversation IA pour les deux usages (`objectif` distingue 'tutorat'/'entretien'),
-- jamais deux moteurs séparés. Réutilise le crédit unique déjà en place
-- (credits_revision/debiter_credit_revision) — pas de deuxième portefeuille.

-- ============================================================================
-- Personas : gérées par le Fondateur, jamais créées par le bénéficiaire. `cout_credits`
-- configurable par persona (pas une constante applicative) — une simulation d'entretien
-- peut coûter plus cher qu'une session de tutorat classique, à ajuster sans redéploiement.
-- ============================================================================
create table if not exists public.tuteur_personas (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  domaine text not null,
  description text,
  objectif text not null default 'tutorat' check (objectif in ('tutorat', 'entretien')),
  prompt_systeme_base text not null,
  cout_credits int not null default 1,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tuteur_personas enable row level security;

create policy tuteur_personas_select on public.tuteur_personas for select using (actif or public.is_fondateur());
create policy tuteur_personas_insert on public.tuteur_personas for insert with check (public.is_fondateur());
create policy tuteur_personas_update on public.tuteur_personas for update using (public.is_fondateur());

-- Persona par défaut pour la Simulation d'entretien (§9 du prompt : garde-fou personas
-- réelles non nécessaire ici, "Recruteur" n'est pas une personne identifiable).
insert into public.tuteur_personas (nom, domaine, description, objectif, prompt_systeme_base, cout_credits)
select
  'Recruteur',
  'Entretien d''embauche',
  'Simulation d''entretien de recrutement, questions et retours réalistes.',
  'entretien',
  'Tu es un recruteur professionnel qui mène un entretien d''embauche réaliste et bienveillant. Pose des questions pertinentes une à la fois, attends la réponse, rebondis dessus, donne un retour constructif à la fin. Reste factuel et encourageant, jamais humiliant.',
  2
where not exists (select 1 from public.tuteur_personas where objectif = 'entretien');

-- ============================================================================
-- Sessions et messages — même schéma de policies que documents_beneficiaires/quiz_revision
-- (bénéficiaire propriétaire + équipe pédagogique en lecture, jamais un autre bénéficiaire).
-- `document_id` nullable : un entretien n'a pas forcément de document source.
-- ============================================================================
create table if not exists public.tuteur_sessions (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  document_id uuid references public.documents_beneficiaires(id) on delete set null,
  persona_id uuid not null references public.tuteur_personas(id),
  credits_consommes int not null default 0,
  statut text not null default 'active' check (statut in ('active', 'terminee')),
  created_at timestamptz not null default now()
);

create index if not exists idx_tuteur_sessions_beneficiaire_id on public.tuteur_sessions(beneficiaire_id);

alter table public.tuteur_sessions enable row level security;

create policy tuteur_sessions_select on public.tuteur_sessions for select using (
  public.is_fondateur()
  or public.peut_lire('tuteur_ia', organisation_id)
  or exists (select 1 from public.beneficiaires b where b.id = tuteur_sessions.beneficiaire_id and b.profile_id = auth.uid())
);
create policy tuteur_sessions_insert on public.tuteur_sessions for insert with check (
  exists (select 1 from public.beneficiaires b where b.id = tuteur_sessions.beneficiaire_id and b.profile_id = auth.uid())
);

create table if not exists public.tuteur_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tuteur_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  contenu text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tuteur_messages_session_id on public.tuteur_messages(session_id);

alter table public.tuteur_messages enable row level security;

create policy tuteur_messages_select on public.tuteur_messages for select using (
  exists (
    select 1 from public.tuteur_sessions s
    join public.beneficiaires b on b.id = s.beneficiaire_id
    where s.id = tuteur_messages.session_id
      and (b.profile_id = auth.uid() or public.is_fondateur() or public.peut_lire('tuteur_ia', s.organisation_id))
  )
);
create policy tuteur_messages_insert on public.tuteur_messages for insert with check (
  exists (
    select 1 from public.tuteur_sessions s
    join public.beneficiaires b on b.id = s.beneficiaire_id
    where s.id = tuteur_messages.session_id and b.profile_id = auth.uid()
  )
);

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('fondateur', 'tuteur_ia', true, true, false, false),
  ('directeur', 'tuteur_ia', true, false, false, false),
  ('promoteur', 'tuteur_ia', true, false, false, false),
  ('coordinateur', 'tuteur_ia', true, false, false, false),
  ('educateur', 'tuteur_ia', true, false, false, false),
  ('formateur', 'tuteur_ia', true, false, false, false),
  ('administrateur', 'tuteur_ia', true, false, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- Crédits : généralise le débit à un montant variable (coût par persona, pas toujours 1)
-- — remplace la version à paramètre unique, compatible avec les appels existants
-- (genererQuizPayant continue d'appeler sans p_montant, qui vaut alors 1 par défaut).
-- Aucun nouveau portefeuille : le solde partagé credits_revision reste la seule source.
-- ============================================================================
drop function if exists public.debiter_credit_revision(uuid);

create function public.debiter_credit_revision(p_beneficiaire_id uuid, p_montant int default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solde int;
  v_autorise boolean;
begin
  select exists (
    select 1 from public.beneficiaires b
    where b.id = p_beneficiaire_id
      and (b.profile_id = auth.uid() or public.is_fondateur() or public.peut_modifier('credits_revision', b.organisation_id))
  ) into v_autorise;
  if not v_autorise then
    raise exception 'Non autorisé à débiter ce compte de crédits';
  end if;

  select solde into v_solde from public.credits_revision where beneficiaire_id = p_beneficiaire_id for update;
  if v_solde is null or v_solde < p_montant then
    return false;
  end if;
  update public.credits_revision set solde = solde - p_montant, updated_at = now() where beneficiaire_id = p_beneficiaire_id;
  return true;
end;
$$;

grant execute on function public.debiter_credit_revision(uuid, int) to authenticated;
