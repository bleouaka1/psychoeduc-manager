-- Compte Structure — Espace Parent : correction RLS (étape 7/10, trouvé en testant).
-- lib/comptes.ts::compteEstParent() (count simple sur liens_parent_beneficiaire) renvoyait
-- bien `true`, mais la page elle-même embarque beneficiaires(...organisations(nom)) via
-- PostgREST — un embed imbriqué se comporte comme un INNER JOIN, donc filtré par la RLS
-- des tables embarquées. Le parent n'avait accès ni à `beneficiaires` ni à `organisations`
-- directement (seulement à son propre lien), la ligne entière disparaissait du résultat,
-- et la page se redirigeait elle-même vers /login (aucun lien "visible" après le join).
-- Migration additive uniquement.

drop policy if exists beneficiaires_select_parent_lie on public.beneficiaires;
create policy beneficiaires_select_parent_lie on public.beneficiaires
  for select using (
    exists (
      select 1 from public.liens_parent_beneficiaire l
      where l.beneficiaire_id = beneficiaires.id
        and l.parent_profile_id = auth.uid()
        and l.statut = 'actif'
    )
  );

drop policy if exists organisations_select_parent_lie on public.organisations;
create policy organisations_select_parent_lie on public.organisations
  for select using (
    exists (
      select 1 from public.liens_parent_beneficiaire l
      where l.organisation_id = organisations.id
        and l.parent_profile_id = auth.uid()
        and l.statut = 'actif'
    )
  );
