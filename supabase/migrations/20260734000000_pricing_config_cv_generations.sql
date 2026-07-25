-- Handoff Claude Code — Profil de compétences (ICC), Génération de CV, Navigation.
-- §2.1 : table de configuration des prix, jamais une constante codée en dur — permet
-- la bascule FCFA → ECO (2027) sans redéploiement. §2.2-2.4 : génération de CV par IA,
-- ouverte à tous les types de comptes (schéma générique dès maintenant), mais seul le
-- flux bénéficiaire est câblé côté application dans cette itération (§4 : extension aux
-- autres types de comptes différée, une fois ce flux validé).

create table if not exists public.pricing_config (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  montant numeric not null,
  devise text not null default 'XOF',
  valide_a_partir_de timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_config_feature on public.pricing_config(feature, valide_a_partir_de desc);

alter table public.pricing_config enable row level security;

-- Lecture publique du prix courant : nécessaire pour afficher le prix avant paiement,
-- à tout type de compte (§2.2), pas seulement aux rôles internes d'une organisation.
create policy pricing_config_select on public.pricing_config for select using (true);
create policy pricing_config_insert on public.pricing_config for insert with check (public.is_fondateur());
create policy pricing_config_update on public.pricing_config for update using (public.is_fondateur());

insert into public.pricing_config (feature, montant, devise)
select 'generation_cv', 1000, 'XOF'
where not exists (select 1 from public.pricing_config where feature = 'generation_cv');

-- ============================================================================
-- cv_generations : historique de facturation + contenu généré. `compte_id` est une
-- FK logique (pas de contrainte physique) vers profiles.id, quel que soit le type de
-- compte — même principe que credits_transactions.payeur_id (schéma déjà hétérogène
-- ailleurs dans ce projet). Écart documenté vs. schéma suggéré par le handoff : pas de
-- colonne `pdf_url` — ce projet n'a aucun stockage de fichier PDF généré, l'export est
-- une impression navigateur (cf. app/solo/_components/BoutonImprimer.tsx) ; le rendu
-- HTML est reconstruit à la demande depuis `contenu_json`, jamais un fichier stocké.
-- ============================================================================
create table if not exists public.cv_generations (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null,
  type_compte text not null check (type_compte in ('beneficiaire', 'solo', 'structure', 'employeur')),
  montant_paye numeric not null,
  devise text not null default 'XOF',
  transaction_ref text,
  statut text not null check (statut in ('en_attente', 'confirme', 'echoue')) default 'en_attente',
  contenu_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cv_generations_compte_id on public.cv_generations(compte_id);

alter table public.cv_generations enable row level security;

create policy cv_generations_select_soi on public.cv_generations
  for select using (compte_id = auth.uid() or public.is_fondateur());

-- Le client peut créer sa propre demande (statut par défaut 'en_attente') ; toute
-- transition d'état ensuite passe exclusivement par les fonctions ci-dessous (jamais
-- d'UPDATE direct exposé à authenticated — sinon rien n'empêcherait un client de
-- s'auto-confirmer un paiement qu'il n'a pas fait).
create policy cv_generations_insert_soi on public.cv_generations
  for insert with check (compte_id = auth.uid());

-- Confirmation du paiement — jamais avant confirmation réelle du prestataire (§2.4).
-- SECURITY DEFINER + REVOKE de PUBLIC : réservée au webhook serveur (clé service_role),
-- même garde-fou que confirmer_transaction_credits() (migration 20260731000000).
create or replace function public.confirmer_paiement_cv(p_generation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cv_generations set statut = 'confirme' where id = p_generation_id and statut = 'en_attente';
  if not found then
    raise exception 'Génération de CV introuvable ou déjà traitée';
  end if;
end;
$$;

revoke execute on function public.confirmer_paiement_cv(uuid) from public;

-- Enregistrement du contenu généré — appelée par le serveur applicatif juste après un
-- appel Haiku réussi (jamais avant confirmation du paiement). Vérification d'autorisation
-- interne obligatoire (même raison que debiter_credit_revision()) : accordée à
-- `authenticated`, mais seul le propriétaire du compte peut écrire sur SA génération.
create or replace function public.enregistrer_contenu_cv(p_generation_id uuid, p_contenu jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compte_id uuid;
begin
  select compte_id into v_compte_id from public.cv_generations where id = p_generation_id and statut = 'confirme';
  if v_compte_id is null then
    raise exception 'Génération introuvable ou paiement non confirmé';
  end if;
  if v_compte_id <> auth.uid() then
    raise exception 'Non autorisé à écrire sur cette génération';
  end if;
  update public.cv_generations set contenu_json = p_contenu where id = p_generation_id;
end;
$$;

grant execute on function public.enregistrer_contenu_cv(uuid, jsonb) to authenticated;
