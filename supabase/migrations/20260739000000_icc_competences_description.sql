-- Dashboard bénéficiaire v3 — la maquette affiche un libellé court ET une phrase
-- complète séparée ("Vous savez réaliser un devis de manière autonome"). Additive et
-- nullable : saisie optionnelle par le formateur, jamais générée automatiquement
-- (même principe que le libellé — pas de conjugaison auto sur du texte libre).
alter table public.icc_competences
  add column if not exists description text;
