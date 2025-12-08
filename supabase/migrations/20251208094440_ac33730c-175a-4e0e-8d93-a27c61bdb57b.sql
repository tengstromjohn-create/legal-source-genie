-- 1. Create a SECURITY DEFINER function to check workspace membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_member
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
  )
$$;

-- 2. Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_member;

-- 3. Create a new policy that doesn't cause recursion
-- Users can view their own membership records directly
CREATE POLICY "Users can view own memberships"
ON public.workspace_member
FOR SELECT
USING (user_id = auth.uid());

-- 4. Also fix any policies on workspace_member for INSERT/UPDATE/DELETE if they have similar issues
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_member;

-- Owners can manage members (using security definer function on workspace table)
CREATE POLICY "Workspace owners can manage members"
ON public.workspace_member
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = workspace_id
      AND w.owner_id = auth.uid()
  )
);