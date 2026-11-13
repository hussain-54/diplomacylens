-- Publisher attribution + multi-image gallery for articles.
-- Backward compatible: existing hero_image_url and author_id continue to work.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS publisher_name text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.articles.publisher_name IS
  'Denormalized publisher display name snapshot (byline_name or name at last save).';
COMMENT ON COLUMN public.articles.author_id IS
  'Publisher profile id (authenticated user who created/owns the article).';

-- Backfill publisher_name from linked profile when missing.
UPDATE public.articles a
SET publisher_name = COALESCE(
  NULLIF(trim(p.byline_name), ''),
  NULLIF(trim(p.name), ''),
  'Admin'
)
FROM public.profiles p
WHERE a.author_id = p.id
  AND (a.publisher_name IS NULL OR trim(a.publisher_name) = '');

UPDATE public.articles
SET publisher_name = 'Admin'
WHERE publisher_name IS NULL OR trim(publisher_name) = '';

UPDATE public.articles
SET created_by = author_id
WHERE created_by IS NULL AND author_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.article_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  image_url text NOT NULL CHECK (char_length(trim(image_url)) > 0),
  caption text,
  alt_text text,
  display_order integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS article_images_article_order_idx
  ON public.article_images (article_id, display_order);

CREATE INDEX IF NOT EXISTS article_images_article_featured_idx
  ON public.article_images (article_id)
  WHERE is_featured = true;

ALTER TABLE public.article_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "article_images public read published" ON public.article_images;
CREATE POLICY "article_images public read published"
  ON public.article_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_images.article_id
        AND a.status = 'published'
        AND a.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "article_images staff write" ON public.article_images;
CREATE POLICY "article_images staff write"
  ON public.article_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.article_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.article_images TO authenticated;
GRANT ALL ON public.article_images TO service_role;

-- Seed featured images into article_images for articles that only have hero_image_url.
INSERT INTO public.article_images (article_id, image_url, alt_text, caption, display_order, is_featured)
SELECT
  a.id,
  a.hero_image_url,
  COALESCE(NULLIF(trim(a.cms_extras #>> '{media,alt_text}'), ''), a.title),
  NULLIF(trim(a.cms_extras #>> '{media,caption}'), ''),
  0,
  true
FROM public.articles a
WHERE a.hero_image_url IS NOT NULL
  AND trim(a.hero_image_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.article_images ai
    WHERE ai.article_id = a.id AND ai.is_featured = true
  );
