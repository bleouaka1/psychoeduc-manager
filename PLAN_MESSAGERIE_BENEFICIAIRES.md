# Plan — Messagerie directe WhatsApp/Email (Gestion des bénéficiaires)

Réf : `SPEC-Messagerie-Beneficiaires.md`. Portée V1 uniquement (mode A — lien `wa.me` + `mailto`) ;
le mode B (WhatsApp Business API) est explicitement hors périmètre (chantier à part, cf. spec §3).

## Constat schéma (avant d'ajouter quoi que ce soit)

- `beneficiaires.telephone`/`.email`, `parents_tuteurs.telephone`/`.email` existent déjà (Étape 5) — aucune
  nouvelle colonne de contact nécessaire pour ces deux catégories. Décision : réutiliser `telephone` tel
  quel comme numéro WhatsApp plutôt qu'ajouter une colonne `telephone_whatsapp` dupliquée — un praticien n'a
  qu'un seul numéro de toute façon, la distinction de la spec est fonctionnelle (à quel usage sert ce champ),
  pas une donnée séparée à stocker deux fois.
- "Formateur/Responsable" (3ᵉ catégorie de la spec) n'a pas de table dédiée : c'est le personnel affecté au
  bénéficiaire via `affectations_personnel` (`cible_type='beneficiaire'`, `cible_id=<beneficiaire_id>`) →
  `membres_organisations` → `profiles.telephone`/`.email` (déjà existants, Étape 1). Aucune nouvelle table.
- Aucune page `/solo/parametres` n'existe encore (menu actuel : Vue générale/Bénéficiaires/Formations/
  Marketplace/Calendrier/Revenus/Profil public). Le "Profil public" est la vitrine visible des acheteurs —
  sémantiquement différent d'un réglage privé. Décision : nouvelle page privée `/solo/parametres` (un seul
  bloc "Communication" en V1), pas une extension de `/solo/profil`.
- Préférence de mode WhatsApp par défaut = réglage par organisation (Compte Solo), pas par profil individuel
  (cohérent avec le reste du projet où les paramètres de compte sont au niveau organisation). Décision :
  nouvelle colonne `organisations.mode_whatsapp_defaut` plutôt qu'une nouvelle table à une seule ligne par org.

## Tâches

### T1 — Migration additive : `organisations.mode_whatsapp_defaut`
**Objectif** : `alter table organisations add column if not exists mode_whatsapp_defaut text not null default 'lien_simple' check (mode_whatsapp_defaut in ('lien_simple','api_business'))`. Aucune RLS nouvelle (la table `organisations` a déjà ses policies de lecture/écriture existantes).
**Dépendances** : aucune.
**Vérification** : script SQL confirmant la colonne existe, valeur par défaut `'lien_simple'` sur une organisation existante, non-régression des policies déjà en place (lecture par les membres, écriture par l'administrateur/fondateur).
**Risque de décision structurante** : faible — colonne additive, valeur par défaut non bloquante, aucune donnée existante affectée.

### T2 — Fonction utilitaire de génération de liens (TypeScript, pas de dépendance serveur)
**Objectif** : `lib/messagerieDirecte.ts` — `genererLienWhatsApp(telephone: string, message: string): string` (format `https://wa.me/<numéro nettoyé>?text=<encodé>`, nettoie le numéro des espaces/tirets/parenthèses, garde uniquement les chiffres et le `+`) et `genererLienMailto(email: string, sujet: string, corps: string): string`. Pure logique métier découplée du fournisseur cloud (principe absolu du projet), testable unitairement sans base de données.
**Dépendances** : aucune.
**Vérification** : test unitaire (ou script Node ad hoc, pas besoin de Playwright) — numéro avec espaces/tirets produit un lien `wa.me` propre, message encodé correctement (accents, retours à la ligne), email + sujet + corps produisent un `mailto:` valide et décodable.
**Risque de décision structurante** : aucun.

### T3 — Fonction serveur de résolution des contacts d'un bénéficiaire
**Objectif** : `lib/messagerieDirecte.ts` (ou fichier serveur dédié) — `chargerContactsBeneficiaire(beneficiaireId): { beneficiaire: Contact; parentsTuteurs: Contact[]; formateursResponsables: Contact[] }` où chaque `Contact = { id, nom, telephone: string|null, email: string|null }`. Formateurs/responsables résolus via `affectations_personnel` → `membres_organisations` → `profiles`, filtré sur `statut='active'`.
**Dépendances** : T1 non requis pour cette tâche (indépendante), mais logiquement après T2 (réutilise le type `Contact`).
**Vérification** : test SQL/Playwright — un bénéficiaire avec 1 parent + 2 affectations actives retourne exactement ces contacts ; un bénéficiaire d'une AUTRE organisation n'est jamais résolvable par ce praticien (cloisonnement RLS déjà en place sur `beneficiaires`/`parents_tuteurs`/`affectations_personnel`, vérifié explicitement par un test à deux organisations).
**Risque de décision structurante** : faible — lecture seule, s'appuie entièrement sur les policies RLS déjà existantes.

### T4 — Composant modal "Envoyer un message"
**Objectif** : `app/solo/_components/EnvoyerMessageModal.tsx` — sélecteur à choix unique (Bénéficiaire / Parent-Tuteur / Formateur-Responsable), liste déroulante secondaire si plusieurs contacts dans une catégorie (ex. père + mère), puis boutons "WhatsApp"/"Email" désactivés avec message explicite si le contact choisi n'a pas le champ correspondant renseigné. Ouvre le lien via `window.open` (WhatsApp) ou navigation directe (`mailto:`), jamais d'appel serveur pour l'envoi lui-même (V1 = lien simple, aucun tracking, cf. spec).
**Dépendances** : T2, T3.
**Vérification** : test Playwright — ouverture du modal depuis la fiche bénéficiaire, sélection de chaque catégorie, bouton désactivé si champ manquant (vérifié avec un bénéficiaire de test sans email), au moins un lien `wa.me`/`mailto` généré contient bien le contenu attendu (interception de `window.open` ou vérification de l'attribut `href`).
**Risque de décision structurante** : aucun — aucune écriture en base pour l'envoi lui-même (cohérent avec "aucun historique/suivi" du mode A, spec §3).

### T5 — Bouton "Envoyer un message" sur la fiche bénéficiaire
**Objectif** : `app/solo/beneficiaires/[id]/page.tsx` — bouton ouvrant `EnvoyerMessageModal` avec les contacts chargés par T3.
**Dépendances** : T4.
**Vérification** : test Playwright de bout en bout — depuis `/solo/beneficiaires/[id]`, clic sur "Envoyer un message", modal s'ouvre avec les bons contacts pré-chargés.
**Risque de décision structurante** : aucun.

### T6 — Page `/solo/parametres` (bloc Communication)
**Objectif** : nouvelle page privée listant le mode WhatsApp par défaut (radio Lien simple / API Business — API Business affiché mais désactivé avec mention "Bientôt disponible", cohérent avec le hors-périmètre V1 explicite de la spec) ; Server Action `definirModeWhatsAppDefaut(mode: 'lien_simple')` (seul mode réellement modifiable en V1 — le formulaire refuse `api_business` côté serveur, pas seulement côté UI). Entrée de sidebar ajoutée (`NAV_SECTIONS` du layout Solo).
**Dépendances** : T1.
**Vérification** : test Playwright — changer le réglage, `router.refresh()`, revérifier la valeur persistée en base ; tentative de forcer `api_business` via appel direct à la Server Action retourne une erreur explicite (pas un crash).
**Risque de décision structurante** : faible — nouveau réglage non bloquant, valeur par défaut déjà sûre (`lien_simple`).

### T7 — Câblage du mode par défaut dans le modal (T4)
**Objectif** : `EnvoyerMessageModal` lit `organisation.mode_whatsapp_defaut` pour proposer le bon mode par défaut au moment de l'envoi (bascule à la volée possible dans la modale elle-même, cf. spec §3) — en V1, la bascule n'a de sens que théorique puisque seul le mode lien simple est implémenté ; le composant doit néanmoins être structuré pour accueillir le mode B sans réécriture (prop `modeWhatsApp` déjà paramétrable).
**Dépendances** : T4, T6.
**Vérification** : test Playwright — le mode par défaut réglé en T6 est bien celui pré-sélectionné à l'ouverture du modal.
**Risque de décision structurante** : aucun.

### T8 — Tests + clôture
**Objectif** : suite de tests ci-dessus toutes vertes, mise à jour `ETAT_PROJET.md` + `DECISIONS_LOG.md` (décisions ci-dessus : réutilisation de `telephone`, résolution formateur via `affectations_personnel`, nouvelle page `/solo/parametres` plutôt qu'extension de `/solo/profil`).
**Dépendances** : T1 à T7.
**Vérification** : `tsc --noEmit` propre, suite Playwright complète rejouée sans régression.
**Risque de décision structurante** : aucun (documentation seule).

## Ordre d'exécution

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 (T1/T2/T3 peuvent être menées en parallèle si besoin, aucune dépendance croisée entre elles).

## Note sur l'autonomie

Angenor a demandé "avance et exécute" — mode autonome sur ce plan : aucune tâche ci-dessus ne touche à
l'IGA, à l'argent, ou à une migration destructive (checklist de durabilité respectée), donc aucun arrêt de
validation intermédiaire n'est nécessaire. Les décisions structurantes (réutilisation `telephone`, nouvelle
page `/solo/parametres`) sont documentées ci-dessus et dans `DECISIONS_LOG.md` a posteriori, pas bloquantes.
