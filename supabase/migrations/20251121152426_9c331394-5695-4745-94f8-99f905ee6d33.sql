-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to legal_source table
ALTER TABLE public.legal_source 
ADD COLUMN embedding vector(1536);

-- Create index for faster similarity searches
CREATE INDEX ON public.legal_source USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add function to search by similarity
CREATE OR REPLACE FUNCTION match_legal_sources(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  regelverk_name text,
  lagrum text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    legal_source.id,
    legal_source.title,
    legal_source.content,
    legal_source.regelverk_name,
    legal_source.lagrum,
    1 - (legal_source.embedding <=> query_embedding) as similarity
  FROM legal_source
  WHERE legal_source.embedding IS NOT NULL
    AND 1 - (legal_source.embedding <=> query_embedding) > match_threshold
  ORDER BY legal_source.embedding <=> query_embedding
  LIMIT match_count;
$$;