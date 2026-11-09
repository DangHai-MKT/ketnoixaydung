-- TASK 004 additive proposal. Requires separate owner approval before execution.
-- No enum changes, no existing data update/backfill, no financial tables.
ALTER TABLE public.projects
  ADD COLUMN working_version integer,
  ADD COLUMN revision integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT projects_working_version_positive CHECK (working_version IS NULL OR working_version > 0),
  ADD CONSTRAINT projects_revision_positive CHECK (revision > 0);

ALTER TABLE public.project_versions
  ADD COLUMN submission_status project_status,
  ADD COLUMN submitted_at timestamptz;

ALTER TABLE public.project_files ADD COLUMN superseded_at timestamptz;

ALTER TABLE public.projects ADD CONSTRAINT projects_working_version_fkey
  FOREIGN KEY (id, working_version) REFERENCES public.project_versions(project_id, version_no)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX project_versions_review_queue_idx ON public.project_versions(submission_status, submitted_at, id);
CREATE INDEX project_files_active_idx ON public.project_files(project_version_id) WHERE superseded_at IS NULL;

-- Freeze snapshot content after submission (and approved legacy version content).
-- Moderation metadata is the only allowed change to an already frozen version.
CREATE FUNCTION public.guard_project_snapshot_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL OR OLD.approved_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Submitted project versions cannot be deleted'; END IF;
    IF (to_jsonb(OLD) - ARRAY['submission_status','reviewed_by','reviewed_at','approved_at'])
      IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['submission_status','reviewed_by','reviewed_at','approved_at'])
      OR (OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
      RAISE EXCEPTION 'Submitted project version content is immutable';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER project_snapshot_content_guard BEFORE UPDATE OR DELETE ON public.project_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_snapshot_content();

-- Workflow submissions freeze both their private data and exact attachment set.
-- Legacy approved versions without submitted_at keep their historical insertion behavior.
CREATE FUNCTION public.guard_project_version_children() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_id uuid; frozen boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    version_id := OLD.project_version_id;
    SELECT submitted_at IS NOT NULL INTO frozen FROM public.project_versions WHERE id = version_id FOR UPDATE;
    IF frozen THEN RAISE EXCEPTION 'Submitted project data and files are immutable'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    version_id := NEW.project_version_id;
    SELECT submitted_at IS NOT NULL INTO frozen FROM public.project_versions WHERE id = version_id FOR UPDATE;
    IF frozen THEN RAISE EXCEPTION 'Submitted project data and files are immutable'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER project_private_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_private_data
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_version_children();
CREATE TRIGGER project_file_snapshot_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_version_children();
