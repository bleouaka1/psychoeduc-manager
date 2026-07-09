# Plan — Mécanisme IGA → Marketplace (recommandations, IPP)

Réf : `IGA_Mecanisme_Marketplace.md`, `IGA_Philosophie_Vision_Globale.md`. Mode autonome, décisions documentées.

## Constat — écart avec le document source

Le document affirme que l'**IPP (Indice de Performance du Praticien) est "déjà prévu dans l'architecture"**.
Vérifié : **faux** — aucune trace d'IPP dans `docs/PsychoEduc_Manager_Architecture_v5.md`, `DECISIONS_LOG.md`,
ni aucune migration. C'est un système entièrement à construire, pas à connecter.

`profils_publics_formateurs.specialites text[]` existe déjà (texte libre, Étape "compte_solo_ameliorations")
— insuffisant pour un matching précis "spécialiste sur CETTE dimension IGA" (le doc l'exige explicitement).
**Décision : colonne additive `specialites_dimensions_iga text[]`** (codes de dimension, ex.
`autonomie_economique`), le champ texte libre existant reste pour l'affichage humain.

## Décision — IPP en registre append-only (comme l'argent, Étape 2/15)

Un score de confiance manipulable en place serait aussi problématique qu'un solde financier modifiable
directement. **`indice_performance_praticien`** (score courant, calculé) alimenté uniquement par
**`evenements_ipp`** (append-only : formation_continue / resultat_verifie / temoignage_verifie, delta fixe
par type, jamais par déclaration directe). Écriture réservée au Fondateur (seul rôle qui "vérifie" au sens
du document §6.2) — cohérent avec le principe "jamais de score basé sur une déclaration non vérifiée".

## Portée V1 (cette session) vs différé

**Construit maintenant** : déclaration de spécialités par dimension IGA (profil Solo/Structure), schéma IPP
+ table d'événements vérifiés, affichage de l'IPP sur le profil public formateur, moteur de recommandation
sur la page de résultat IGA (liste des praticiens/structures spécialisés sur chaque dimension faible, triés
par IPP, repli "Contacter le Fondateur" toujours visible si aucune donnée suffisante — §5 du document),
conseils génériques automatiques par dimension faible (texte statique, pas de génération IA).

**Différé, signalé et non construit en silence** : formulaire de soumission de témoignage/résultat +ncore
d'approbation Fondateur dédiée (le mécanisme de vérification lui-même, §6.2) — l'ajout d'un `evenements_ipp`
reste possible dès maintenant via SQL direct par le Fondateur en attendant cette UI, cohérent avec le principe
"jamais par simple déclaration" (pas de raccourci qui romprait cette garantie). Corrélation automatique avec
le module Réussites (§6.1.2) — différée, calcul manuel du delta pour l'instant.

## Tâches

### T1 — Schéma
`profils_publics_formateurs.specialites_dimensions_iga text[]` (additif) ; tables
`indice_performance_praticien` (organisation_id unique, score numeric, calculé par trigger/vue à partir de
`evenements_ipp`) et `evenements_ipp` (append-only, type check, delta, motif, verifie_par, created_at) ;
RLS lecture ouverte (classement public), écriture réservée fondateur.
**Vérification** : script SQL — insertion d'un événement met à jour le score calculé ; un rôle non-fondateur
ne peut jamais insérer dans `evenements_ipp` ; cloisonnement (aucune fuite d'organisation_id d'autrui).

### T2 — Déclaration de spécialités sur `/solo/profil`
Cases à cocher par dimension IGA (toutes tranches d'âge confondues — un praticien peut être spécialisé sur
plusieurs référentiels), sauvegarde dans `specialites_dimensions_iga`.
**Vérification** : Playwright, cocher une spécialité et la retrouver sur le profil public.

### T3 — Moteur de recommandation sur la page de résultat IGA
Pour chaque dimension faible : conseil générique statique + liste des comptes Solo/Structure déclarant cette
spécialité, triés par IPP (repli alphabétique si égalité/absence de données) + toujours un bouton "Contacter
le Fondateur". Aucune recommandation algorithmique bloquante si la base de praticiens est vide (§5).
**Vérification** : Playwright — un praticien spécialisé apparaît dans la liste pour la bonne dimension ; le
bouton Fondateur est toujours visible même sans praticien disponible.

### T4 — Affichage IPP sur le profil public formateur
Score IPP affiché à côté du badge Vérifié existant, avec mention explicite "basé sur des résultats
vérifiés" pour ne jamais laisser croire à une auto-déclaration.
**Vérification** : Playwright, IPP visible et cohérent avec les événements de test insérés.

### T5 — Tests + clôture
Suite complète rejouée, `ETAT_PROJET.md`/`DECISIONS_LOG.md` mis à jour, `tsc --noEmit` propre.

## Ordre d'exécution
T1 → T2 → T3 → T4 → T5.
