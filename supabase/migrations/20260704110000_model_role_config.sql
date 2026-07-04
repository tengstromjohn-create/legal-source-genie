-- Sprint 1, block 2: abstraktionslager för modellroller.
-- Konfigtabell som mappar roll → provider, modell och promptversion.
-- Edge functions läser senaste raden per roll där active_from <= now();
-- modellbyte görs genom att lägga till en ny rad — ingen koddeploy.

create table if not exists public.model_role_config (
  id uuid primary key default gen_random_uuid(),
  role text not null
    check (role in ('extractor','reviewer','arbiter','classifier','responder')),
  provider text not null
    check (provider in ('anthropic','openai')),
  model text not null,
  prompt_version text not null default 'v1',
  active_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.model_role_config is
  'Modellval per roll i QA-pipelinen. Senaste rad per roll (active_from <= now()) gäller.';

create index if not exists model_role_config_role_active_idx
  on public.model_role_config (role, active_from desc);

-- Endast service role (edge functions) ska läsa tabellen: RLS på utan policyer.
alter table public.model_role_config enable row level security;

-- Initial matris enligt utvecklingsplanen rev. 2026-07-03.
-- Modellsträngar verifierade mot docs.claude.com och developers.openai.com 2026-07-04.
insert into public.model_role_config (role, provider, model, prompt_version) values
  ('extractor',  'anthropic', 'claude-sonnet-5',           'v1'),
  ('reviewer',   'openai',    'gpt-5.5',                   'v1'),
  ('arbiter',    'anthropic', 'claude-opus-4-8',           'v1'),
  ('classifier', 'anthropic', 'claude-haiku-4-5-20251001', 'v1'),
  ('responder',  'anthropic', 'claude-sonnet-5',           'v1');
