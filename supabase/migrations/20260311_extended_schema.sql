-- ============================================================================
-- Extended Schema Migration
-- Young Owls Studio — 2026-03-11
--
-- Adds: character depth columns, reference image tables, props system,
--       shared assets, scene-asset links, and generation job queue.
--
-- Conventions (matching existing schema):
--   PKs:        SERIAL INTEGER
--   FKs:        INTEGER referencing existing serial PKs
--   Timestamps: TEXT with ISO 8601 strings (UTC)
--   Arrays:     TEXT storing JSON (e.g. '["tag1","tag2"]')
--   Booleans:   BOOLEAN (new tables) / INTEGER 0|1 (legacy compat)
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. CHARACTERS TABLE — new columns for deeper character profiles
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality_traits TEXT;
  -- JSON array of tags, e.g. '["stubborn","loyal","impulsive"]'

ALTER TABLE characters ADD COLUMN IF NOT EXISTS archetype TEXT;
  -- e.g. "The Mentor", "Anti-Hero", "Trickster"

ALTER TABLE characters ADD COLUMN IF NOT EXISTS emotional_range TEXT;
  -- freeform description of emotional spectrum

ALTER TABLE characters ADD COLUMN IF NOT EXISTS speaking_style TEXT;
  -- e.g. "terse and sarcastic", "formal Victorian English"

ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory TEXT;
  -- long-form backstory notes

ALTER TABLE characters ADD COLUMN IF NOT EXISTS ai_generation_notes TEXT;
  -- appended to image/video prompts automatically when this character appears

ALTER TABLE characters ADD COLUMN IF NOT EXISTS ai_script_notes TEXT;
  -- used by script doctor and dialogue polish for context


-- ────────────────────────────────────────────────────────────────────────────
-- 2. CHARACTER_REFERENCE_IMAGES — visual references tied to a character
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_reference_images (
  id            SERIAL PRIMARY KEY,
  character_id  INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  project_id    INTEGER NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  storage_path  TEXT    NOT NULL,
  label         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_char_ref_images_character
  ON character_reference_images(character_id);

CREATE INDEX IF NOT EXISTS idx_char_ref_images_project
  ON character_reference_images(project_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. PROPS — trackable props/objects used across scenes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS props (
  id                  SERIAL  PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                TEXT    NOT NULL,
  description         TEXT,
  ai_generation_notes TEXT,
  tags                TEXT,          -- JSON array, e.g. '["weapon","hero-prop"]'
  is_shared           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_props_project
  ON props(project_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. PROP_REFERENCE_IMAGES — visual references tied to a prop
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prop_reference_images (
  id            SERIAL  PRIMARY KEY,
  prop_id       INTEGER NOT NULL REFERENCES props(id)     ON DELETE CASCADE,
  project_id    INTEGER NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  storage_path  TEXT    NOT NULL,
  label         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_prop_ref_images_prop
  ON prop_reference_images(prop_id);

CREATE INDEX IF NOT EXISTS idx_prop_ref_images_project
  ON prop_reference_images(project_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. LOCATION_REFERENCE_IMAGES — visual references tied to a location
--    (locations table already exists)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS location_reference_images (
  id            SERIAL  PRIMARY KEY,
  location_id   INTEGER NOT NULL REFERENCES locations(id)  ON DELETE CASCADE,
  project_id    INTEGER NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
  storage_path  TEXT    NOT NULL,
  label         TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_loc_ref_images_location
  ON location_reference_images(location_id);

CREATE INDEX IF NOT EXISTS idx_loc_ref_images_project
  ON location_reference_images(project_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. SHARED_ASSETS — cross-project asset sharing
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_assets (
  id                SERIAL  PRIMARY KEY,
  asset_type        TEXT    NOT NULL,      -- 'character' | 'location' | 'prop'
  source_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_id  INTEGER NOT NULL,      -- polymorphic FK to characters/locations/props
  name              TEXT    NOT NULL,
  description       TEXT,
  thumbnail_path    TEXT,
  metadata          TEXT,                  -- JSON: extra data for import
  shared_at         TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_shared_assets_type
  ON shared_assets(asset_type);

CREATE INDEX IF NOT EXISTS idx_shared_assets_source
  ON shared_assets(source_project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_assets_unique
  ON shared_assets(asset_type, source_entity_id);

CREATE TABLE IF NOT EXISTS imported_assets (
  id                SERIAL  PRIMARY KEY,
  shared_asset_id   INTEGER NOT NULL REFERENCES shared_assets(id) ON DELETE CASCADE,
  target_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_entity_id  INTEGER NOT NULL,
  asset_type        TEXT    NOT NULL,
  is_forked         BOOLEAN NOT NULL DEFAULT FALSE,
  imported_at       TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_imported_assets_target
  ON imported_assets(target_project_id);

CREATE INDEX IF NOT EXISTS idx_imported_assets_shared
  ON imported_assets(shared_asset_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. SCENE_ASSET_LINKS — link generated/uploaded assets to scenes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scene_asset_links (
  id              SERIAL  PRIMARY KEY,
  scene_id        INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  asset_id        INTEGER NOT NULL,     -- polymorphic: image_generation.id, video_generation.id, etc.
  asset_type      TEXT    NOT NULL,      -- 'image' | 'video' | 'audio'
  is_auto_linked  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_scene_asset_links_scene
  ON scene_asset_links(scene_id);

CREATE INDEX IF NOT EXISTS idx_scene_asset_links_asset
  ON scene_asset_links(asset_type, asset_id);

-- Prevent duplicate links for the same scene + asset
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_asset_links_unique
  ON scene_asset_links(scene_id, asset_type, asset_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 8. GENERATION_JOBS — batch generation queue
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generation_jobs (
  id            SERIAL  PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id    INTEGER,               -- future: references episodes table
  status        TEXT    NOT NULL DEFAULT 'queued',
                                        -- 'queued' | 'processing' | 'completed' | 'failed'
  total_assets  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project
  ON generation_jobs(project_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status
  ON generation_jobs(status);
