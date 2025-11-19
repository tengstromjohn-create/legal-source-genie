-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  -- Assign 'user' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update RLS policies for legal_source table
DROP POLICY IF EXISTS "Anyone can create legal sources" ON public.legal_source;
DROP POLICY IF EXISTS "Anyone can delete legal sources" ON public.legal_source;
DROP POLICY IF EXISTS "Anyone can update legal sources" ON public.legal_source;
DROP POLICY IF EXISTS "Anyone can view legal sources" ON public.legal_source;

-- New secure policies for legal_source
CREATE POLICY "Authenticated users can view legal sources"
  ON public.legal_source FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create legal sources"
  ON public.legal_source FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update legal sources"
  ON public.legal_source FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete legal sources"
  ON public.legal_source FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for requirement table
DROP POLICY IF EXISTS "Anyone can create requirements" ON public.requirement;
DROP POLICY IF EXISTS "Anyone can delete requirements" ON public.requirement;
DROP POLICY IF EXISTS "Anyone can update requirements" ON public.requirement;
DROP POLICY IF EXISTS "Anyone can view requirements" ON public.requirement;

-- New secure policies for requirement
CREATE POLICY "Authenticated users can view requirements"
  ON public.requirement FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create requirements"
  ON public.requirement FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update requirements"
  ON public.requirement FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete requirements"
  ON public.requirement FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));