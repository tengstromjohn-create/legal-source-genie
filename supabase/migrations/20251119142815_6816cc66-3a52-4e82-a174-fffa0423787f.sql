-- Add new columns to legal_source table
ALTER TABLE public.legal_source 
ADD COLUMN IF NOT EXISTS regelverk_name TEXT,
ADD COLUMN IF NOT EXISTS lagrum TEXT,
ADD COLUMN IF NOT EXISTS typ TEXT,
ADD COLUMN IF NOT EXISTS referens TEXT,
ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Migrate existing data
UPDATE public.legal_source 
SET full_text = content 
WHERE full_text IS NULL;

-- Add new columns to requirement table
ALTER TABLE public.requirement 
ADD COLUMN IF NOT EXISTS titel TEXT,
ADD COLUMN IF NOT EXISTS beskrivning TEXT,
ADD COLUMN IF NOT EXISTS obligation TEXT,
ADD COLUMN IF NOT EXISTS risknivå TEXT,
ADD COLUMN IF NOT EXISTS subjekt JSONB,
ADD COLUMN IF NOT EXISTS trigger JSONB,
ADD COLUMN IF NOT EXISTS undantag JSONB,
ADD COLUMN IF NOT EXISTS åtgärder JSONB,
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'user';

-- Migrate existing data
UPDATE public.requirement 
SET titel = title,
    beskrivning = description
WHERE titel IS NULL;