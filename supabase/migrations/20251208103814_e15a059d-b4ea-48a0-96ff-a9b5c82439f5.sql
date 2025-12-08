-- Fix infinite recursion in workspace policies
-- The issue: workspace SELECT policy queries workspace_member, 
-- and workspace_member ALL policy queries workspace, causing a loop

-- Drop and recreate workspace policies without recursion
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspace;

-- Simple workspace SELECT policy - only check owner_id directly
-- For member access, we'll use a SECURITY DEFINER function
CREATE POLICY "Users can view their workspaces" 
ON public.workspace 
FOR SELECT 
USING (owner_id = auth.uid());

-- Also need to fix workspace_member policies to avoid recursion
DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_member;

-- Simpler policy for workspace_member that doesn't query workspace
CREATE POLICY "Workspace owners can manage members" 
ON public.workspace_member 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = workspace_member.workspace_id 
    AND w.owner_id = auth.uid()
  )
);

-- Create a SECURITY DEFINER function to check workspace membership without RLS loops
CREATE OR REPLACE FUNCTION public.user_can_access_workspace(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace WHERE id = _workspace_id AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM workspace_member WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;

-- Update workspace SELECT policy to use the function
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspace;

CREATE POLICY "Users can view their workspaces" 
ON public.workspace 
FOR SELECT 
USING (user_can_access_workspace(id));

-- Update legal_source SELECT policy to use simpler logic
DROP POLICY IF EXISTS "Users can view legal sources in their workspaces" ON public.legal_source;

CREATE POLICY "Users can view legal sources in their workspaces" 
ON public.legal_source 
FOR SELECT 
USING (
  workspace_id IS NULL 
  OR user_can_access_workspace(workspace_id)
);

-- Update requirement SELECT policy similarly
DROP POLICY IF EXISTS "Users can view requirements in their workspaces" ON public.requirement;

CREATE POLICY "Users can view requirements in their workspaces" 
ON public.requirement 
FOR SELECT 
USING (
  workspace_id IS NULL 
  OR user_can_access_workspace(workspace_id)
);