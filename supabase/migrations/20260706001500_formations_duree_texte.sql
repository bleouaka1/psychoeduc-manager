-- Ajout additif : duree_texte (format libre "6 heures", "3 semaines", "à son rythme")
-- distinct de duree_heures (numerique, deja utilise ailleurs, Etape 8). Le compte
-- Solo a besoin du format libre demande par CONSIGNES-COMPTE-SOLO.md section 3.1.
alter table public.formations
  add column if not exists duree_texte text;
