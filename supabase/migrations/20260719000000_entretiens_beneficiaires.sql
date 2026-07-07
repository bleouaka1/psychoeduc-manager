-- Fiches d'entretien (Général / Spécialisé) — CLAUDE-CODE-Entretiens-Messagerie.md §2
-- + en-tête co-branding impression (§3). Migration additive uniquement.
--
-- IMPORTANT : la table `entretiens` existe déjà depuis l'Étape 7 (Suivi psycho-éducatif,
-- migration 20260705013000) — un simple journal de rencontre (participants/compte_rendu
-- en texte libre, jamais consommé par aucune UI à ce jour, 0 ligne en base). Plutôt que
-- créer une seconde table qui entrerait en collision de nom, on l'ÉTEND pour porter les
-- fiches structurées Général/Spécialisé : `mene_par` (déjà existant) devient le praticien
-- de la fiche, `participants`/`compte_rendu` restent inutilisés par cette UI mais ne sont
-- pas supprimés (principe additif). Tout le contenu spécifique aux deux types de fiche
-- (bloc signalement, thématiques modulaires en nombre libre, comportements, verbatim...)
-- va dans `donnees jsonb` — les deux fiches n'ont pas la même forme, et le bloc
-- "thématiques" de la fiche générale n'a lui-même pas de schéma fixe (cf. spec §5).
alter table public.entretiens
  add column if not exists type_entretien text check (type_entretien in ('general', 'specialise')),
  add column if not exists statut text not null default 'brouillon' check (statut in ('brouillon', 'valide')),
  add column if not exists donnees jsonb not null default '{}'::jsonb,
  add column if not exists valide_par uuid references public.profiles(id),
  add column if not exists valide_le timestamptz;

-- Permissions : 'administrateur' (rôle de tout compte Solo, cf. handle_new_organisation)
-- n'avait jamais reçu accès au module 'entretiens' à l'Étape 7 — logique tant qu'aucune UI
-- ne l'utilisait. peut_supprimer=true en plus, pour permettre de retirer un brouillon créé
-- par erreur (appliqué strictement côté serveur : seule une fiche encore 'brouillon' peut
-- être supprimée, jamais une fiche 'validée' — cf. entretiens/actions.ts).
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('administrateur', 'entretiens', true, true, true, true)
on conflict (role, module) do nothing;

-- §2.2 T1 — identification : classe/scolarisation, propriétés du bénéficiaire lui-même
-- (pas de l'entretien), affichées telles quelles à chaque nouvel entretien spécialisé.
alter table public.beneficiaires
  add column if not exists scolarise boolean not null default false,
  add column if not exists classe text;

-- §3 — en-tête co-branding à l'impression : nom déjà sur organisations.nom, logo en plus.
-- Upload UI non construite pour l'instant (aucun compte "Structure" n'a encore de module
-- bénéficiaires/entretiens propre dans le code — seul /solo existe, toujours
-- type_organisation='solo') : le mécanisme est prêt (composant + colonne), mais en pratique
-- seul l'en-tête Solo s'affiche aujourd'hui. Documenté dans DECISIONS_LOG.md.
alter table public.organisations
  add column if not exists logo_url text;
