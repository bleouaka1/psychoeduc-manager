-- Même correctif que formations_delete_solo (20260707010000) : le rôle 'administrateur'
-- (propriétaire de tout Compte Solo) a peut_supprimer=false sur 'beneficiaires' depuis
-- l'Étape 5 — restriction voulue pour les structures/employeurs à plusieurs intervenants,
-- mais bloquante pour un Compte Solo qui doit pouvoir supprimer SON PROPRE bénéficiaire
-- sans historique (PROMPT-GESTION-BENEFICIAIRES.md section 1). Policy additionnelle
-- scoping type_organisation='solo' uniquement, combinée en OR avec l'existante.
create policy beneficiaires_delete_solo on public.beneficiaires
  for delete using (
    exists (select 1 from public.organisations o where o.id = beneficiaires.organisation_id and o.type_organisation = 'solo')
    and public.peut_modifier('beneficiaires', beneficiaires.organisation_id)
  );
