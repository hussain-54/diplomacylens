-- Media content-hash duplicates + public comment reports.

-- ============ MEDIA content hash ============
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS media_assets_content_hash_idx
  ON public.media_assets (content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.media_settings
  ADD COLUMN IF NOT EXISTS detect_duplicates boolean NOT NULL DEFAULT true;

-- ============ COMMENT REPORTS ============
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reporter_name text,
  reporter_email text,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comment_reports_open_idx
  ON public.comment_reports (created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS comment_reports_comment_idx
  ON public.comment_reports (comment_id, created_at DESC);

ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public insert comment reports" ON public.comment_reports;
CREATE POLICY "public insert comment reports"
ON public.comment_reports FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.comments c
    WHERE c.id = comment_id AND c.status = 'approved'
  )
);

DROP POLICY IF EXISTS "staff read comment reports" ON public.comment_reports;
CREATE POLICY "staff read comment reports"
ON public.comment_reports FOR SELECT TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'comments:moderate'));

DROP POLICY IF EXISTS "staff update comment reports" ON public.comment_reports;
CREATE POLICY "staff update comment reports"
ON public.comment_reports FOR UPDATE TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'comments:moderate'))
WITH CHECK (app_hidden.has_permission(auth.uid(), 'comments:moderate'));

DROP POLICY IF EXISTS "staff delete comment reports" ON public.comment_reports;
CREATE POLICY "staff delete comment reports"
ON public.comment_reports FOR DELETE TO authenticated
USING (app_hidden.has_permission(auth.uid(), 'comments:moderate'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reports TO authenticated;
GRANT INSERT ON public.comment_reports TO anon;
GRANT ALL ON public.comment_reports TO service_role;
