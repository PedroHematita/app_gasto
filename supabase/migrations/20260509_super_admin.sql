-- =============================================================
-- Migration: Super Admin Role and Panel support
-- Creates system_admins table, adds RLS bypass for admins,
-- and creates SECURITY DEFINER functions to query auth.users.
-- =============================================================

-- 1. Create system_admins table
CREATE TABLE IF NOT EXISTS public.system_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on system_admins
ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- Allow users to check if they are admins (only see their own record)
CREATE POLICY "Users can check their own admin status"
  ON public.system_admins FOR SELECT
  USING (user_id = auth.uid());

-- 2. Add Super Admin policies to organizacoes
-- Note: Policies are additive (OR logic). Admins get ALL access.

CREATE POLICY "Super Admins can SELECT orgs"
  ON public.organizacoes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can INSERT orgs"
  ON public.organizacoes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can UPDATE orgs"
  ON public.organizacoes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can DELETE orgs"
  ON public.organizacoes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

-- 3. Add Super Admin policies to organizacao_membros

CREATE POLICY "Super Admins can SELECT memberships"
  ON public.organizacao_membros FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can INSERT memberships"
  ON public.organizacao_membros FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can UPDATE memberships"
  ON public.organizacao_membros FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

CREATE POLICY "Super Admins can DELETE memberships"
  ON public.organizacao_membros FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()));

-- 4. Create RPC functions with SECURITY DEFINER to bypass RLS and read auth.users

-- Get all users
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  id uuid,
  email varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify caller is a super admin
  IF NOT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. User is not a Super Admin.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- Search user by exact email
CREATE OR REPLACE FUNCTION public.admin_search_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email varchar,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify caller is a super admin
  IF NOT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. User is not a Super Admin.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM auth.users u
  WHERE u.email = p_email
  LIMIT 1;
END;
$$;
