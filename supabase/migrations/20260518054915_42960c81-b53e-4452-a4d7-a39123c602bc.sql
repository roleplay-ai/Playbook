
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS ai_bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clarity text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS commitment text NOT NULL DEFAULT '';
