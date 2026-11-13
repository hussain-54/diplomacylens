-- Homepage media modules: E-Paper, Podcasts, Infographics + Politics section seed.
-- Safe to re-run; public read, staff write via newsroom roles.

-- Politics category (used by homepage Politics rail)
INSERT INTO public.sections (slug, name, description, sort_order, visibility)
VALUES (
  'politics',
  'Politics',
  'Political reporting, policy analysis, and power dynamics worldwide.',
  25,
  'public'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = COALESCE(public.sections.description, EXCLUDED.description);

CREATE TABLE IF NOT EXISTS public.epaper_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  issue_number text,
  cover_image_url text,
  description text,
  pdf_url text,
  read_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  host text,
  artwork_url text,
  audio_url text,
  external_url text,
  category text,
  duration text,
  transcript text,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.infographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  cover_image_url text,
  source_url text,
  description text,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS epaper_editions_published_idx
  ON public.epaper_editions (published_at DESC);
CREATE INDEX IF NOT EXISTS podcast_episodes_published_idx
  ON public.podcast_episodes (published_at DESC);
CREATE INDEX IF NOT EXISTS infographics_published_idx
  ON public.infographics (published_at DESC);

ALTER TABLE public.epaper_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infographics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "epaper public read" ON public.epaper_editions;
CREATE POLICY "epaper public read" ON public.epaper_editions FOR SELECT USING (true);
DROP POLICY IF EXISTS "epaper staff write" ON public.epaper_editions;
CREATE POLICY "epaper staff write" ON public.epaper_editions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "podcasts public read" ON public.podcast_episodes;
CREATE POLICY "podcasts public read" ON public.podcast_episodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "podcasts staff write" ON public.podcast_episodes;
CREATE POLICY "podcasts staff write" ON public.podcast_episodes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "infographics public read" ON public.infographics;
CREATE POLICY "infographics public read" ON public.infographics FOR SELECT USING (true);
DROP POLICY IF EXISTS "infographics staff write" ON public.infographics;
CREATE POLICY "infographics staff write" ON public.infographics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

GRANT SELECT ON public.epaper_editions, public.podcast_episodes, public.infographics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.epaper_editions, public.podcast_episodes, public.infographics TO authenticated;
GRANT ALL ON public.epaper_editions, public.podcast_episodes, public.infographics TO service_role;
