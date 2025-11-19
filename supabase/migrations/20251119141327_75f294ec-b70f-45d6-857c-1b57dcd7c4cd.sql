-- Create legal_source table
CREATE TABLE public.legal_source (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create requirement table
CREATE TABLE public.requirement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_source_id UUID NOT NULL REFERENCES public.legal_source(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.legal_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since no user_id column)
CREATE POLICY "Anyone can view legal sources"
  ON public.legal_source
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create legal sources"
  ON public.legal_source
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update legal sources"
  ON public.legal_source
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete legal sources"
  ON public.legal_source
  FOR DELETE
  USING (true);

CREATE POLICY "Anyone can view requirements"
  ON public.requirement
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create requirements"
  ON public.requirement
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update requirements"
  ON public.requirement
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete requirements"
  ON public.requirement
  FOR DELETE
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_legal_source_updated_at
  BEFORE UPDATE ON public.legal_source
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_requirement_legal_source_id ON public.requirement(legal_source_id);