-- Correctif Phase 3 (ICC) trouvé en vérifiant bout en bout : formations_select ne
-- couvrait que les membres de l'organisation — un bénéficiaire consultant son propre
-- ICC (/mon-espace) ne pouvait jamais lire le titre de la formation concernée (jointure
-- icc_competences(...).formations(titre) silencieusement vide sous RLS, jamais une
-- erreur visible). Étendue au même principe que les autres tables ICC : accès via
-- l'existence d'une évaluation/observation ICC propre au bénéficiaire sur cette
-- formation, ou via un achat marketplace suivi (inscriptions_formations) déjà en place.
-- Migration additive (DROP+CREATE nécessaire pour étendre une policy existante).
drop policy if exists formations_select on public.formations;
create policy formations_select on public.formations for select using (
  public.is_fondateur()
  or public.peut_lire('formations', organisation_id)
  or exists (select 1 from public.inscriptions_formations i where i.formation_id = formations.id and i.acheteur_id = auth.uid())
  or exists (
    select 1 from public.beneficiaires b
    where b.profile_id = auth.uid()
      and (
        exists (
          select 1 from public.icc_competences c
          where c.formation_id = formations.id
            and (
              exists (select 1 from public.icc_evaluations_savoir e where e.competence_id = c.id and e.beneficiaire_id = b.id)
              or exists (select 1 from public.icc_evaluations_savoir_faire e where e.competence_id = c.id and e.beneficiaire_id = b.id)
            )
        )
        or exists (select 1 from public.icc_observations_savoir_etre o where o.formation_id = formations.id and o.beneficiaire_id = b.id)
      )
  )
);
