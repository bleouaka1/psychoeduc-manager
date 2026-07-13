-- Écart réel trouvé : log_audit() ne renseignait organisation_id que pour 3 tables
-- (organisations, membres_organisations, roles_utilisateurs) — pour toutes les autres,
-- y compris `beneficiaires`, organisation_id restait NULL dans audit_logs. Conséquence :
-- audit_logs_select (is_fondateur() OR est_membre_organisation(organisation_id)) ne
-- laissait jamais un administrateur non-fondateur (ex. Compte Solo) voir la suppression
-- de son propre bénéficiaire dans le journal d'audit — silencieusement, jamais une erreur.
-- Corrigé par une valeur de repli générique : extrait organisation_id directement de la
-- ligne concernée (via to_jsonb) si la table en a une colonne, sans avoir à énumérer
-- chaque table une à une. Migration additive (CREATE OR REPLACE, aucune donnée existante
-- modifiée — seules les futures lignes d'audit bénéficient du correctif).
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organisation_id uuid;
  v_profile_id uuid := auth.uid();
begin
  if TG_TABLE_NAME = 'organisations' then
    v_organisation_id := coalesce(new.id, old.id);
  elsif TG_TABLE_NAME = 'membres_organisations' then
    v_organisation_id := coalesce(new.organisation_id, old.organisation_id);
  elsif TG_TABLE_NAME = 'roles_utilisateurs' then
    select mo.organisation_id into v_organisation_id
    from public.membres_organisations mo
    where mo.id = coalesce(new.membre_organisation_id, old.membre_organisation_id);
  else
    v_organisation_id := (to_jsonb(coalesce(new, old))->>'organisation_id')::uuid;
  end if;

  insert into public.audit_logs (organisation_id, profile_id, action, table_cible, ligne_id, donnees_avant, donnees_apres)
  values (
    v_organisation_id,
    v_profile_id,
    TG_OP,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
