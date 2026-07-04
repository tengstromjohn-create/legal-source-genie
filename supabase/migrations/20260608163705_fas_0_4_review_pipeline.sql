-- ============================================================
-- Legal Source Genie — Fas 0.4: Granskning, domslut och juristkö
-- Projekt: legal-requirements (cjsylpdtltlpcvissawu)
-- Datum: 2026-06-07
-- Körs efter Johns godkännande.
-- ============================================================

-- 1. Kravlivscykel: draft -> in_review -> approved/rejected -> archived.
--    Granskningsmetadata för kösortering och spårbarhet.
ALTER TABLE public.requirement
  ADD COLUMN IF NOT EXISTS reviewer_confidence numeric,
  ADD COLUMN IF NOT EXISTS reviewer_flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

-- Säkra giltiga statusvärden (bara om constraint saknas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'requirement_status_check'
  ) THEN
    ALTER TABLE public.requirement
      ADD CONSTRAINT requirement_status_check
      CHECK (status IN ('draft','in_review','approved','rejected','archived'));
  END IF;
END $$;

-- 2. model_verdict: en strukturerad bedömning per modell och krav.
--    Samlar extractor-, reviewer- och (framtida) arbiter-domslut. Grunden
--    för den lärande loopen och precisionsmätning per modell.
CREATE TABLE IF NOT EXISTS public.model_verdict (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id bigint NOT NULL REFERENCES public.requirement(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('extractor','reviewer','arbiter')),
  provider       text,
  model          text,
  agrees         boolean,                 -- instämmer granskaren i kravet?
  confidence     numeric,                 -- 0–1
  issues         text[] DEFAULT '{}',     -- påpekanden
  suggested_lagrum text,                  -- ev. korrigerad paragrafreferens
  raw            jsonb,                   -- fullt modellsvar för spårbarhet
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_verdict_requirement
  ON public.model_verdict(requirement_id);

-- 3. RLS: läsning för workspace-medlemmar via kravets workspace.
ALTER TABLE public.model_verdict ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view verdicts"
  ON public.model_verdict FOR SELECT
  USING (requirement_id IN (
    SELECT id FROM public.requirement
    WHERE workspace_id IS NULL OR user_can_access_workspace(workspace_id)
  ));

-- 4. Jurist kan uppdatera krav i sina workspaces (godkänn/avslå/redigera).
--    Komplement till befintlig admin-policy; båda gäller (permissive OR).
DROP POLICY IF EXISTS "Workspace members can review requirements" ON public.requirement;
CREATE POLICY "Workspace members can review requirements"
  ON public.requirement FOR UPDATE
  USING (workspace_id IS NULL OR user_can_access_workspace(workspace_id))
  WITH CHECK (workspace_id IS NULL OR user_can_access_workspace(workspace_id));

-- 5. Vy för juristkön: krav som väntar på granskning, mest osäkra först.
CREATE OR REPLACE VIEW public.review_queue
WITH (security_invoker = true) AS
SELECT
  r.id, r.legal_source_id, r.workspace_id, r.titel, r.beskrivning, r.lagrum,
  r.risknivå, r.obligation, r.subjekt, r.trigger, r.undantag,
  r.reviewer_confidence, r.reviewer_flags, r.created_at,
  ls.regelverk_name, ls.referens, ls.full_text AS source_full_text
FROM public.requirement r
JOIN public.legal_source ls ON ls.id = r.legal_source_id
WHERE r.status = 'in_review';
