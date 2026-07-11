# Plan — IPP (4 piliers) + Profil public formateur

Réf : `CLAUDE-CODE-IPP.md`, `CLAUDE-CODE-PROFIL-FORMATEUR.md` (statut "Validé pour implémentation").
Mode autonome, décisions documentées et non bloquantes.

## Décision structurante — remplacement de l'IPP v1

L'IPP construit lors d'une session précédente (`evenements_ipp` + `vue_ipp`, ledger append-only alimenté
manuellement par le Fondateur) ne correspond plus à ce nouveau document, validé et bien plus précis : l'IPP
doit être **entièrement calculé depuis des données réelles du système** (delta IGA, taux d'objectifs, fiches
d'entretien, avis), pas depuis des événements saisis à la main. **Décision : l'ancien système
(`evenements_ipp`/`vue_ipp`) est conservé tel quel en base (aucune perte de données) mais n'est plus utilisé
par le profil public** — remplacé par une vue calculée sur les 4 piliers. Si un jour un mécanisme de
vérification manuelle redevient utile, ce ledger reste disponible.

## Réutilisation du schéma existant plutôt que nouvelles tables dupliquées

- **Pilier 1, snapshot IGA par période de responsabilité** : `affectations_personnel` (cible_type='beneficiaire',
  date_debut/date_fin, déjà en place depuis l'Étape 4) définit déjà la période de responsabilité d'un
  formateur sur un bénéficiaire. Décision : le "snapshot" de début/fin est **dérivé** de la première/dernière
  `evaluations_iga` dans cette fenêtre de dates, pas stocké dans une nouvelle table — cohérent avec le principe
  du projet "vue plutôt que table dupliquée". Si aucune évaluation n'existe dans la fenêtre, le bénéficiaire est
  exclu du calcul (garde-fou explicite du document, jamais traité comme zéro).
- **Taux d'objectifs atteints** : `objectifs_beneficiaire.statut='atteint'` déjà en place.
- **Rigueur documentaire (partielle)** : `entretiens.statut='valide'`, complétude de `donnees` (jsonb) déjà en
  place. **Liste exhaustive des documents obligatoires par type de dossier explicitement non tranchée par le
  document source lui-même** (section 10) — non construite, calcul de ce pilier basé sur les seuls éléments
  déjà définissables (diagnostic initial, plan d'accompagnement, fiches entretien).
- **Compétences du profil** : `profils_publics_formateurs.specialites_dimensions_iga` (déjà construit session
  précédente pour le mécanisme de recommandation IGA→Marketplace) réutilisé tel quel pour "Domaines de
  compétences" — même besoin, pas de nouvelle colonne.

## Nouveau schéma nécessaire

- **`avis_beneficiaires`** (témoignages) : beneficiaire_id, organisation_id (formateur), auteur_type
  ('beneficiaire'|'parent_tuteur'), parent_tuteur_id nullable, note (1-5), texte, declencheur
  ('jalon'|'periodique'|'silencieux'), statut ('en_verification'|'publie'|'masque'|'retiree' — même vocabulaire
  que la modération marketplace déjà en place), created_at. **Jamais de nom complet exposé** (RGPD, mineurs) —
  géré côté affichage (prénom + initiale), pas en base (le nom complet réel reste nécessaire pour la
  traçabilité interne/modération).
- **Paliers de réussite** (Réussir 1/2/Terminus) : calculés à la volée depuis la durée de la relation
  bénéficiaire↔formateur (`affectations_personnel.date_debut` → aujourd'hui ou `date_fin`), pas stockés.

## Portée V1 (construite maintenant) vs différée

**Construit** : calcul réel des 4 piliers IPP (vue SQL), profil public formateur redesigné (bloc IPP avec les
4 piliers + seuil d'affichage, compétences par dimension IGA, statistiques d'impact, paliers de réussite,
liste d'avis), collecte d'avis (3 déclencheurs) + modération Fondateur minimale (réutilise le vocabulaire de
statut marketplace).

**Différé, signalé et non construit en silence** (cohérent avec les propres réserves du document source, section
6/10 des deux fichiers) : tarification/paiement du test IGA (aucun prestataire de paiement intégré dans ce
projet, comme documenté à chaque étape précédente touchant à l'argent) ; interface dédiée "Rigueur
Documentaire" (jauge circulaire, dossiers triés, checklist, rappels calendrier — maquette HTML non fournie,
sous-projet à part) ; droit de réponse du formateur aux avis (explicitement "Phase 2" dans le document
source) ; liste exhaustive des documents obligatoires par type de dossier (explicitement non tranchée par le
document source) ; barème précis de normalisation du delta IGA et seuil minimum d'échantillon exact
(explicitement "à définir ultérieurement avec des données réelles" — valeurs par défaut raisonnables posées
ici, à ajuster).

## Tâches

### T1 — Schéma : `avis_beneficiaires` + vues de calcul IPP
**Vérification** : script SQL — un avis non modéré n'apparaît jamais publiquement ; cloisonnement RLS (un
tiers ne voit pas les avis d'un autre formateur en attente) ; le calcul du pilier Impact réel exclut bien un
bénéficiaire sans évaluation IGA initiale (jamais traité comme zéro).

### T2 — `lib/ipp.ts` : calcul des 4 piliers (TypeScript, logique métier découplée)
**Vérification** : script Node autonome sur un jeu de données de test.

### T3 — Collecte d'avis (3 déclencheurs) + modération Fondateur
**Vérification** : Playwright, un avis soumis apparaît en modération, publié il apparaît sur le profil public
avec prénom+initiale uniquement.

### T4 — Profil public formateur redesigné
**Vérification** : Playwright, bloc IPP affiché avec seuil "en cours de constitution" si échantillon
insuffisant, paliers masqués si vides.

### T5 — Tests + clôture

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5.
