ARCHITECTURE FINALE FUSIONNÉE – PSYCHOÉDUC MANAGER v5.0

Consigne générale pour Claude Code / Supabase

Ce document remplace toutes les anciennes versions, y compris la v3.1 et la v4.0.

Changements majeurs par rapport à la v4.0 :
- Suppression complète du volet ministères/gouvernement (déjà fait en v4, confirmé ici)
- Le seuil de "30 bénéficiaires" pour distinguer Solo/Structure est abandonné. La distinction repose uniquement sur la nature juridique du compte, déclarée à l'inscription : Compte Solo = personne physique agissant en son nom propre (formateur, coach, consultant, enseignant indépendant), quel que soit son nombre de bénéficiaires. Structure = entité juridiquement constituée (école, ONG, association, centre), quel que soit son nombre de bénéficiaires.
- Ajout du référentiel IGA versionné (durabilité des comparaisons historiques)
- Ajout du registre financier append-only (mouvements_financiers)
- Ajout de la conformité et des consentements (données de mineurs)
- Ajout du module Marketplace (formations, services, produits – validation obligatoire, commission 15%)
- Ajout du module Événements (gratuits et payants – Fondateur publie directement, autres soumis à validation, commission 15% sur événements payants)
- Ajout du module Réussites (projet de vie validé ET insertion maintenue ≥ 3 mois, proposée par le système puis confirmée par un humain)
- Ajout de Sauvegardes & export hors-ligne (protection contre le piratage, sauvegarde nocturne chiffrée automatique + export manuel Fondateur)

Supabase AI doit construire Psychoéduc Manager étape par étape, une seule à la fois, jamais tout d'un coup. Après chaque étape : vérifier les tables créées, les FK, les RLS, les index, les triggers, puis attendre validation avant l'étape suivante.

Règle principale :

Un compte Solo n'est pas une table séparée. Un compte Solo est une organisation avec "type_organisation = 'solo'".

Il ne faut donc pas créer :
- "comptes_solo"
- "dashboard_solo"
- "beneficiaires_solo"

La base officielle repose sur :
- "profiles"
- "organisations"
- "membres_organisations"
- "roles_utilisateurs"
- "beneficiaires"
- "personnel_structures"
- "licences"
- "abonnements"
- "paiements"
- "modules_actives"
- "audit_logs"
- "mouvements_financiers"
- "referentiels_iga"
- "consentements_donnees"

---

1. Vision officielle

Psychoéduc Manager est un outil de formation, de suivi et d'insertion socio-professionnelle. La logique centrale n'est pas le nombre d'inscrits, mais la transformation réelle d'une vie : Projet de vie – Former – Accompagner – Évaluer – Insérer – Réussir.

Le tableau de bord Fondateur doit pouvoir raconter le parcours complet d'une personne : son entrée dans le système, sa formation, les compétences acquises, son employeur, son mentor et son capital social, les opportunités saisies, son comportement observé dans le temps, et le résultat final – réussite confirmée ou non. C'est la boussole du produit, à ne jamais perdre de vue dans les choix techniques.

Ordre de construction recommandé (pas l'ordre numérique brut des étapes) :
1. Socle : Authentification, organisations, bénéficiaires, IGA, suivi (Étapes 1 à 5, 9)
2. Réussites + Parcours individuel (rendre la mission visible)
3. Finances + Licences (ce qui fait vivre la plateforme)
4. Marketplace + Événements (monétisation complémentaire, peut attendre)
5. Reste des modules (formations détaillées, capital social, intelligence économique, financement participatif, communication, IA, support)

---

2. Principes techniques absolus

Toutes les tables doivent respecter :
- UUID sur toutes les clés primaires.
- "organisation_id" sur toutes les tables métier.
- "created_at" sur toutes les tables.
- "updated_at" sur toutes les tables modifiables.
- "created_by" et "updated_by" sur les tables de contenu.
- Row Level Security activé sur toutes les tables métier, testé explicitement avec deux comptes de deux organisations différentes avant de considérer une étape terminée.
- Isolation stricte entre organisations.
- Le Fondateur a un accès global.
- Index sur toutes les clés étrangères.
- Contraintes FK obligatoires.
- Triggers automatiques pour "updated_at".
- Audit automatique dans "audit_logs".
- "audit_logs" ne doit jamais s'auto-auditer.
- Les vues dashboard doivent être en "security_invoker".
- L'âge ne se stocke jamais : il est calculé depuis "date_naissance".
- Toute logique métier critique (calculs IGA, règles financières) s'écrit en TypeScript/JavaScript standard, pas en fonctions propriétaires Supabase profondément imbriquées, pour rester portable.
- Les tables financières sont append-only strict (RLS interdisant UPDATE et DELETE) : tout changement d'état est une nouvelle ligne, jamais une modification en place.
- Toutes les migrations sont additives. Jamais de colonne supprimée ou de table renommée sans étape de transition explicite.

---

3. Étape 1 – Authentification, organisations et rôles

Tables à créer :
- "profiles"
- "organisations"
- "membres_organisations"
- "roles_utilisateurs"
- "permissions"
- "audit_logs"

Types d'organisations :
- solo
- structure
- centre
- ong
- ecole
- employeur
- entreprise
- association
- fondation

Rôles officiels :
- fondateur
- super_admin_client
- administrateur
- directeur
- coordinateur
- educateur
- formateur
- enseignant
- coach
- consultant
- psychologue
- assistant_social
- beneficiaire
- parent
- tuteur
- mentor
- employeur
- recruteur
- partenaire

Fonctions RLS nécessaires :
- "is_fondateur()"
- "est_membre_organisation(organisation_id)"
- "role_dans_organisation(organisation_id)"
- "peut_lire(module, organisation_id)"
- "peut_creer(module, organisation_id)"
- "peut_modifier(module, organisation_id)"
- "peut_supprimer(module, organisation_id)"

Le type d'organisation (solo/structure) est déclaré par la personne elle-même à l'inscription, jamais calculé automatiquement à partir d'un nombre de bénéficiaires.

---

4. Étape 2 – SaaS commercial

Tables à créer :
- "licences"
- "abonnements"
- "paiements"
- "modules_actives"
- "quotas_organisations"
- "codes_promo"
- "essais_gratuits"
- "wallet_fondateur"
- "transactions_wallet"

Règles :
- Les revenus sont calculés uniquement avec "paiements.statut = 'confirme'".
- Chaque organisation possède une licence.
- Chaque licence définit les modules autorisés et peut limiter utilisateurs, bénéficiaires et stockage.

Types de licences :
- solo
- structure
- employeur

Statuts :
- essai_gratuit
- actif
- expire
- suspendu
- archive

---

5. Étape 3 – Clients : Solo, Structures, Employeurs

Les clients sont tous dans "organisations". Comptes Solo : type_organisation = 'solo'. Structures : type_organisation = 'structure', 'centre', 'ong', 'ecole', 'association', 'fondation'. Employeurs : type_organisation = 'employeur', 'entreprise'.

Tables complémentaires :
- "details_structures"
- "details_employeurs"
- "implantations"

Ne pas créer de table comptes_solo séparée. Le profil Solo est géré par organisations + profiles + membres_organisations.

---

6. Étape 4 – Utilisateurs & Personnel

Tables :
- "personnel_structures"
- "invitations_utilisateurs"
- "affectations_personnel"
- "sessions_connexion"

---

7. Étape 5 – Bénéficiaires

Table centrale : "beneficiaires"

Tables liées :
- "parents_tuteurs"
- "mentors"
- "documents_beneficiaires"
- "dossiers_beneficiaires"

Champs obligatoires dans "beneficiaires" : nom, prenoms, sexe (masculin/feminin/non_renseigne), date_naissance, âge jamais stocké (calculé), photo_url, téléphone, email, adresse, pays, ville, situation familiale, santé, handicap, niveau d'étude, formation actuelle, statut bénéficiaire, score IGA actuel, capital social, statut insertion, documents, organisation_id, created_by, updated_by.

---

8. Étape 6 – Présences & Assiduité

Tables :
- "classes_groupes"
- "inscriptions_classes"
- "presences"
- "retards"
- "absences"
- "justifications_absence"
- "alertes_assiduite"

---

9. Étape 7 – Suivi psycho-éducatif

Tables :
- "suivis"
- "objectifs"
- "observations"
- "entretiens"
- "incidents"
- "sanctions"
- "rapports"
- "projets_vie"

Chaque table contient : organisation_id, beneficiaire_id, created_by, updated_by si modifiable, created_at, updated_at.

---

10. Étape 8 – Formations & Classes

Tables :
- "formations"
- "cours"
- "ressources_cours"
- "competences"
- "preuves_competences"
- "quiz"
- "questions_quiz"
- "resultats_quiz"
- "devoirs"
- "soumissions_devoirs"

Réutiliser classes_groupes de l'Étape 6, ne pas la recréer.

---

11. Étape 9 – IGA : Indice Général d'Autonomie

IGA signifie Indice Général d'Autonomie (pas Activités Génératrices de Revenus).

Dimensions IGA : projet de vie, discipline, compétences techniques, compétences cognitives, compétences socio-affectives, capital social, employabilité, autonomie économique, santé et hygiène, citoyenneté, innovation, résilience.

Tables :
- "referentiels_iga" (id, version, date_effet, description, actif, created_at) – NOUVEAU en v5
- "dimensions_iga"
- "criteres_iga"
- "evaluations_iga" (doit inclure "referentiel_version_id", FK vers referentiels_iga.id, obligatoire – NOUVEAU en v5)
- "scores_iga"
- "indicateurs_iga"
- "preuves_iga"
- "recommandations_iga"
- "historique_iga"
- "classements_iga"
- "top100_iga"

Règle de versioning (NOUVEAU en v5) : toute évaluation créée est rattachée à la version du référentiel en vigueur au moment de l'évaluation, jamais à la version courante par défaut. Si le référentiel évolue un jour, les scores historiques restent comparables tels qu'ils ont été évalués à l'époque.

Niveaux : dependance, autonomie_emergente, autonomie_fonctionnelle, autonomie_avancee, leadership_autonome. Score global sur 100. Historique mensuel, classement mensuel et annuel.

---

12. Étape 10 – AGR : Activités Génératrices de Revenus

AGR est séparé de l'IGA.

Tables :
- "activites_agr"
- "revenus_agr"
- "charges_agr"
- "evaluations_agr"
- "rapports_agr"

---

13. Étape 11 – Capital social

Tables :
- "capital_social"
- "reseau_soutien"
- "soutiens_beneficiaires"
- "personnes_ressources"
- "evaluations_capital_social"

Ne pas recréer parents_tuteurs et mentors si elles existent déjà (Étape 7).

---

14. Étape 12 – Insertion professionnelle

Tables :
- "offres_emploi"
- "offres_stage"
- "demandes_stage"
- "candidatures"
- "insertions_professionnelles"
- "stages"
- "suivis_post_insertion"
- "evaluations_insertion"
- "entreprises_partenaires"
- "recrutements"

---

15. Étape 13 – Intelligence économique

Tables :
- "opportunites"
- "concours"
- "bourses"
- "financements"
- "metiers_porteurs"
- "analyses_marche"

---

16. Étape 14 – Financement participatif

Tables :
- "projets_financement"
- "contributions_financement"
- "commissions_financement"
- "retraits_financement"
- "wallets_beneficiaires"
- "preuves_utilisation_fonds"
- "rapports_financement"

Les soldes (wallets_beneficiaires, wallet_fondateur) ne sont jamais stockés/modifiés directement. Ils sont recalculés par une vue "vue_soldes_actuels" à partir de la somme des lignes dans mouvements_financiers (voir Étape 15bis).

---

17. Étape 15 – Registre financier append-only (NOUVEAU en v5)

Table pivot :
- "mouvements_financiers"
  (id, organisation_id, beneficiaire_id nullable, type_mouvement, montant, devise, reference_source_table, reference_source_id, statut, created_by, created_at)

Règle absolue : cette table est append-only strict. RLS interdit UPDATE et DELETE, seuls INSERT et SELECT sont autorisés. Tout changement d'état financier (paiement, commission, retrait) crée une nouvelle ligne, jamais une modification d'une ligne existante. C'est la source de vérité pour tous les soldes du système.

---

18. Étape 16 – Marketplace (NOUVEAU en v5)

Tables :
- "marketplace_offres" (id, vendeur_type (organisation/solo), vendeur_id, type_offre (formation/service/produit), titre, description, prix, devise, statut (en_attente_validation/publiee/refusee/masquee/retiree), valide_par, date_validation, nombre_signalements, organisation_id, created_by, created_at, updated_at)
- "marketplace_categories" (id, nom, type_offre, description)
- "marketplace_commandes" (id, offre_id, acheteur_id, montant_brut, taux_commission, montant_commission, montant_vendeur, statut_paiement, mouvement_financier_id, date_commande, organisation_id)
- "marketplace_avis" (id, offre_id, acheteur_id, note, commentaire, visible, created_at)
- "marketplace_signalements" (id, offre_id, signale_par, motif, statut (en_attente/traite), created_at)

Règles :
- Toute nouvelle offre entre en statut = en_attente_validation, invisible aux acheteurs tant qu'elle n'est pas validée par le Fondateur ou un rôle habilité.
- Commission fixe de 15% sur toute vente : montant_commission = montant_brut × 0.15, montant_vendeur = montant_brut × 0.85. Le taux vit dans "parametres_plateforme" (configurable sans redéploiement), pas codé en dur.
- Chaque commande génère une ligne dans mouvements_financiers avec la répartition déjà ventilée à l'écriture.
- Une offre publiée atteignant un seuil de signalements repasse automatiquement en statut = masquee en attendant réexamen humain.

---

19. Étape 17 – Événements (NOUVEAU en v5)

Tables :
- "evenements" (id, createur_type (fondateur/organisation/solo), createur_id, titre, description, type_evenement (gratuit/payant), prix, devise, date_debut, date_fin, lieu_type (physique/en_ligne), lieu_details, capacite_max, places_restantes, statut (en_attente_validation/publie/refuse/annule/termine), valide_par, date_validation, organisation_id, created_by, created_at, updated_at)
- "evenements_inscriptions" (id, evenement_id, participant_id, statut_paiement, montant_paye, mouvement_financier_id, date_inscription)
- "evenements_rappels" (id, evenement_id, canal (whatsapp/email), envoye_le)

Règles :
- Si createur_type = fondateur – statut = publie directement, aucune validation requise.
- Si createur_type = organisation ou solo – statut = en_attente_validation, même file que la marketplace.
- Événement payant – commission 15% (même taux et même mécanisme que la marketplace), calculée à l'inscription.
- Événement gratuit – pas de commission, juste suivi des inscriptions et places restantes.

---

20. Étape 18 – Réussites (NOUVEAU en v5)

Table :
- "reussites_beneficiaires" (id, beneficiaire_id, projet_vie_id, insertion_id, statut (proposee_systeme/confirmee/rejetee), score_iga_au_moment, duree_insertion_mois, projet_vie_valide (boolean), confirmee_par, date_confirmation, temoignage (nullable), organisation_id, created_at)

Règle de proposition automatique : le système propose une réussite dès que projets_vie.statut = 'valide' ET suivis_post_insertion montre un maintien en poste ≥ 3 mois. Elle reste en statut = proposee_systeme, invisible dans les statistiques officielles, jusqu'à confirmation ou rejet par un éducateur/coach. Seules les réussites confirmees comptent dans les indicateurs affichés au Fondateur – pas de gonflement artificiel des chiffres.

---

21. Étape 19 – Conformité et consentements (NOUVEAU en v5)

Tables :
- "consentements_donnees" (id, beneficiaire_id, type_consentement, donnee_par (parent_tuteur_id ou beneficiaire_id selon majorité), date_consentement, revocable, date_revocation nullable, organisation_id, created_by)

Ajouter à roles_utilisateurs :
- colonne "donnees_minimales_export" (boolean, défaut true) – définit si ce rôle a accès export complet ou minimal par défaut sur les données de bénéficiaires mineurs.

Règles :
- Un consentement est révocable à tout moment par la personne qui l'a donné.
- Chaque type d'usage des données (formation, insertion, marketplace, témoignage) peut nécessiter son propre consentement distinct.
- Un bénéficiaire sans consentement valide pour un usage donné ne doit pas voir ses données utilisées pour cet usage (ex. pas de partage de profil à un employeur sans consentement explicite pour l'insertion).

---

22. Étape 20 – Communication / WhatsApp

Tables :
- "messages"
- "messages_whatsapp"
- "campagnes_messages"
- "modeles_messages"
- "notifications"

Champ officiel dans notifications : "est_lue". Ne jamais utiliser "lu".

---

23. Étape 21 – Centre IA

Tables :
- "agents_ia"
- "sessions_ia"
- "rapports_ia"
- "recommandations_ia"
- "consommations_ia"

Règle de sécurité : consommations_ia doit vérifier quotas_organisations avant de lancer un appel IA, pour éviter qu'un compte gratuit ne génère une facture d'API incontrôlée.

---

24. Étape 22 – Support

Tables :
- "tickets_support"
- "reponses_support"
- "faq"
- "tutoriels"

---

25. Étape 23 – Statistiques mondiales & dashboards

Tables / vues :
- "statistiques_plateforme"
- "configurations_dashboard"
- "vue_dashboard_fondateur"
- "vue_dashboard_modules"
- "vue_carte_implantation"
- "vue_revenus"
- "vue_top100_iga"
- "vue_insertion"
- "vue_support"
- "vue_reussites" (NOUVEAU en v5)
- "vue_marketplace" (NOUVEAU en v5)
- "vue_soldes_actuels" (NOUVEAU en v5, calcule les soldes à partir de mouvements_financiers)

Les revenus sont calculés avec paiements.statut = 'confirme'. Les dashboards respectent le RLS. Le Fondateur voit toutes les données.

---

26. Étape 24 – Sauvegardes & export hors-ligne (NOUVEAU en v5)

Table :
- "sauvegardes_export" (id, type_export (complet/partiel), format (sql/csv/json), taille_mo, declenchee_par (systeme/fondateur), chiffree (boolean, toujours true), date_creation, url_stockage_temporaire, expire_le, statut (en_cours/prete/expiree), created_by)

Règles :
- Sauvegarde automatique complète chaque nuit, chiffrée, conservée 30 jours glissants.
- Export manuel à la demande, accessible uniquement au Fondateur.
- Le fichier téléchargeable est chiffré et le lien de téléchargement expire après 24h.
- Chaque téléchargement est tracé dans audit_logs.

---

27. Étape 25 – Paramètres généraux

Tables :
- "parametres_plateforme" (doit inclure le taux de commission marketplace/événements, configurable)
- "parametres_modules"
- "parametres_securite"
- "parametres_notifications"

---

28. Modèle économique

Revenus directs :
- Solo : 5 000 FCFA / mois
- Structure : 50 000 FCFA / mois
- Employeur : 15 000 FCFA / mois

Revenus complémentaires :
- commission recrutement réussi
- commission marketplace (15%)
- commission événements payants (15%)
- commission financement participatif
- IA premium
- certificats payants
- accompagnement structures
- formations professionnelles

---

29. Instruction finale

Claude Code / Supabase AI doit toujours générer une seule étape à la fois, dans l'ordre de priorité recommandé en section 1 (socle – réussites/parcours – finances – marketplace/événements – reste), pas nécessairement dans l'ordre numérique brut ci-dessus.

Après chaque étape : vérifier les tables créées, les FK, les RLS (testées avec deux comptes de deux organisations différentes), les index, les triggers, puis attendre validation avant l'étape suivante. Aucune étape suivante ne doit être générée sans validation.

Positionnement final :

Psychoéduc Manager est un outil de formation, de suivi et d'insertion socio-professionnelle qui relie bénéficiaires, professionnels, structures et employeurs pour transformer des parcours de vie en réussites concrètes et durables – mesurables, tracées, et vérifiées par un humain avant d'être comptées comme telles.
