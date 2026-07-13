-- Accès bénéficiaire au module Insertion professionnelle (CLAUDE-CODE-DASHBOARD-BENEFICIAIRE.md §6).
-- Écart réel trouvé : offres_emploi/entreprises_partenaires/candidatures n'avaient
-- aucune clause de repli pour un profil sans adhésion à membres_organisations (contrairement
-- à opportunites/concours/bourses/financements/metiers_porteurs/analyses_marche, qui ont déjà
-- `organisation_id is null`) — un bénéficiaire n'aurait jamais rien vu sur cette page, RLS
-- filtrant silencieusement tout. Policies additionnelles (Postgres combine les policies SELECT
-- d'une même table en OR), même principe que l'extension RLS déjà appliquée pour ICC/projets_vie
-- (accès via l'existence d'un dossier bénéficiaire propre, jamais via membres_organisations).
-- Migration additive uniquement.

create policy offres_emploi_select_beneficiaire on public.offres_emploi
  for select using (
    exists (select 1 from public.beneficiaires b where b.organisation_id = offres_emploi.organisation_id and b.profile_id = auth.uid())
  );

create policy entreprises_partenaires_select_beneficiaire on public.entreprises_partenaires
  for select using (
    exists (select 1 from public.beneficiaires b where b.organisation_id = entreprises_partenaires.organisation_id and b.profile_id = auth.uid())
  );

-- candidatures : uniquement les siennes (pas celles d'un autre bénéficiaire de la même organisation).
create policy candidatures_select_beneficiaire on public.candidatures
  for select using (
    exists (select 1 from public.beneficiaires b where b.id = candidatures.beneficiaire_id and b.profile_id = auth.uid())
  );
