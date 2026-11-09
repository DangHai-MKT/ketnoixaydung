-- TASK 007.2. Apply only after explicit approval to the isolated test database.
CREATE TABLE cms_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename varchar(180) NOT NULL,
  alt varchar(250) NOT NULL,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1920),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1920),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind varchar(10) NOT NULL CHECK (kind IN ('page', 'news')),
  slug varchar(100) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title varchar(180) NOT NULL,
  summary varchar(500) NOT NULL DEFAULT '',
  seo_title varchar(100) NOT NULL DEFAULT '',
  seo_description varchar(200) NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocks) = 'array'),
  category_id uuid REFERENCES cms_categories(id),
  featured_media_id uuid REFERENCES cms_media(id),
  featured_alt varchar(250) NOT NULL DEFAULT '',
  is_policy boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_revision integer,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug),
  CHECK (kind = 'news' OR category_id IS NULL),
  CHECK (kind = 'page' OR NOT is_policy)
);
CREATE INDEX cms_contents_kind_updated_idx ON cms_contents(kind, updated_at DESC, id DESC);

CREATE TABLE cms_revisions (
  content_id uuid NOT NULL REFERENCES cms_contents(id),
  revision integer NOT NULL CHECK (revision > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  category_id uuid REFERENCES cms_categories(id),
  published_by uuid NOT NULL REFERENCES users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, revision)
);
CREATE INDEX cms_revisions_published_idx ON cms_revisions(published_at DESC, content_id);
ALTER TABLE cms_contents ADD CONSTRAINT cms_contents_published_revision_fk
  FOREIGN KEY (id, published_revision) REFERENCES cms_revisions(content_id, revision);

CREATE TABLE cms_revision_media (
  content_id uuid NOT NULL,
  revision integer NOT NULL,
  media_id uuid NOT NULL REFERENCES cms_media(id),
  PRIMARY KEY (content_id, revision, media_id),
  FOREIGN KEY (content_id, revision) REFERENCES cms_revisions(content_id, revision)
);
CREATE INDEX cms_revision_media_image_idx ON cms_revision_media(media_id);

CREATE FUNCTION cms_prevent_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CMS publication history is immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER cms_revisions_immutable BEFORE UPDATE OR DELETE ON cms_revisions
  FOR EACH ROW EXECUTE FUNCTION cms_prevent_revision_mutation();
CREATE TRIGGER cms_revision_media_immutable BEFORE UPDATE OR DELETE ON cms_revision_media
  FOR EACH ROW EXECUTE FUNCTION cms_prevent_revision_mutation();
