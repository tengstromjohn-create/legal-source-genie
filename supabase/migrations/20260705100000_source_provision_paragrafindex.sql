-- Sprint 1, nytt block (audit 2026-07-05): paragrafindex som systemets facit.
-- Segmenteraren fyller tabellen vid extraktion; kravens paragrafhänvisningar
-- verifieras deterministiskt mot indexet innan de får finnas.

create table if not exists public.source_provision (
  id bigint generated always as identity primary key,
  legal_source_id bigint not null references public.legal_source(id) on delete cascade,
  kapitel text,
  paragraf text not null,
  label text not null,
  heading text,
  text text not null,
  char_start integer not null,
  char_end integer not null,
  created_at timestamptz not null default now(),
  unique (legal_source_id, label)
);

comment on table public.source_provision is
  'Paragrafindex: kanonisk enhet (kapitel+paragraf) per källa. Facit för grundningskontroller.';

create index if not exists source_provision_source_idx
  on public.source_provision (legal_source_id);

alter table public.source_provision enable row level security;

-- Läsning för alla som får se källan (juristens drill-down); skrivning endast service role.
create policy "Users can view provisions of accessible sources"
  on public.source_provision for select
  using (exists (
    select 1 from public.legal_source s
    where s.id = source_provision.legal_source_id
      and (s.workspace_id is null or user_can_access_workspace(s.workspace_id))
  ));

-- Proveniens på kraven: vilken chunk och vilken kanonisk paragraf kravet hör till.
alter table public.requirement
  add column if not exists chunk_id uuid references public.extraction_chunk(id) on delete set null,
  add column if not exists provision_id bigint references public.source_provision(id) on delete set null;

create index if not exists requirement_provision_idx on public.requirement (provision_id);
