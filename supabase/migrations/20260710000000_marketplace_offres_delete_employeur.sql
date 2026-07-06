-- Correctif : marketplace_offres_delete (Étape 16) n'autorisait QUE
-- is_fondateur() ou vendeur_id = auth.uid() — aucune clause organisation_id/peut_supprimer,
-- contrairement à select/insert/update. Résultat : un compte Solo ou Employeur (qui
-- utilisent tous deux organisation_id, jamais vendeur_id) ne pouvait JAMAIS supprimer
-- sa propre offre, quel que soit son rôle. Même famille de bug que formations/beneficiaires
-- (administrateur a peut_supprimer=false par défaut) — ici le problème est plus large :
-- même peut_supprimer=true n'aurait pas suffi, la policy ne testait pas du tout organisation_id.
-- Policy additionnelle scopée aux organisations solo ET employeur (structures non concernées
-- par ce module, aucun besoin exprimé pour elles à ce jour).
create policy marketplace_offres_delete_solo_employeur on public.marketplace_offres
  for delete using (
    exists (select 1 from public.organisations o where o.id = marketplace_offres.organisation_id and o.type_organisation in ('solo','employeur'))
    and public.peut_modifier('marketplace_offres', marketplace_offres.organisation_id)
  );
