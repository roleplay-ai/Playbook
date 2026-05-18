
-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  categories TEXT[] NOT NULL DEFAULT '{}',
  ai_capabilities TEXT[] NOT NULL DEFAULT '{}',
  weekly_hours NUMERIC NOT NULL DEFAULT 0,
  ai_capable TEXT NOT NULL DEFAULT 'yes',
  recommended_tool TEXT,
  how_to TEXT,
  hours_saved NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Commitments
CREATE TABLE public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, position)
);
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

-- Admin check function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false);
$$;

-- RLS: companies
CREATE POLICY "companies_select_authenticated" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS: profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- RLS: activities
CREATE POLICY "activities_select_own_or_admin" ON public.activities
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "activities_insert_own" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "activities_update_own" ON public.activities
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activities_delete_own_or_admin" ON public.activities
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- RLS: commitments
CREATE POLICY "commitments_select_own_or_admin" ON public.commitments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "commitments_insert_own" ON public.commitments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "commitments_update_own" ON public.commitments
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "commitments_delete_own" ON public.commitments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER activities_touch BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed companies
INSERT INTO public.companies (name) VALUES ('Flipkart'), ('ICICI'), ('Demo Co')
ON CONFLICT (name) DO NOTHING;
