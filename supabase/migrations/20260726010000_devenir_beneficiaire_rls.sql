-- Comptes multiprofils — "Devenir bénéficiaire" en self-service (CLAUDE-CODE-COMPTES-MULTIPROFILS.md,
-- §1 : "cas d'usage initial : un praticien dans son propre système"). Jusqu'ici seul le
-- praticien pouvait créer une fiche bénéficiaire pour un tiers (invitation) ; il manquait le
-- chemin inverse — un compte existant (Fondateur, Formateur, tout type) qui choisit de devenir
-- lui-même bénéficiaire d'un AUTRE praticien. DROP + CREATE nécessaire pour étendre une policy
-- existante. Migration additive uniquement (élargit un droit, n'en retire aucun).
drop policy if exists beneficiaires_insert on public.beneficiaires;
create policy beneficiaires_insert on public.beneficiaires
  for insert with check (
    public.is_fondateur()
    or public.peut_creer('beneficiaires', organisation_id)
    or profile_id = auth.uid()
  );
