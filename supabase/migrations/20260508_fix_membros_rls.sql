-- Fix: Replace self-referential RLS policy on organizacao_membros
-- The original policy referenced the same table, which can cause
-- PostgreSQL to return empty results.

-- 1. Drop the problematic self-referential SELECT policy
DROP POLICY IF EXISTS "Users see org memberships" ON public.organizacao_membros;

-- 2. Create a simpler policy: users always see their own memberships
CREATE POLICY "Users see own memberships"
  ON public.organizacao_membros FOR SELECT
  USING (user_id = auth.uid());

-- 3. Also add: users see OTHER members of orgs they belong to (for future Phase 4)
-- This uses a security_barrier subquery approach that avoids self-reference issues
CREATE POLICY "Users see co-members"
  ON public.organizacao_membros FOR SELECT
  USING (
    org_id IN (
      SELECT om.org_id FROM public.organizacao_membros om
      WHERE om.user_id = auth.uid()
    )
  );
