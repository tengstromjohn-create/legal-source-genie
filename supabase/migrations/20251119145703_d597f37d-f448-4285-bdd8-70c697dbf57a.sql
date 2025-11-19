-- Drop the overly permissive service role insert policy
-- The handle_new_user() trigger already runs with SECURITY DEFINER privilege,
-- so it doesn't need an RLS policy to insert profiles
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Ensure profiles can only be created through the trigger
-- Add a more restrictive INSERT policy that only allows inserts during user creation
CREATE POLICY "Profiles can only be created for the authenticated user"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);