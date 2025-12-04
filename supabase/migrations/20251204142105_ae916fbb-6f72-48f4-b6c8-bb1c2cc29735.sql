-- Create workspace table
CREATE TABLE public.workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workspace_members junction table for multi-user workspaces
CREATE TABLE public.workspace_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Add workspace_id to legal_source
ALTER TABLE public.legal_source 
ADD COLUMN workspace_id UUID REFERENCES public.workspace(id) ON DELETE CASCADE;

-- Add workspace_id to requirement (through legal_source relationship, but also direct for easier querying)
ALTER TABLE public.requirement
ADD COLUMN workspace_id UUID REFERENCES public.workspace(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member ENABLE ROW LEVEL SECURITY;

-- Workspace policies: users can see workspaces they are members of
CREATE POLICY "Users can view their workspaces"
ON public.workspace FOR SELECT
USING (
  owner_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workspace_member 
    WHERE workspace_member.workspace_id = workspace.id 
    AND workspace_member.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create workspaces"
ON public.workspace FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their workspaces"
ON public.workspace FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their workspaces"
ON public.workspace FOR DELETE
USING (owner_id = auth.uid());

-- Workspace member policies
CREATE POLICY "Members can view workspace members"
ON public.workspace_member FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workspace_member wm
    WHERE wm.workspace_id = workspace_member.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners/admins can add members"
ON public.workspace_member FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.workspace_member wm
    WHERE wm.workspace_id = workspace_member.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Workspace owners can remove members"
ON public.workspace_member FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  )
);

-- Update legal_source policies to include workspace filtering
DROP POLICY IF EXISTS "Authenticated users can view legal sources" ON public.legal_source;
CREATE POLICY "Users can view legal sources in their workspaces"
ON public.legal_source FOR SELECT
USING (
  workspace_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = legal_source.workspace_id AND w.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.workspace_member wm
    WHERE wm.workspace_id = legal_source.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Update requirement policies to include workspace filtering
DROP POLICY IF EXISTS "Authenticated users can view requirements" ON public.requirement;
CREATE POLICY "Users can view requirements in their workspaces"
ON public.requirement FOR SELECT
USING (
  workspace_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.workspace w
    WHERE w.id = requirement.workspace_id AND w.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.workspace_member wm
    WHERE wm.workspace_id = requirement.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Trigger for updated_at on workspace
CREATE TRIGGER update_workspace_updated_at
BEFORE UPDATE ON public.workspace
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create default workspace for new users
CREATE OR REPLACE FUNCTION public.create_default_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create default workspace for new user
  INSERT INTO public.workspace (name, owner_id)
  VALUES ('Min arbetsyta', NEW.id)
  RETURNING id INTO new_workspace_id;
  
  -- Add user as owner member
  INSERT INTO public.workspace_member (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Trigger to create default workspace on user signup
CREATE TRIGGER on_auth_user_created_workspace
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_workspace();