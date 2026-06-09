-- pgvector-operatorerna (<->) ligger i schemat extensions. search_path för
-- match_legal_sources måste inkludera det, annars felar vektorsökningen med
-- "operator does not exist: vector <-> vector". Regression från fas 0.1 där
-- search_path sattes till enbart public.
ALTER FUNCTION public.match_legal_sources(vector, integer)
  SET search_path = public, extensions;
