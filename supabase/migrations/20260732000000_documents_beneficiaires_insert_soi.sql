-- Écart réel trouvé en testant le dépôt de document par un bénéficiaire (module
-- Quiz de révision) : documents_beneficiaires_insert (Étape 5) n'autorise que
-- is_fondateur() OU peut_creer (scopé à membres_organisations) — un bénéficiaire
-- sans adhésion n'a jamais pu créer sa propre ligne. Même famille de bug que la
-- policy SELECT déjà corrigée dans 20260730000000 (oubliée pour l'INSERT à ce
-- moment-là). Policy additionnelle (Postgres combine les policies INSERT en OR).
create policy documents_beneficiaires_insert_soi on public.documents_beneficiaires
  for insert with check (
    exists (select 1 from public.beneficiaires b where b.id = documents_beneficiaires.beneficiaire_id and b.profile_id = auth.uid())
  );
