-- Självläkande bearbetning: schemalagd nudge varje minut gör chunk-pipelinen
-- robust även om enskilda edge-invokationer dödas av tidsgränsen.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.nudge_extraction_jobs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, net AS $$
DECLARE j record;
BEGIN
  -- Återställ chunkar som fastnat i 'processing' (jobbet stillastående > 2 min).
  UPDATE public.extraction_chunk c SET status = 'pending'
  FROM public.extraction_job jb
  WHERE c.job_id = jb.id AND c.status = 'processing'
    AND jb.status = 'processing' AND jb.updated_at < now() - interval '2 minutes';

  -- Knuffa jobb med väntande chunkar.
  FOR j IN SELECT DISTINCT jb.id FROM public.extraction_job jb
    WHERE jb.status IN ('pending','processing')
      AND EXISTS (SELECT 1 FROM public.extraction_chunk c WHERE c.job_id = jb.id AND c.status = 'pending')
  LOOP
    PERFORM net.http_post(
      url := 'https://cjsylpdtltlpcvissawu.supabase.co/functions/v1/process-extraction-chunk',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := json_build_object('job_id', j.id)::jsonb
    );
  END LOOP;
END;
$$;

SELECT cron.schedule('lsg-extraction-nudge', '* * * * *', $$SELECT public.nudge_extraction_jobs();$$);
