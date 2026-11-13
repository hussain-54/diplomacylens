-- Media management upgrade: soft-delete, metadata, galleries, settings.
-- Builds on 20260718090000_digital_asset_management.sql

-- ============ EXTEND media_assets ============

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS original_object_path text,
  ADD COLUMN IF NOT EXISTS category_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_category_id_fkey'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.sections(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS media_assets_active_created_idx
  ON public.media_assets (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_assets_trash_idx
  ON public.media_assets (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS media_assets_uploader_idx
  ON public.media_assets (uploaded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_category_idx
  ON public.media_assets (category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS media_assets_tags_gin_idx
  ON public.media_assets USING gin (tags);

-- Allow gallery usages
ALTER TABLE public.media_asset_usages
  DROP CONSTRAINT IF EXISTS media_asset_usages_entity_type_check;

ALTER TABLE public.media_asset_usages
  ADD CONSTRAINT media_asset_usages_entity_type_check
  CHECK (entity_type IN ('article', 'ambassador', 'video', 'gallery', 'other'));

-- ============ GALLERIES ============

CREATE TABLE IF NOT EXISTS public.media_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL UNIQUE,
  description text,
  cover_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  gallery_type text NOT NULL DEFAULT 'photo'
    CHECK (gallery_type IN ('photo', 'video', 'album', 'featured')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_galleries_status_idx
  ON public.media_galleries (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_galleries_type_idx
  ON public.media_galleries (gallery_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS media_galleries_slug_idx
  ON public.media_galleries (slug);

CREATE TABLE IF NOT EXISTS public.gallery_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.media_galleries(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  caption_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_media_unique UNIQUE (gallery_id, asset_id)
);

CREATE INDEX IF NOT EXISTS gallery_media_gallery_order_idx
  ON public.gallery_media (gallery_id, sort_order);
CREATE INDEX IF NOT EXISTS gallery_media_asset_idx
  ON public.gallery_media (asset_id);

-- ============ MEDIA SETTINGS (singleton) ============

CREATE TABLE IF NOT EXISTS public.media_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_upload_bytes bigint NOT NULL DEFAULT 52428800
    CHECK (max_upload_bytes > 0 AND max_upload_bytes <= 209715200),
  bulk_upload_limit integer NOT NULL DEFAULT 20
    CHECK (bulk_upload_limit BETWEEN 1 AND 100),
  allowed_image_types text[] NOT NULL DEFAULT ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
  ],
  allowed_video_types text[] NOT NULL DEFAULT ARRAY[
    'video/mp4', 'video/webm', 'video/quicktime'
  ],
  allowed_audio_types text[] NOT NULL DEFAULT ARRAY[
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'
  ],
  allowed_document_types text[] NOT NULL DEFAULT ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  auto_compress boolean NOT NULL DEFAULT true,
  generate_thumbnails boolean NOT NULL DEFAULT true,
  preserve_originals boolean NOT NULL DEFAULT true,
  watermark_images boolean NOT NULL DEFAULT false,
  delete_unused_files boolean NOT NULL DEFAULT false,
  thumbnail_width integer NOT NULL DEFAULT 300 CHECK (thumbnail_width BETWEEN 64 AND 1200),
  thumbnail_height integer NOT NULL DEFAULT 300 CHECK (thumbnail_height BETWEEN 64 AND 1200),
  image_quality integer NOT NULL DEFAULT 80 CHECK (image_quality BETWEEN 40 AND 100),
  default_image_format text NOT NULL DEFAULT 'webp'
    CHECK (default_image_format IN ('webp', 'jpeg', 'original')),
  storage_quota_bytes bigint NOT NULL DEFAULT 536870912000
    CHECK (storage_quota_bytes > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.media_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- ============ RLS ============

ALTER TABLE public.media_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read media galleries" ON public.media_galleries;
CREATE POLICY "staff read media galleries"
ON public.media_galleries FOR SELECT TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'media:view'));

DROP POLICY IF EXISTS "public read published galleries" ON public.media_galleries;
CREATE POLICY "public read published galleries"
ON public.media_galleries FOR SELECT
USING (status = 'published' AND visibility IN ('public', 'unlisted'));

DROP POLICY IF EXISTS "staff manage media galleries" ON public.media_galleries;
CREATE POLICY "staff manage media galleries"
ON public.media_galleries FOR ALL TO authenticated
USING (
  app_hidden.has_permission(auth.uid(), 'media:upload')
  OR app_hidden.has_permission(auth.uid(), 'media:manage_all')
)
WITH CHECK (
  app_hidden.has_permission(auth.uid(), 'media:upload')
  OR app_hidden.has_permission(auth.uid(), 'media:manage_all')
);

DROP POLICY IF EXISTS "staff read gallery media" ON public.gallery_media;
CREATE POLICY "staff read gallery media"
ON public.gallery_media FOR SELECT TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'media:view'));

DROP POLICY IF EXISTS "public read published gallery media" ON public.gallery_media;
CREATE POLICY "public read published gallery media"
ON public.gallery_media FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.media_galleries g
    WHERE g.id = gallery_media.gallery_id
      AND g.status = 'published'
      AND g.visibility IN ('public', 'unlisted')
  )
);

DROP POLICY IF EXISTS "staff manage gallery media" ON public.gallery_media;
CREATE POLICY "staff manage gallery media"
ON public.gallery_media FOR ALL TO authenticated
USING (
  app_hidden.has_permission(auth.uid(), 'media:upload')
  OR app_hidden.has_permission(auth.uid(), 'media:manage_all')
)
WITH CHECK (
  app_hidden.has_permission(auth.uid(), 'media:upload')
  OR app_hidden.has_permission(auth.uid(), 'media:manage_all')
);

DROP POLICY IF EXISTS "staff read media settings" ON public.media_settings;
CREATE POLICY "staff read media settings"
ON public.media_settings FOR SELECT TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'media:view'));

DROP POLICY IF EXISTS "managers update media settings" ON public.media_settings;
CREATE POLICY "managers update media settings"
ON public.media_settings FOR UPDATE TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'media:manage_all'))
WITH CHECK (app_hidden.has_permission(auth.uid(), 'media:manage_all'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_galleries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_media TO authenticated;
GRANT SELECT, UPDATE ON public.media_settings TO authenticated;
GRANT SELECT ON public.media_galleries, public.gallery_media TO anon;
GRANT ALL ON public.media_galleries, public.gallery_media, public.media_settings TO service_role;
