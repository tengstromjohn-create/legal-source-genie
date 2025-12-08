-- Clean up duplicate/old policies on workspace_member
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_member;
DROP POLICY IF EXISTS "Workspace owners can remove members" ON public.workspace_member;
DROP POLICY IF EXISTS "Workspace owners/admins can add members" ON public.workspace_member;