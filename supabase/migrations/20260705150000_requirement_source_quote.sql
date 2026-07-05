-- Källcitat-tvång (beslut 2026-07-05, plan 0.7): varje AI-genererat krav bär
-- ett ordagrant citat ur källtexten, maskinverifierat mot paragrafindexet.
alter table public.requirement
  add column if not exists source_quote text;

comment on column public.requirement.source_quote is
  'Ordagrant citat ur källtexten som kravet bygger på. Maskinverifierat mot source_provision; overifierbart citat flaggas i reviewer_flags.';
