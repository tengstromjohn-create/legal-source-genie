-- ============================================================
-- Block 5 — steg 3–4 i granskningskedjan (audit 2026-07-05):
-- två blinda oberoende AI-granskare + arbiter vid oenighet.
-- Icke-destruktiv: endast nya kolumner, ny konfigrad och vidgade
-- check-constraints. Körs efter Johns godkännande.
-- ============================================================

-- 1. Konfigtabellen: ny provider (google/Gemini) och ny roll (reviewer_b).
--    Beslut 12 i utvecklingsplanen rev. 2026-07-03: granskare B ur tredje
--    modellfamilj för maximalt oberoende (begränsning #6, korrelerade fel).
alter table public.model_role_config
  drop constraint if exists model_role_config_role_check;
alter table public.model_role_config
  drop constraint if exists model_role_config_provider_check;
alter table public.model_role_config
  add constraint model_role_config_role_check
    check (role in ('extractor','reviewer','reviewer_b','arbiter','classifier','responder'));
alter table public.model_role_config
  add constraint model_role_config_provider_check
    check (provider in ('anthropic','openai','google'));

-- Seed: gemini-3.5-flash är GA (verifierad mot ai.google.dev 2026-07-05;
-- alias gemini-flash-latest). Pro-nivån finns endast som preview och undviks
-- per R7 (pinnade stabila versioner). Omprövas empiriskt via golden dataset.
insert into public.model_role_config (role, provider, model, prompt_version)
values ('reviewer_b', 'google', 'gemini-3.5-flash', 'v1');

-- 2. model_verdict: reviewer_b som giltig roll samt fullt drill-down-spår
--    (nivå 3 i juristvyn) och reproducerbarhet (begränsning #8 — compliance-
--    krav, inte debug-bekvämlighet).
alter table public.model_verdict
  drop constraint if exists model_verdict_role_check;
alter table public.model_verdict
  add constraint model_verdict_role_check
    check (role in ('extractor','reviewer','reviewer_b','arbiter'));

alter table public.model_verdict
  add column if not exists prompt_version text,
  add column if not exists raw_response text,
  add column if not exists latency_ms integer,
  add column if not exists input_provision_id bigint
    references public.source_provision(id) on delete set null;

comment on column public.model_verdict.raw_response is
  'Modellens fullständiga råsvar. Reproducerbarhetsspår för drill-down nivå 3 (audit 2026-07-05, begränsning #8).';
comment on column public.model_verdict.input_provision_id is
  'Den kanoniska paragraf (source_provision) som bedömningen gjordes mot — aldrig chunken.';

-- 3. Sammanvägd maskinstatus per krav (steg 4:s utfall).
--    pending → processing → green (eniga granskare) / yellow (arbitern
--    godkände efter oenighet) / red (underkänt eller ogranskningsbart).
alter table public.requirement
  add column if not exists machine_review_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'requirement_machine_review_status_check'
  ) then
    alter table public.requirement
      add constraint requirement_machine_review_status_check
      check (machine_review_status in ('pending','processing','green','yellow','red'));
  end if;
end $$;

comment on column public.requirement.machine_review_status is
  'Sammanvägt utfall av AI-granskningskedjan steg 3–4. Juristbeslutet ligger i status/review_decision — detta fält styr köprioritering.';

create index if not exists requirement_machine_status_idx
  on public.requirement (machine_review_status)
  where machine_review_status in ('pending','processing');
