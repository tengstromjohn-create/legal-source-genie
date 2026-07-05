-- Juristbesluten loggas som eget spår (grund för eval_case/kalibreringsloop R1).
-- Varje godkännande/avslag fryser kravets läge vid beslutet.
create table if not exists public.review_decision (
  id bigint generated always as identity primary key,
  requirement_id bigint not null references public.requirement(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected','edited_approved')),
  note text,
  reviewer uuid,
  flags_at_decision text[],
  source_quote_at_decision text,
  lagrum_at_decision text,
  created_at timestamptz not null default now()
);

comment on table public.review_decision is
  'Juristbeslut per krav med fryst kontext — grunden för golden dataset och konfidenkalibrering.';

create index if not exists review_decision_requirement_idx
  on public.review_decision (requirement_id);

alter table public.review_decision enable row level security;

create policy "Workspace members can log decisions"
  on public.review_decision for insert to authenticated
  with check (exists (
    select 1 from public.requirement r
    where r.id = review_decision.requirement_id
      and (r.workspace_id is null or user_can_access_workspace(r.workspace_id))
  ));

create policy "Workspace members can view decisions"
  on public.review_decision for select
  using (exists (
    select 1 from public.requirement r
    where r.id = review_decision.requirement_id
      and (r.workspace_id is null or user_can_access_workspace(r.workspace_id))
  ));
