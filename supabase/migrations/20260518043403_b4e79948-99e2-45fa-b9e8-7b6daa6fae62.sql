
create table public.ai_fit_questions (
  id uuid primary key default gen_random_uuid(),
  scenario text not null,
  choice_use_label text not null default 'Use AI',
  choice_partial_label text not null default 'Use AI partially',
  choice_avoid_label text not null default 'Avoid AI',
  correct_answer text not null check (correct_answer in ('use','partial','avoid')),
  rationale text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_fit_questions enable row level security;

create policy ai_fit_questions_select_auth on public.ai_fit_questions
  for select to authenticated using (true);
create policy ai_fit_questions_admin_all on public.ai_fit_questions
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create trigger ai_fit_questions_touch_updated_at
  before update on public.ai_fit_questions
  for each row execute function public.touch_updated_at();

create table public.ai_fit_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid,
  answers jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  total integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ai_fit_attempts enable row level security;

create policy ai_fit_attempts_select_own_or_admin on public.ai_fit_attempts
  for select to authenticated using ((user_id = auth.uid()) or is_admin(auth.uid()));
create policy ai_fit_attempts_insert_own on public.ai_fit_attempts
  for insert to authenticated with check (user_id = auth.uid());
create policy ai_fit_attempts_delete_admin on public.ai_fit_attempts
  for delete to authenticated using (is_admin(auth.uid()));

create index ai_fit_attempts_user_created_idx on public.ai_fit_attempts (user_id, created_at desc);
