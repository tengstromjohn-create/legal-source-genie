-- ============================================================
-- Legal Source Genie — Fas 0.3: Jobbkö för chunkad kravextraktion
-- Projekt: legal-requirements (cjsylpdtltlpcvissawu)
-- Datum: 2026-06-07
-- Körs efter Johns godkännande.
-- ============================================================

-- 1. Paragrafreferens på krav (saknades — själva kärnan i extraktionen).
ALTER TABLE public.requirement
  ADD COLUMN IF NOT EXISTS lagrum TEXT;

-- 2. Jobbtabell: ett extraktionsjobb per legal_source.
CREATE TABLE IF NOT EXISTS public.extraction_job (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_source_id bigint NOT NULL REFERENCES public.legal_source(id) ON DELETE CASCADE,
  workspace_id    uuid REFERENCES public.workspace(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
  model           text,                       -- vilken modell/roll som körde extraktionen
  total_chunks    integer NOT NULL DEFAULT 0,
  processed_chunks integer NOT NULL DEFAULT 0,
  requirements_found integer NOT NULL DEFAULT 0,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. Chunktabell: status per textsegment, ger spårbarhet och återstart.
CREATE TABLE IF NOT EXISTS public.extraction_chunk (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.extraction_job(id) ON DELETE CASCADE,
  chunk_index     integer NOT NULL,
  lagrum_ref      text,                        -- t.ex. "3 kap. 1 § – 3 kap. 9 §"
  char_start      integer,
  char_end        integer,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed')),
  requirements_found integer NOT NULL DEFAULT 0,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_extraction_job_source ON public.extraction_job(legal_source_id);
CREATE INDEX IF NOT EXISTS idx_extraction_chunk_job ON public.extraction_chunk(job_id);

-- 4. updated_at-trigger på jobbtabellen.
DROP TRIGGER IF EXISTS trg_extraction_job_updated ON public.extraction_job;
CREATE TRIGGER trg_extraction_job_updated
  BEFORE UPDATE ON public.extraction_job
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RLS: läsning för workspace-medlemmar, skrivning sker via service role
--    (edge functions) som kringgår RLS.
ALTER TABLE public.extraction_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_chunk ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view extraction jobs"
  ON public.extraction_job FOR SELECT
  USING (workspace_id IS NULL OR user_can_access_workspace(workspace_id));

CREATE POLICY "Workspace members can view extraction chunks"
  ON public.extraction_chunk FOR SELECT
  USING (job_id IN (
    SELECT id FROM public.extraction_job
    WHERE workspace_id IS NULL OR user_can_access_workspace(workspace_id)
  ));

-- OBS: ingen unik (källa, lagrum)-begränsning — en paragraf kan rymma flera
-- krav. Dedupe av överlappande chunkar sker i applikationslogiken
-- (på lagrum + titel) innan insert.
