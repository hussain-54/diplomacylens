-- Users & Staff RBAC upgrade: soft-delete, archive, bureaus, job titles,
-- login events, department heads, and presence helpers.
-- Builds on 20260720150000_staff_users_cms_module.sql

-- ============ PROFILE STATUS + SOFT DELETE ============

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'invited', 'pending', 'archived'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bureau_id uuid,
  ADD COLUMN IF NOT EXISTS job_title_id uuid,
  ADD COLUMN IF NOT EXISTS login_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_ip text,
  ADD COLUMN IF NOT EXISTS last_login_user_agent text;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_status_active_idx
  ON public.profiles (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_last_login_idx
  ON public.profiles (last_login_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS profiles_search_trgm_ready_idx
  ON public.profiles (lower(coalesce(name, '')), lower(coalesce(email, '')), lower(coalesce(username, '')));

-- ============ DEPARTMENTS: head + status ============

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============ BUREAUS ============

CREATE TABLE IF NOT EXISTS public.bureaus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  city text,
  country text,
  address text,
  head_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bureaus_status_idx ON public.bureaus (status, sort_order);

-- ============ JOB TITLES ============

CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  level text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_titles_department_idx
  ON public.job_titles (department_id, sort_order);

-- Wire profile FKs after tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bureau_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_bureau_id_fkey
      FOREIGN KEY (bureau_id) REFERENCES public.bureaus(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_job_title_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_job_title_id_fkey
      FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profiles_bureau_idx ON public.profiles (bureau_id);
CREATE INDEX IF NOT EXISTS profiles_job_title_idx ON public.profiles (job_title_id);
CREATE INDEX IF NOT EXISTS profiles_manager_idx ON public.profiles (manager_id);

-- ============ LOGIN EVENTS ============

CREATE TABLE IF NOT EXISTS public.staff_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'login'
    CHECK (event_type IN ('login', 'logout', 'failed', 'password_reset')),
  success boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  device text,
  browser text,
  os text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_login_events_user_idx
  ON public.staff_login_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_login_events_created_idx
  ON public.staff_login_events (created_at DESC);

-- Heartbeat / presence: authenticated user may update own last_login_at + insert login event
CREATE OR REPLACE FUNCTION public.record_staff_presence(
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_os text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    last_login_at = now(),
    login_count = coalesce(login_count, 0) + 1,
    last_login_ip = coalesce(p_ip, last_login_ip),
    last_login_user_agent = coalesce(p_user_agent, last_login_user_agent),
    updated_at = now()
  WHERE id = uid
    AND deleted_at IS NULL;

  INSERT INTO public.staff_login_events (
    user_id, event_type, success, ip_address, user_agent, device, browser, os
  ) VALUES (
    uid, 'login', true, p_ip, p_user_agent, p_device, p_browser, p_os
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_staff_presence(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_staff_presence(text, text, text, text, text) TO authenticated;

-- Seed job titles from common newsroom designations (idempotent)
INSERT INTO public.job_titles (title, slug, level, sort_order)
VALUES
  ('Managing Editor', 'managing-editor', 'leadership', 1),
  ('Senior Editor', 'senior-editor', 'senior', 2),
  ('Editor', 'editor', 'mid', 3),
  ('Reporter', 'reporter', 'mid', 4),
  ('Photographer', 'photographer', 'mid', 5),
  ('Video Editor', 'video-editor', 'mid', 6),
  ('SEO Specialist', 'seo-specialist', 'mid', 7),
  ('Contributor', 'contributor', 'junior', 8)
ON CONFLICT (slug) DO NOTHING;

-- Seed a few bureaus
INSERT INTO public.bureaus (name, slug, city, country, sort_order)
VALUES
  ('Islamabad Bureau', 'islamabad', 'Islamabad', 'Pakistan', 1),
  ('Karachi Bureau', 'karachi', 'Karachi', 'Pakistan', 2),
  ('Lahore Bureau', 'lahore', 'Lahore', 'Pakistan', 3),
  ('International Desk', 'international', NULL, NULL, 4)
ON CONFLICT (slug) DO NOTHING;

-- ============ RLS ============

ALTER TABLE public.bureaus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bureaus_staff ON public.bureaus;
CREATE POLICY bureaus_staff ON public.bureaus
  FOR ALL
  USING (app_hidden.has_permission(auth.uid(), 'staff:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'staff:manage'));

DROP POLICY IF EXISTS job_titles_staff ON public.job_titles;
CREATE POLICY job_titles_staff ON public.job_titles
  FOR ALL
  USING (app_hidden.has_permission(auth.uid(), 'staff:manage'))
  WITH CHECK (app_hidden.has_permission(auth.uid(), 'staff:manage'));

DROP POLICY IF EXISTS staff_login_events_staff ON public.staff_login_events;
CREATE POLICY staff_login_events_staff ON public.staff_login_events
  FOR SELECT
  USING (app_hidden.has_permission(auth.uid(), 'staff:manage') OR auth.uid() = user_id);

DROP POLICY IF EXISTS staff_login_events_insert_own ON public.staff_login_events;
CREATE POLICY staff_login_events_insert_own ON public.staff_login_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users may update their own last_login_* via presence RPC only (SECURITY DEFINER).
-- Staff managers retain existing profile update policies from earlier migrations.
