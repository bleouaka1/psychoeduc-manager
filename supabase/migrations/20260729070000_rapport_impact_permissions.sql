-- Compte Structure — étape 10/10 : rapport d'impact exportable (§4.7). Le taux d'insertion
-- agrégé s'appuie sur `insertions_professionnelles` (Étape 12, existante) — Directeur/Promoteur
-- n'y avaient aucun accès en lecture (seuls Coordinateur/Éducateur/Assistant social en avaient,
-- rôles qui saisissent le suivi, pas ceux qui produisent un rapport consolidé pour un bailleur).
-- Lecture seule : ces rôles ne saisissent pas le suivi d'insertion, ils le consultent en agrégat.
-- Migration additive uniquement.
insert into public.permissions (role, module, peut_lire, peut_creer, peut_modifier, peut_supprimer)
values
  ('directeur', 'insertions_professionnelles', true, false, false, false),
  ('promoteur', 'insertions_professionnelles', true, false, false, false)
on conflict (role, module) do nothing;
