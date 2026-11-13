-- Comment moderation settings (singleton).

CREATE TABLE IF NOT EXISTS public.comment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  min_length integer NOT NULL DEFAULT 2
    CHECK (min_length BETWEEN 1 AND 200),
  max_length integer NOT NULL DEFAULT 4000
    CHECK (max_length BETWEEN 50 AND 10000),
  max_links integer NOT NULL DEFAULT 3
    CHECK (max_links BETWEEN 0 AND 20),
  require_approval boolean NOT NULL DEFAULT true,
  auto_flag_profanity boolean NOT NULL DEFAULT true,
  auto_spam_phrases boolean NOT NULL DEFAULT true,
  banned_words text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.comment_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.comment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read comment settings" ON public.comment_settings;
CREATE POLICY "public read comment settings"
ON public.comment_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "staff update comment settings" ON public.comment_settings;
CREATE POLICY "staff update comment settings"
ON public.comment_settings FOR UPDATE TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'comments:moderate'))
WITH CHECK (app_hidden.has_permission(auth.uid(), 'comments:moderate'));

GRANT SELECT ON public.comment_settings TO anon, authenticated;
GRANT UPDATE ON public.comment_settings TO authenticated;
GRANT ALL ON public.comment_settings TO service_role;
