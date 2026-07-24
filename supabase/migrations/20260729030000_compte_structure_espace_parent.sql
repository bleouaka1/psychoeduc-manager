-- Compte Structure — Espace Parent (§4.3, étape 7/10). Migration additive uniquement.

-- ============================================================================
-- Présences : le parent voit les faits bruts (présent/absent/retard) de SON enfant
-- uniquement — reprend l'exemple RLS du document source à la lettre.
-- ============================================================================
drop policy if exists parent_voit_presence_de_son_enfant on public.presences;
create policy parent_voit_presence_de_son_enfant on public.presences
  for select using (
    exists (
      select 1 from public.liens_parent_beneficiaire l
      where l.beneficiaire_id = presences.beneficiaire_id
        and l.parent_profile_id = auth.uid()
        and l.statut = 'actif'
    )
  );

-- ============================================================================
-- Tendance de progression : jamais le score IGA brut ni le détail par dimension
-- (contrainte non négociable §4.3) — une fonction SECURITY DEFINER qui ne renvoie
-- QU'UNE étiquette ('progresse'/'stable'/'en_difficulte'/'inconnue') est la garantie
-- la plus robuste de cette règle : même une inspection du trafic réseau ne peut pas
-- exposer le chiffre, contrairement à un calcul fait côté client à partir de scores
-- transmis bruts. Vérifie elle-même le lien parent->bénéficiaire (pas de RLS élargie
-- sur evaluations_iga pour ce rôle, cf. leçon de l'Étape 5 sur les fuites via peut_lire).
-- ============================================================================
create or replace function public.tendance_iga_enfant(p_beneficiaire_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_autorise boolean;
  v_dernier numeric;
  v_precedent numeric;
begin
  select exists (
    select 1 from public.liens_parent_beneficiaire l
    where l.beneficiaire_id = p_beneficiaire_id and l.parent_profile_id = auth.uid() and l.statut = 'actif'
  ) into v_autorise;

  if not v_autorise then
    return null;
  end if;

  select score_global into v_dernier
    from public.evaluations_iga
    where beneficiaire_id = p_beneficiaire_id
    order by date_evaluation desc
    limit 1;

  if v_dernier is null then
    return 'inconnue';
  end if;

  select score_global into v_precedent
    from public.evaluations_iga
    where beneficiaire_id = p_beneficiaire_id
    order by date_evaluation desc
    offset 1 limit 1;

  if v_precedent is null then
    return 'stable';
  elsif v_dernier > v_precedent then
    return 'progresse';
  elsif v_dernier < v_precedent then
    return 'en_difficulte';
  else
    return 'stable';
  end if;
end;
$$;

grant execute on function public.tendance_iga_enfant(uuid) to authenticated;
