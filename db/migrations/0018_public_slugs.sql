-- Additive URL identifiers; existing UUIDs and legacy slugs remain unchanged.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_slug varchar(220);
ALTER TABLE public.partner_companies ADD COLUMN IF NOT EXISTS public_slug varchar(220);
CREATE UNIQUE INDEX IF NOT EXISTS projects_public_slug_uq ON public.projects(public_slug);
CREATE UNIQUE INDEX IF NOT EXISTS partner_companies_public_slug_uq ON public.partner_companies(public_slug);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.projects'::regclass AND conname='projects_public_slug_format') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_public_slug_format CHECK(public_slug IS NULL OR public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.partner_companies'::regclass AND conname='partner_companies_public_slug_format') THEN
    ALTER TABLE public.partner_companies ADD CONSTRAINT partner_companies_public_slug_format CHECK(public_slug IS NULL OR public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_url_slug(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT trim(both '-' from left(regexp_replace(
    regexp_replace(lower(translate(normalize(value,NFD),'đĐ','dD')),U&'[\0300-\036f]','','g'),
    '[^a-z0-9]+','-','g'),160));
$$;

CREATE OR REPLACE FUNCTION public.assign_marketplace_public_slug() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_catalog AS $$
DECLARE label text; region text; base text; candidate text; suffix integer:=1; taken boolean;
BEGIN
  IF NEW.public_slug IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='projects' THEN
    IF NEW.status<>'published' THEN RETURN NEW; END IF;
    SELECT title,province_code INTO label,region FROM public.project_versions
      WHERE project_id=NEW.id AND version_no=NEW.current_version LIMIT 1;
    label:=coalesce(label,NEW.title);region:=coalesce(region,NEW.province_code);
    region:=CASE region WHEN 'HN' THEN 'Hà Nội' WHEN 'HCM' THEN 'Hồ Chí Minh' WHEN 'DN' THEN 'Đà Nẵng'
      WHEN 'ĐN' THEN 'Đồng Nai' WHEN 'BN' THEN 'Bắc Ninh' WHEN 'BD' THEN 'Bình Dương' ELSE region END;
  ELSE
    IF NEW.published_at IS NULL THEN RETURN NEW; END IF;
    label:=NEW.name;region:=NEW.province;
  END IF;
  base:=public.marketplace_url_slug(coalesce(label,''));
  region:=public.marketplace_url_slug(coalesce(region,''));
  IF region<>'' AND position('-'||region||'-' in '-'||base||'-')=0 THEN base:=base||'-'||region; END IF;
  base:=trim(both '-' from left(base,180));
  IF base='' THEN base:=CASE WHEN TG_TABLE_NAME='projects' THEN 'du-an' ELSE 'doanh-nghiep' END; END IF;
  -- Serialise equal names so simultaneous publications cannot claim the same URL.
  PERFORM pg_advisory_xact_lock(hashtextextended('public-url:'||TG_TABLE_NAME||':'||base,0));
  LOOP
    candidate:=base||CASE WHEN suffix=1 THEN '' ELSE '-'||suffix::text END;
    IF TG_TABLE_NAME='projects' THEN
      SELECT EXISTS(SELECT 1 FROM public.projects WHERE public_slug=candidate AND id<>NEW.id) INTO taken;
    ELSE
      SELECT EXISTS(SELECT 1 FROM public.partner_companies WHERE public_slug=candidate AND id<>NEW.id) INTO taken;
    END IF;
    EXIT WHEN NOT taken;
    suffix:=suffix+1;
  END LOOP;
  NEW.public_slug:=candidate;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS assign_project_public_slug ON public.projects;
CREATE TRIGGER assign_project_public_slug BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.assign_marketplace_public_slug();
DROP TRIGGER IF EXISTS assign_company_public_slug ON public.partner_companies;
CREATE TRIGGER assign_company_public_slug BEFORE INSERT OR UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.assign_marketplace_public_slug();
UPDATE public.projects SET public_slug=NULL WHERE public_slug IS NULL AND status='published';
UPDATE public.partner_companies SET public_slug=NULL WHERE public_slug IS NULL AND published_at IS NOT NULL;
