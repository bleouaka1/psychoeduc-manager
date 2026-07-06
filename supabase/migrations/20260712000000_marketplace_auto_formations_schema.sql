-- Publication automatique des formations dans la Marketplace + badge de vérification
-- + enrichissement du profil public formateur — ÉTAPE 1/3 : SCHÉMA UNIQUEMENT.
-- La logique de création automatique (Étape 2) et l'UI (Étape 3) suivront après
-- validation. Migration additive uniquement, conforme aux principes du projet
-- (UUID, organisation_id, created_at/updated_at, RLS testée à deux comptes, index
-- sur les FK, audit_logs déjà en place sur marketplace_offres depuis l'Étape 16).

-- ============================================================================
-- T1 — nouveau statut 'visible_en_verification' sur marketplace_offres.statut
-- ============================================================================
-- Sémantique du statut (documentée ici, pas seulement dans ce commentaire de
-- migration, pour rester lisible par quiconque relit le schéma plus tard) :
--   'visible_en_verification' = offre visible publiquement immédiatement (contrairement
--   à 'en_attente_validation', qui masque l'offre tant que le Fondateur ne l'a pas
--   validée), réservée aux formations auto-publiées à la création (cf. T2/T3).
--   Un badge "Nouveau · en vérification" reste affiché côté UI tant que le Fondateur
--   n'a pas fait passer l'offre à 'publiee'. Les signalements peuvent la faire
--   basculer en 'masquee' exactement comme une offre 'publiee' (cf. T4).
alter table public.marketplace_offres drop constraint if exists marketplace_offres_statut_check;
alter table public.marketplace_offres add constraint marketplace_offres_statut_check
  check (statut in ('en_attente_validation','publiee','refusee','masquee','retiree','visible_en_verification'));

-- ============================================================================
-- T2 — référence croisée vers la formation source (uniquement pour type_offre='formation'
-- créée automatiquement à l'Étape 2 ; null pour les offres produit/service manuelles)
-- ============================================================================
alter table public.marketplace_offres
  add column if not exists formation_id uuid references public.formations(id) on delete cascade;

create index if not exists idx_marketplace_offres_formation_id on public.marketplace_offres(formation_id);

-- ============================================================================
-- T3 — trigger de validation : la contrainte "toute offre entre en_attente_validation"
-- (Étape 16) ne doit plus s'appliquer aux offres formation auto-créées avec
-- formation_id renseigné, qui doivent au contraire entrer 'visible_en_verification'
-- (cf. Étape 2, à venir). Toute autre insertion (produit/service soumis manuellement,
-- ou une formation sans formation_id) garde le comportement actuel inchangé.
-- ============================================================================
create or replace function public.enforce_marketplace_offre_statut()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.type_offre = 'formation' and new.formation_id is not null then
      new.statut := 'visible_en_verification';
    else
      new.statut := 'en_attente_validation';
    end if;
  elsif TG_OP = 'UPDATE' and new.statut is distinct from old.statut and new.statut in ('publiee','refusee') then
    if not public.is_fondateur() then
      raise exception 'Seul le fondateur peut valider ou refuser une offre marketplace';
    end if;
    if new.statut = 'publiee' and new.image_couverture_url is null then
      raise exception 'Une image de couverture est obligatoire avant de publier une offre marketplace';
    end if;
    new.date_validation := now();
  end if;
  return new;
end;
$$;

-- ============================================================================
-- T4 — le masquage automatique par seuil de signalements (Étape 16) ne visait que
-- statut='publiee' ; les offres 'visible_en_verification' doivent être protégées
-- de la même façon (elles sont déjà visibles publiquement).
-- ============================================================================
create or replace function public.handle_new_signalement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seuil numeric := public.get_parametre_numerique('seuil_signalements_masquage', 3);
  v_total int;
begin
  update public.marketplace_offres
  set nombre_signalements = nombre_signalements + 1
  where id = new.offre_id
  returning nombre_signalements into v_total;

  if v_total >= v_seuil then
    update public.marketplace_offres set statut = 'masquee' where id = new.offre_id and statut in ('publiee','visible_en_verification');
  end if;

  return new;
end;
$$;

-- ============================================================================
-- T5 — RLS : une offre 'visible_en_verification' doit être visible publiquement,
-- exactement comme 'publiee' (c'est tout le sens de ce statut : transparence
-- immédiate plutôt qu'un masquage en attendant la modération humaine).
-- ============================================================================
drop policy if exists marketplace_offres_select on public.marketplace_offres;
create policy marketplace_offres_select on public.marketplace_offres
  for select using (
    statut in ('publiee','visible_en_verification')
    or public.is_fondateur()
    or vendeur_id = auth.uid()
    or (organisation_id is not null and public.peut_lire('marketplace_offres', organisation_id))
  );

-- ============================================================================
-- T6 — enrichissement du profil public formateur (profils_publics_formateurs,
-- créée à l'Étape "compte_solo_ameliorations"). `bio` existant sert déjà de bio
-- courte (déjà utilisé ainsi côté UI) : pas de renommage destructif, seulement
-- des colonnes additives pour le CV / la photo.
-- ============================================================================
comment on column public.profils_publics_formateurs.bio is
  'Bio courte (2-3 lignes) affichée sur le profil public et l''encadré formateur des offres. Limite de longueur appliquée côté UI, pas en contrainte base (cf. Étape "marketplace_auto_formations", section UI à venir).';

alter table public.profils_publics_formateurs
  add column if not exists photo_url text,
  add column if not exists cv_url text,
  add column if not exists cv_texte text;

comment on column public.profils_publics_formateurs.photo_url is 'Photo de profil (recadrage carré appliqué côté UI avant upload).';
comment on column public.profils_publics_formateurs.cv_url is 'Lien vers un CV PDF téléversé (bucket Storage à définir à l''étape UI).';
comment on column public.profils_publics_formateurs.cv_texte is 'Bio structurée : expérience, diplômes, spécialités détaillées — distincte de la bio courte (`bio`).';

-- Note de conception : le badge "Vérifié", le nombre de bénéficiaires accompagnés,
-- le taux de réussite/insertion et l'ancienneté sont des CHAMPS CALCULÉS (jamais
-- stockés en dur), cohérent avec le principe déjà appliqué à `IgaDial`/`vue_satisfaction_vendeur` :
-- ils seront calculés à la lecture dans l'étape UI, pas ajoutés ici comme colonnes.
