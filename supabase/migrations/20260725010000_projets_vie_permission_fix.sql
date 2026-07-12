-- Correctif de permission réel, trouvé en vérifiant Phase 2 (Projet de vie) bout en
-- bout : la matrice de permissions posée à l'Étape 7 n'accordait jamais peut_creer sur
-- projets_vie au rôle 'administrateur' (celui qu'un Compte Solo porte sur sa propre
-- organisation) — jamais remarqué jusqu'ici car aucun code ne consommait cette table.
-- Aligné sur le même rôle déjà correctement ouvert pour objectifs_beneficiaire/
-- avis_beneficiaires (features ultérieures ayant déjà rencontré et corrigé ce
-- même besoin). Migration additive uniquement (élargit un droit, n'en retire aucun).
update public.permissions set peut_creer = true where role = 'administrateur' and module = 'projets_vie';
