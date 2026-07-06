-- Correctif : le rôle 'administrateur' (celui du propriétaire réel de tout Compte
-- Solo, cf. bootstrap trigger — 'fondateur' n'est qu'un cas particulier) a
-- délibérément peut_supprimer=false sur 'formations' depuis l'Étape 8, pour éviter
-- qu'un administrateur de STRUCTURE/EMPLOYEUR ne supprime définitivement une
-- formation partagée par plusieurs éducateurs (politique de gouvernance voulue,
-- pas un oubli). Mais PROMPT-EDIT-DELETE-FORMATION.md exige qu'un Compte Solo
-- (organisation mono-propriétaire) puisse réellement supprimer sa propre fiche
-- quand personne n'y est inscrit. Plutôt que d'assouplir peut_supprimer pour TOUT
-- administrateur (ce qui rouvrirait le risque structure/employeur), on ajoute une
-- policy permissive supplémentaire restreinte aux organisations type_organisation='solo'
-- uniquement — les deux policies de delete sont combinées en OR (comportement standard
-- des policies permissives Postgres), donc le comportement structure/employeur ne change pas.
create policy formations_delete_solo on public.formations
  for delete using (
    exists (select 1 from public.organisations o where o.id = formations.organisation_id and o.type_organisation = 'solo')
    and public.peut_modifier('formations', formations.organisation_id)
  );
