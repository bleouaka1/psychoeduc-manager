-- Dashboard bénéficiaire v3, Lot J — pivot du générateur de CV vers un formulaire
-- standard autonome (handoff-icc-cv-navigation-1.md §2.2, révision). Le formulaire
-- soumis par l'utilisateur devient la source de vérité envoyée à Haiku, conservé ici
-- pour que finaliserGenerationCv() puisse le relire après confirmation du paiement
-- sans dépendre d'une agrégation ICC/IGA (qui ne concernait de toute façon que les
-- bénéficiaires, jamais les autres types de compte).
alter table public.cv_generations
  add column if not exists formulaire_json jsonb;
