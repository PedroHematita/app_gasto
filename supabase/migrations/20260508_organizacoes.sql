-- =============================================================
-- Migration: Multi-tenant organization support
-- Creates org tables, adds org_id to data tables, migrates data,
-- and rewrites RLS policies for org-based access control.
-- =============================================================

-- 1. Create organization tables

CREATE TABLE IF NOT EXISTS public.organizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizacao_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS organizacao_membros_user_idx
  ON public.organizacao_membros(user_id);
CREATE INDEX IF NOT EXISTS organizacao_membros_org_idx
  ON public.organizacao_membros(org_id);

-- 2. Add org_id columns (nullable initially for migration)

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizacoes(id);

ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizacoes(id);

ALTER TABLE public.gastos_perenes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizacoes(id);

-- 3. Migrate existing data: create one org per distinct user_id

DO $$
DECLARE
  rec RECORD;
  new_org_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.gastos
      UNION
      SELECT user_id FROM public.compromissos
      UNION
      SELECT user_id FROM public.gastos_perenes
    ) all_users
  LOOP
    INSERT INTO public.organizacoes (nome)
    VALUES ('Minha Empresa')
    RETURNING id INTO new_org_id;

    INSERT INTO public.organizacao_membros (org_id, user_id, role)
    VALUES (new_org_id, rec.user_id, 'owner');

    UPDATE public.gastos
      SET org_id = new_org_id
      WHERE user_id = rec.user_id AND org_id IS NULL;

    UPDATE public.compromissos
      SET org_id = new_org_id
      WHERE user_id = rec.user_id AND org_id IS NULL;

    UPDATE public.gastos_perenes
      SET org_id = new_org_id
      WHERE user_id = rec.user_id AND org_id IS NULL;
  END LOOP;
END $$;

-- 4. Make org_id NOT NULL

ALTER TABLE public.gastos ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.compromissos ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.gastos_perenes ALTER COLUMN org_id SET NOT NULL;

-- 5. Create indexes on org_id

CREATE INDEX IF NOT EXISTS gastos_org_idx ON public.gastos(org_id);
CREATE INDEX IF NOT EXISTS compromissos_org_idx ON public.compromissos(org_id);
CREATE INDEX IF NOT EXISTS gastos_perenes_org_idx ON public.gastos_perenes(org_id);

-- 6. RLS on new tables

ALTER TABLE public.organizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizacao_membros ENABLE ROW LEVEL SECURITY;

-- organizacoes: users see orgs they belong to
DROP POLICY IF EXISTS "Users see own orgs" ON public.organizacoes;
CREATE POLICY "Users see own orgs"
  ON public.organizacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = id AND om.user_id = auth.uid()
    )
  );

-- organizacoes: any authenticated user can create
DROP POLICY IF EXISTS "Authenticated users create orgs" ON public.organizacoes;
CREATE POLICY "Authenticated users create orgs"
  ON public.organizacoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- organizacoes: owners can update
DROP POLICY IF EXISTS "Owners update orgs" ON public.organizacoes;
CREATE POLICY "Owners update orgs"
  ON public.organizacoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = id AND om.user_id = auth.uid() AND om.role = 'owner'
    )
  );

-- organizacao_membros: users see memberships of their orgs
DROP POLICY IF EXISTS "Users see org memberships" ON public.organizacao_membros;
CREATE POLICY "Users see org memberships"
  ON public.organizacao_membros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om2
      WHERE om2.org_id = org_id AND om2.user_id = auth.uid()
    )
  );

-- organizacao_membros: users can insert their own membership
DROP POLICY IF EXISTS "Users insert own membership" ON public.organizacao_membros;
CREATE POLICY "Users insert own membership"
  ON public.organizacao_membros FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 7. Rewrite RLS policies on data tables (org-based)

-- Enable RLS on gastos/itens_gasto if not already enabled
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_gasto ENABLE ROW LEVEL SECURITY;

-- gastos: drop old user-based policy, create org-based
DROP POLICY IF EXISTS "Users manage own gastos" ON public.gastos;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.gastos;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.gastos;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.gastos;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.gastos;
DROP POLICY IF EXISTS "Org members manage gastos" ON public.gastos;
CREATE POLICY "Org members manage gastos"
  ON public.gastos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = gastos.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = gastos.org_id AND om.user_id = auth.uid()
    )
  );

-- itens_gasto: drop old policy, create org-based via join
DROP POLICY IF EXISTS "Users manage own itens_gasto" ON public.itens_gasto;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.itens_gasto;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.itens_gasto;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.itens_gasto;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.itens_gasto;
DROP POLICY IF EXISTS "Org members manage itens_gasto" ON public.itens_gasto;
CREATE POLICY "Org members manage itens_gasto"
  ON public.itens_gasto FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.gastos g
      JOIN public.organizacao_membros om ON om.org_id = g.org_id
      WHERE g.id = gasto_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gastos g
      JOIN public.organizacao_membros om ON om.org_id = g.org_id
      WHERE g.id = gasto_id AND om.user_id = auth.uid()
    )
  );

-- compromissos: drop old, create org-based
DROP POLICY IF EXISTS "Users manage own compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Org members manage compromissos" ON public.compromissos;
CREATE POLICY "Org members manage compromissos"
  ON public.compromissos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = compromissos.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = compromissos.org_id AND om.user_id = auth.uid()
    )
  );

-- compromisso_itens: drop old, create org-based via join
DROP POLICY IF EXISTS "Users manage compromisso_itens via compromisso" ON public.compromisso_itens;
DROP POLICY IF EXISTS "Org members manage compromisso_itens" ON public.compromisso_itens;
CREATE POLICY "Org members manage compromisso_itens"
  ON public.compromisso_itens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.compromissos c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = compromisso_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.compromissos c
      JOIN public.organizacao_membros om ON om.org_id = c.org_id
      WHERE c.id = compromisso_id AND om.user_id = auth.uid()
    )
  );

-- gastos_perenes: drop old, create org-based
DROP POLICY IF EXISTS "Users manage own gastos_perenes" ON public.gastos_perenes;
DROP POLICY IF EXISTS "Org members manage gastos_perenes" ON public.gastos_perenes;
CREATE POLICY "Org members manage gastos_perenes"
  ON public.gastos_perenes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = gastos_perenes.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizacao_membros om
      WHERE om.org_id = gastos_perenes.org_id AND om.user_id = auth.uid()
    )
  );
