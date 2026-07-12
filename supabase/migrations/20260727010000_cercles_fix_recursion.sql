-- Correctif : récursion RLS infinie entre cercles_apprentissage_select (qui lit
-- cercles_membres pour vérifier le membre actif) et cercles_membres_select (qui lit
-- cercles_apprentissage pour résoudre organisation_id) — même classe de bug déjà
-- rencontrée et corrigée pour la messagerie interne (cf.
-- 20260722010000_messagerie_interne_fix_recursion.sql), même solution : des
-- fonctions SECURITY DEFINER qui contournent RLS pour casser la boucle d'évaluation.
-- Migration additive (DROP+CREATE nécessaire pour remplacer des policies existantes).

create or replace function public.est_membre_actif_cercle(p_cercle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.cercles_membres m
    join public.beneficiaires b on b.id = m.beneficiaire_id
    where m.cercle_id = p_cercle_id and b.profile_id = auth.uid() and m.statut = 'actif'
  );
$$;

create or replace function public.organisation_du_cercle(p_cercle_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from public.cercles_apprentissage where id = p_cercle_id;
$$;

drop policy if exists cercles_apprentissage_select on public.cercles_apprentissage;
create policy cercles_apprentissage_select on public.cercles_apprentissage for select using (
  public.is_fondateur()
  or public.peut_lire('cercles_apprentissage', organisation_id)
  or public.est_membre_actif_cercle(id)
);

drop policy if exists cercles_membres_select on public.cercles_membres;
create policy cercles_membres_select on public.cercles_membres for select using (
  public.is_fondateur()
  or public.peut_lire('cercles_membres', public.organisation_du_cercle(cercle_id))
  or exists (select 1 from public.beneficiaires b where b.id = cercles_membres.beneficiaire_id and b.profile_id = auth.uid())
  or public.est_membre_actif_cercle(cercle_id)
);

drop policy if exists cercles_membres_insert on public.cercles_membres;
create policy cercles_membres_insert on public.cercles_membres for insert with check (
  public.is_fondateur()
  or public.peut_creer('cercles_membres', public.organisation_du_cercle(cercle_id))
);

drop policy if exists cercles_membres_update on public.cercles_membres;
create policy cercles_membres_update on public.cercles_membres for update using (
  public.is_fondateur()
  or public.peut_modifier('cercles_membres', public.organisation_du_cercle(cercle_id))
  or exists (select 1 from public.beneficiaires b where b.id = cercles_membres.beneficiaire_id and b.profile_id = auth.uid())
);
