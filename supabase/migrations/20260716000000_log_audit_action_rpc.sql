-- RPC d'audit pour les Server Actions applicatives (modération Marketplace).
-- `audit_logs` a RLS activée sans policy d'écriture pour `authenticated` (Étape 1,
-- append-only strict, voir commentaire "aucune policy d'écriture pour le rôle") :
-- seul un trigger SECURITY DEFINER (log_audit()) ou une fonction équivalente peut y
-- écrire. Les actions de modération (validation/suspension/suppression d'offres)
-- sont de simples UPDATE sur marketplace_offres — le trigger générique log_audit()
-- capture déjà avant/après, mais pas le motif ni un libellé d'action lisible. Cette
-- fonction permet à une Server Action d'ajouter une entrée d'audit complémentaire,
-- toujours avec profile_id = auth.uid() (jamais falsifiable par l'appelant).
create or replace function public.log_audit_action(
  p_action text,
  p_table_cible text,
  p_ligne_id uuid,
  p_donnees_apres jsonb default null,
  p_organisation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (organisation_id, profile_id, action, table_cible, ligne_id, donnees_apres)
  values (p_organisation_id, auth.uid(), p_action, p_table_cible, p_ligne_id, p_donnees_apres);
end;
$$;

grant execute on function public.log_audit_action(text, text, uuid, jsonb, uuid) to authenticated;
