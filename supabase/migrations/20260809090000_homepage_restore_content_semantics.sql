-- Repair homepage builder section configs so public homepage restores original content semantics.
-- Safe to re-run.

-- Featured Stories: do not require is_featured=true (match original automatic slice).
UPDATE public.homepage_sections
SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{source}', '"automatic"', true)
WHERE section_type = 'featured_news'
  AND COALESCE(config->>'source', '') IN ('', 'featured');

-- Latest News: keep offset but ensure a sensible limit.
UPDATE public.homepage_sections
SET config = COALESCE(config, '{}'::jsonb)
  || jsonb_build_object(
    'source', COALESCE(NULLIF(config->>'source', ''), 'latest'),
    'limit', COALESCE((config->>'limit')::int, 9),
    'offset', COALESCE((config->>'offset')::int, 4)
  )
WHERE section_type = 'latest_news';

-- Politics / category sections: resolve category_id from slug when missing.
UPDATE public.homepage_sections hs
SET config = jsonb_set(
  jsonb_set(
    COALESCE(hs.config, '{}'::jsonb),
    '{category_slug}',
    to_jsonb(COALESCE(NULLIF(hs.config->>'category_slug', ''), 'politics')),
    true
  ),
  '{category_id}',
  to_jsonb(s.id::text),
  true
)
FROM public.sections s
WHERE hs.section_type = 'category_news'
  AND s.slug = COALESCE(NULLIF(hs.config->>'category_slug', ''), 'politics')
  AND (
    hs.config->>'category_id' IS NULL
    OR hs.config->>'category_id' = ''
    OR hs.config->>'category_id' = 'null'
  );

-- Ensure a Breaking News homepage block exists on live + draft versions (alert display).
DO $$
DECLARE
  v_version record;
  v_has boolean;
  v_min_pos integer;
BEGIN
  FOR v_version IN
    SELECT hv.id
    FROM public.homepage_versions hv
    JOIN public.homepage_pages hp ON hp.id = hv.page_id
    WHERE hp.slug = 'home'
      AND (hp.live_version_id = hv.id OR hp.draft_version_id = hv.id)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.homepage_sections
      WHERE version_id = v_version.id AND section_type = 'breaking_news'
    ) INTO v_has;

    IF NOT v_has THEN
      SELECT COALESCE(MIN(position), 0) INTO v_min_pos
      FROM public.homepage_sections
      WHERE version_id = v_version.id;

      UPDATE public.homepage_sections
      SET position = position + 1
      WHERE version_id = v_version.id;

      INSERT INTO public.homepage_sections (version_id, section_type, name, position, enabled, config)
      VALUES (
        v_version.id,
        'breaking_news',
        'Breaking News',
        GREATEST(v_min_pos, 0),
        true,
        jsonb_build_object(
          'source', 'automatic',
          'limit', 3,
          'display', 'alert',
          'desktop_visible', true,
          'mobile_visible', true,
          'title', 'Breaking News'
        )
      );
    END IF;
  END LOOP;
END $$;
