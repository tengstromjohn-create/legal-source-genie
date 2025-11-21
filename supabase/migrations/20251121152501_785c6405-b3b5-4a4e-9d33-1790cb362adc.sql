-- Fix security warning: Set search_path on match_legal_sources function
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
SET search_path = public
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