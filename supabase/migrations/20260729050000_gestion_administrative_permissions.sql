-- Compte Structure — Module Gestion Administrative (§4.1, étape 8/10). Comble des trous
-- de permission trouvés en préparant l'UI Présences : Directeur ne pouvait ni créer ni
-- modifier une classe (peut_creer=peut_modifier=false depuis l'Étape 8), le rendant
-- incapable d'utiliser ce module malgré son rôle de gouvernance ; Formateur/Promoteur
-- n'avaient aucun accès à inscriptions_classes (jamais consommé par aucune UI jusqu'ici).
-- Migration additive uniquement.
update public.permissions set peut_creer = true, peut_modifier = true
  where role = 'directeur' and module = 'classes_groupes';

insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('promoteur', 'classes_groupes', true, true, true, true),
  ('formateur', 'classes_groupes', true, false, false, false),
  ('directeur', 'inscriptions_classes', true, true, true, false),
  ('promoteur', 'inscriptions_classes', true, true, true, true),
  ('formateur', 'inscriptions_classes', true, false, false, false),
  -- L'Étape 6 (Solo) n'avait doté 'presences' qu'à fondateur/administrateur/educateur/formateur
  -- (aucun rôle Structure de gouvernance n'existait encore) — Directeur/Coordinateur/Promoteur
  -- ne pouvaient donc ni consulter ni saisir la feuille du jour malgré leur rôle hiérarchique.
  ('directeur', 'presences', true, true, true, false),
  ('coordinateur', 'presences', true, true, true, false),
  ('promoteur', 'presences', true, true, true, false),
  ('coordinateur', 'documents_beneficiaires', true, true, true, false),
  -- Directeur/Promoteur n'avaient AUCUN accès au module 'organisations' (seuls
  -- administrateur/fondateur en avaient depuis l'Étape 1) — bloquant pour basculer
  -- module_admin_actif (§4.1) depuis /parametres-organisation.
  ('directeur', 'organisations', true, false, true, false),
  ('promoteur', 'organisations', true, false, true, false)
on conflict (role, module) do nothing;
