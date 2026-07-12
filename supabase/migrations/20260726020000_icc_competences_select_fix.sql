-- Correctif : icc_competences_select dépendait de inscriptions_formations (achat
-- marketplace) pour l'accès bénéficiaire — trop fragile, un bénéficiaire peut avoir
-- des évaluations ICC sans être passé par un achat marketplace suivi. Alignée sur le
-- même principe que icc_evaluations_savoir/savoir_faire/observations : accès via
-- l'existence d'une évaluation/observation propre au bénéficiaire sur cette formation,
-- jamais via un mécanisme d'achat externe. Migration additive (DROP+CREATE nécessaire
-- pour remplacer une policy existante).
drop policy if exists icc_competences_select on public.icc_competences;
create policy icc_competences_select on public.icc_competences for select using (
  public.is_fondateur()
  or public.peut_lire('icc_competences', organisation_id)
  or exists (
    select 1 from public.beneficiaires b
    where b.profile_id = auth.uid()
      and (
        exists (select 1 from public.icc_evaluations_savoir e where e.competence_id = icc_competences.id and e.beneficiaire_id = b.id)
        or exists (select 1 from public.icc_evaluations_savoir_faire e where e.competence_id = icc_competences.id and e.beneficiaire_id = b.id)
        or exists (select 1 from public.icc_observations_savoir_etre o where o.formation_id = icc_competences.formation_id and o.beneficiaire_id = b.id)
      )
  )
);
