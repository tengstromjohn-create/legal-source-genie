-- Lagra chunkens text så att en separat worker-funktion kan bearbeta en chunk
-- i taget (chunk-för-chunk-pipeline som skalar till stora dokument).
ALTER TABLE public.extraction_chunk
  ADD COLUMN IF NOT EXISTS chunk_text text;
