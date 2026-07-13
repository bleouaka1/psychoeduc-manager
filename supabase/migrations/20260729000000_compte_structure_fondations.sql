-- Compte Structure — Fondations (PROMPT-CLAUDE-CODE-COMPTE-STRUCTURE-1.md, §1-3, étape 1/10)
-- Migration additive uniquement.
--
-- ÉCART STRUCTURANT PAR RAPPORT AU DOCUMENT SOURCE, documenté en détail dans
-- DECISIONS_LOG.md : le document propose un schéma parallèle complet
-- (comptes_structure, etablissements, profils_structure, beneficiaires_structure,
-- role_structure, invitations, journal_audit...) qui duplique presque entièrement
-- le système générique multi-tenant déjà en place depuis l'Étape 1
-- (organisations/membres_organisations/roles_utilisateurs/permissions) et déjà
-- utilisé par TOUS les comptes (Solo, Employeur, Structure). Cette migration
-- ÉTEND ce système existant plutôt que de le dupliquer :
--   comptes_structure        -> organisations (type_organisation déjà 'structure'/'ecole'/'ong'/'centre')
--   profils_structure        -> membres_organisations + roles_utilisateurs (rôles déjà présents :
--                                directeur/coordinateur/educateur/formateur ; 'promoteur' ajouté ici)
--   beneficiaires_structure  -> beneficiaires (déjà organisation_id-scopée, IGA/entretiens/marketplace
--                                en dépendent déjà platform-wide — la fragmenter casserait tout ça)
--   invitations              -> invitations_utilisateurs (Étape 4, jamais consommée jusqu'ici,
--                                déjà générique email+rôle+beneficiaire_id+token+expiration)
--   fiches_entretien          -> entretiens (construit lors d'une session précédente)
--   journal_audit             -> audit_logs (append-only strict depuis l'Étape 1)
--   paiements/factures        -> renommés paiements_scolarite/factures_scolarite : la table
--                                `paiements` existante est la facturation SaaS plateforme->organisation
--                                (abonnements), un objet métier totalement différent des frais de
--                                scolarité structure->bénéficiaire.
-- Seuls `etablissements`, `assignations`, `liens_parent_beneficiaire`,
-- `paiements_scolarite`, `factures_scolarite` sont de vraies nouvelles tables : aucun
-- équivalent n'existait pour ces concepts.

-- ============================================================================
-- T1 — etablissements (sites physiques rattachés à une organisation Structure ;
-- la grande majorité des organisations restent mono-site, etablissement_id reste
-- nullable partout pour ne jamais forcer un sélecteur vide sur un compte mono-site).
-- ============================================================================
create table if not exists public.etablissements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  nom text not null,
  adresse text,
  rythme_jours text check (rythme_jours in ('lun_ven', 'lun_sam')),
  actif boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.membres_organisations
  add column if not exists etablissement_id uuid references public.etablissements(id) on delete set null,
  add column if not exists superviseur_id uuid references public.membres_organisations(id) on delete set null;

alter table public.beneficiaires
  add column if not exists etablissement_id uuid references public.etablissements(id) on delete set null;

alter table public.invitations_utilisateurs
  add column if not exists etablissement_id uuid references public.etablissements(id) on delete set null;

-- 'promoteur' : sommet de la hiérarchie Structure, actif seulement en multi-établissements
-- (§1 du document) ; distinct de 'fondateur' (rôle plateforme réservé à Angenor) — aucune
-- ambiguïté possible, ce sont deux valeurs de la même colonne mais jamais la même personne.
alter table public.roles_utilisateurs drop constraint if exists roles_utilisateurs_role_check;
alter table public.roles_utilisateurs add constraint roles_utilisateurs_role_check
  check (role in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire','promoteur'
  ));
alter table public.invitations_utilisateurs drop constraint if exists invitations_utilisateurs_role_propose_check;
alter table public.invitations_utilisateurs add constraint invitations_utilisateurs_role_propose_check
  check (role_propose in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire','promoteur'
  ));
alter table public.permissions drop constraint if exists permissions_role_check;
alter table public.permissions add constraint permissions_role_check
  check (role in (
    'fondateur','super_admin_client','administrateur','directeur','coordinateur','educateur',
    'formateur','enseignant','coach','consultant','psychologue','assistant_social',
    'beneficiaire','parent','tuteur','mentor','employeur','recruteur','partenaire','promoteur'
  ));

-- Toggle §4.1 : le module Gestion Administrative reste désactivable, jamais imposé
-- (contrainte stricte §7.6 — une ONG qui ne gère pas de scolarité ne doit voir aucun de
-- ses sous-menus). `nombre_etablissements_payants` (§2.2) est déliberément PAS une colonne
-- stockée : calculé à la demande (count(etablissements actifs) - 2, min 0), cohérent avec
-- le principe déjà établi "vue plutôt que table dupliquée" (cf. lib/formateurStats.ts).
alter table public.organisations
  add column if not exists module_admin_actif boolean not null default false;

-- ============================================================================
-- T2 — assignations : coeur du contrôle d'accès (§4.5). Aucun accès par défaut à un
-- bénéficiaire même pour un formateur actif de l'établissement — seule une ligne
-- active (date_fin is null) donne accès. organisation_id ajouté (absent du document)
-- pour rester cohérent avec le scoping RLS direct déjà utilisé par toutes les autres
-- tables de la plateforme, plutôt que de forcer un JOIN supplémentaire sur chaque policy.
-- ============================================================================
create table if not exists public.assignations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  formateur_membre_organisation_id uuid not null references public.membres_organisations(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  role_assignation text,
  date_debut date not null default current_date,
  date_fin date,
  assigne_par uuid references public.membres_organisations(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- T3 — liens_parent_beneficiaire (§4.3-4.4). parent_profile_id référence profiles(id),
-- pas auth.users(id) directement, pour rester cohérent avec toutes les autres FK
-- "personne" de la plateforme (created_by, valide_par, etc.).
-- ============================================================================
create table if not exists public.liens_parent_beneficiaire (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  invitation_id uuid references public.invitations_utilisateurs(id),
  statut text not null default 'actif' check (statut in ('actif', 'revoque')),
  revoque_par uuid references public.profiles(id),
  revoque_at timestamptz,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, beneficiaire_id)
);

-- ============================================================================
-- T4 — documents_beneficiaires (Étape 5) étendue en checklist (§4.1.2) plutôt que
-- dupliquée dans une nouvelle table `dossiers_beneficiaire` : mêmes colonnes
-- (beneficiaire_id, organisation_id, type_document, url_fichier...), il ne manquait
-- qu'un statut de suivi.
-- ============================================================================
alter table public.documents_beneficiaires
  add column if not exists statut text not null default 'manquant' check (statut in ('manquant', 'recu', 'valide'));

-- ============================================================================
-- T5 — presences (Étape 6) étendue avec justification d'absence (§4.1.1) ; schéma
-- de base (statut present/absent/retard, unique classe_id+beneficiaire_id+date_seance)
-- déjà exactement conforme au document, rien d'autre à ajouter.
-- ============================================================================
alter table public.presences
  add column if not exists justifie boolean not null default false,
  add column if not exists motif text;

-- ============================================================================
-- T6 — entretiens (construit lors d'une session précédente) étendue avec le champ
-- Interlocuteur (§4.2) — jamais une nouvelle table `fiches_entretien`.
-- ============================================================================
alter table public.entretiens
  add column if not exists interlocuteur text check (interlocuteur in ('beneficiaire', 'parent_tuteur', 'conjoint')) default 'beneficiaire';

-- ============================================================================
-- T7 — paiements_scolarite / factures_scolarite (§4.1.3-4.1.4). Renommées par
-- rapport au document pour ne pas entrer en collision avec `paiements` (facturation
-- SaaS plateforme->organisation, Étape 2, objet métier différent).
-- ============================================================================
create table if not exists public.paiements_scolarite (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  type_paiement text not null check (type_paiement in ('inscription', 'scolarite')),
  montant_du numeric not null,
  montant_paye numeric not null default 0,
  periode text,
  statut text not null default 'retard' check (statut in ('a_jour', 'partiel', 'retard')),
  methode text,
  reference_aggregateur text,
  date_echeance date,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.factures_scolarite (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  paiement_id uuid not null references public.paiements_scolarite(id) on delete cascade,
  numero_facture text not null unique,
  pdf_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Index
-- ============================================================================
create index if not exists idx_etablissements_organisation_id on public.etablissements(organisation_id);
create index if not exists idx_membres_organisations_etablissement_id on public.membres_organisations(etablissement_id);
create index if not exists idx_membres_organisations_superviseur_id on public.membres_organisations(superviseur_id);
create index if not exists idx_beneficiaires_etablissement_id on public.beneficiaires(etablissement_id);
create index if not exists idx_invitations_utilisateurs_etablissement_id on public.invitations_utilisateurs(etablissement_id);
create index if not exists idx_assignations_organisation_id on public.assignations(organisation_id);
create index if not exists idx_assignations_formateur_membre_organisation_id on public.assignations(formateur_membre_organisation_id);
create index if not exists idx_assignations_beneficiaire_id on public.assignations(beneficiaire_id);
create index if not exists idx_liens_parent_beneficiaire_organisation_id on public.liens_parent_beneficiaire(organisation_id);
create index if not exists idx_liens_parent_beneficiaire_parent_profile_id on public.liens_parent_beneficiaire(parent_profile_id);
create index if not exists idx_liens_parent_beneficiaire_beneficiaire_id on public.liens_parent_beneficiaire(beneficiaire_id);
create index if not exists idx_paiements_scolarite_organisation_id on public.paiements_scolarite(organisation_id);
create index if not exists idx_paiements_scolarite_beneficiaire_id on public.paiements_scolarite(beneficiaire_id);
create index if not exists idx_factures_scolarite_organisation_id on public.factures_scolarite(organisation_id);
create index if not exists idx_factures_scolarite_paiement_id on public.factures_scolarite(paiement_id);

-- ============================================================================
-- Triggers
-- ============================================================================
create trigger set_updated_at before update on public.etablissements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.paiements_scolarite
  for each row execute function public.set_updated_at();

create trigger audit_etablissements after insert or update or delete on public.etablissements
  for each row execute function public.log_audit();
create trigger audit_assignations after insert or update or delete on public.assignations
  for each row execute function public.log_audit();
create trigger audit_liens_parent_beneficiaire after insert or update or delete on public.liens_parent_beneficiaire
  for each row execute function public.log_audit();
create trigger audit_paiements_scolarite after insert or update or delete on public.paiements_scolarite
  for each row execute function public.log_audit();
create trigger audit_factures_scolarite after insert or update or delete on public.factures_scolarite
  for each row execute function public.log_audit();

-- ============================================================================
-- Permissions : directeur/coordinateur/promoteur reçoivent maintenant les mêmes
-- grants que fondateur/administrateur sur les modules déjà existants qu'ils
-- doivent piloter (§1, hiérarchie des rôles) ; formateur reste plus restreint
-- (peut_supprimer=false partout, cohérent avec le principe "aucune suppression
-- physique" §7.4). 'promoteur' hérite des mêmes droits que 'directeur' partout
-- (sommet de hiérarchie, seulement visible en multi-établissements).
-- ============================================================================
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('directeur','etablissements', true, true, true, false),
  ('promoteur','etablissements', true, true, true, true),
  ('directeur','invitations_utilisateurs', true, true, true, true),
  ('promoteur','invitations_utilisateurs', true, true, true, true),
  ('coordinateur','invitations_utilisateurs', true, false, false, false),
  ('directeur','assignations', true, true, true, true),
  ('promoteur','assignations', true, true, true, true),
  ('coordinateur','assignations', true, true, true, false),
  ('directeur','liens_parent_beneficiaire', true, true, true, true),
  ('promoteur','liens_parent_beneficiaire', true, true, true, true),
  ('formateur','liens_parent_beneficiaire', true, true, false, false),
  ('directeur','presences', true, true, true, false),
  ('promoteur','presences', true, true, true, false),
  ('coordinateur','presences', true, true, true, false),
  ('directeur','documents_beneficiaires', true, true, true, false),
  ('promoteur','documents_beneficiaires', true, true, true, false),
  ('coordinateur','documents_beneficiaires', true, true, true, false),
  ('formateur','documents_beneficiaires', true, true, false, false),
  ('directeur','entretiens', true, true, true, true),
  ('promoteur','entretiens', true, true, true, true),
  ('coordinateur','entretiens', true, true, true, false),
  ('formateur','entretiens', true, true, true, false),
  ('directeur','paiements_scolarite', true, true, true, false),
  ('promoteur','paiements_scolarite', true, true, true, false),
  ('directeur','factures_scolarite', true, true, false, false),
  ('promoteur','factures_scolarite', true, true, false, false)
on conflict (role, module) do nothing;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.etablissements enable row level security;
alter table public.assignations enable row level security;
alter table public.liens_parent_beneficiaire enable row level security;
alter table public.paiements_scolarite enable row level security;
alter table public.factures_scolarite enable row level security;

create policy etablissements_select on public.etablissements
  for select using (public.is_fondateur() or public.peut_lire('etablissements', organisation_id));
create policy etablissements_insert on public.etablissements
  for insert with check (public.is_fondateur() or public.peut_creer('etablissements', organisation_id));
create policy etablissements_update on public.etablissements
  for update using (public.is_fondateur() or public.peut_modifier('etablissements', organisation_id));
create policy etablissements_delete on public.etablissements
  for delete using (public.is_fondateur() or public.peut_supprimer('etablissements', organisation_id));

-- assignations : le formateur voit ses propres lignes (peu importe peut_lire) + le staff
-- avec peut_lire('assignations', organisation_id) voit tout l'établissement (§4.5 —
-- Directeur/Éducateur voient tout, Formateur n'a "aucun droit d'assignation" mais doit
-- voir SES PROPRES bénéficiaires assignés, ce qui passe par cette table même sans
-- peut_creer). Le périmètre plus fin ("Éducateur limité à sa propre cohorte") reste une
-- règle applicative (server actions), pas exprimable proprement en RLS sans dupliquer
-- la notion de cohorte ici — documenté comme simplification V1 dans DECISIONS_LOG.md.
create policy assignations_select on public.assignations
  for select using (
    public.is_fondateur()
    or public.peut_lire('assignations', organisation_id)
    or exists (
      select 1 from public.membres_organisations mo
      where mo.id = assignations.formateur_membre_organisation_id and mo.profile_id = auth.uid()
    )
  );
create policy assignations_insert on public.assignations
  for insert with check (public.is_fondateur() or public.peut_creer('assignations', organisation_id));
create policy assignations_update on public.assignations
  for update using (public.is_fondateur() or public.peut_modifier('assignations', organisation_id));
create policy assignations_delete on public.assignations
  for delete using (public.is_fondateur() or public.peut_supprimer('assignations', organisation_id));

-- liens_parent_beneficiaire : le parent voit son propre lien ; le staff autorisé voit tout
-- l'établissement. Aucune policy DELETE — la révocation est un update de statut (§4.6/§7.4),
-- jamais une suppression physique.
create policy liens_parent_beneficiaire_select on public.liens_parent_beneficiaire
  for select using (
    public.is_fondateur()
    or parent_profile_id = auth.uid()
    or public.peut_lire('liens_parent_beneficiaire', organisation_id)
  );
create policy liens_parent_beneficiaire_insert on public.liens_parent_beneficiaire
  for insert with check (public.is_fondateur() or public.peut_creer('liens_parent_beneficiaire', organisation_id));
create policy liens_parent_beneficiaire_update on public.liens_parent_beneficiaire
  for update using (public.is_fondateur() or public.peut_modifier('liens_parent_beneficiaire', organisation_id));

-- paiements_scolarite / factures_scolarite : staff autorisé de l'organisation, + le parent lié
-- voit (lecture seule) les paiements/factures de SON enfant (§4.3 point 3 "Statut administratif").
create policy paiements_scolarite_select on public.paiements_scolarite
  for select using (
    public.is_fondateur()
    or public.peut_lire('paiements_scolarite', organisation_id)
    or exists (
      select 1 from public.liens_parent_beneficiaire l
      where l.beneficiaire_id = paiements_scolarite.beneficiaire_id and l.parent_profile_id = auth.uid() and l.statut = 'actif'
    )
  );
create policy paiements_scolarite_insert on public.paiements_scolarite
  for insert with check (public.is_fondateur() or public.peut_creer('paiements_scolarite', organisation_id));
create policy paiements_scolarite_update on public.paiements_scolarite
  for update using (public.is_fondateur() or public.peut_modifier('paiements_scolarite', organisation_id));

create policy factures_scolarite_select on public.factures_scolarite
  for select using (
    public.is_fondateur()
    or public.peut_lire('factures_scolarite', organisation_id)
    or exists (
      select 1 from public.paiements_scolarite p
      join public.liens_parent_beneficiaire l on l.beneficiaire_id = p.beneficiaire_id
      where p.id = factures_scolarite.paiement_id and l.parent_profile_id = auth.uid() and l.statut = 'actif'
    )
  );
create policy factures_scolarite_insert on public.factures_scolarite
  for insert with check (public.is_fondateur() or public.peut_creer('factures_scolarite', organisation_id));

-- ============================================================================
-- §3/§4.5 : "l'accès suit l'assignation explicite, jamais le rôle seul" — non
-- négociable. Or `('formateur','beneficiaires')` avait peut_lire=peut_modifier=true
-- ORG-WIDE depuis l'Étape 5 (accès à TOUS les bénéficiaires de l'organisation, sans
-- assignation), contredisant directement cette règle. Vérifié avant de corriger :
-- le rôle 'formateur' (roles_utilisateurs) n'est référencé nulle part dans le code
-- applicatif (grep app/ lib/) — jamais assigné par aucun flux existant (Solo utilise
-- toujours 'administrateur', jamais 'formateur') — donc aucune régression possible en
-- le resserrant ici, cette fonctionnalité en est le premier vrai consommateur.
-- ============================================================================
update public.permissions set peut_lire = false, peut_creer = false, peut_modifier = false
  where role = 'formateur' and module = 'beneficiaires';

drop policy if exists beneficiaires_select_formateur_assigne on public.beneficiaires;
create policy beneficiaires_select_formateur_assigne on public.beneficiaires
  for select using (
    exists (
      select 1 from public.assignations a
      join public.membres_organisations mo on mo.id = a.formateur_membre_organisation_id
      where a.beneficiaire_id = beneficiaires.id
        and mo.profile_id = auth.uid()
        and a.date_fin is null
    )
  );
