import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import ws from "ws";
import { NETLIFY_DATABASE_URL } from "@/lib/env";

neonConfig.webSocketConstructor = ws;

const connectionString = NETLIFY_DATABASE_URL;

export const pool = new Pool({
  connectionString,
  max: 10,                        // max connections in the pool
  idleTimeoutMillis: 30_000,      // close idle connections after 30s
  connectionTimeoutMillis: 10_000, // fail fast if a connection takes >10s
});
export const db = drizzle(pool, { schema });

// ── Lazy schema initialization ──

let schemaPromise: Promise<void> | null = null;

export async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = doEnsureSchema();
  return schemaPromise;
}

async function doEnsureSchema() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      raw_text TEXT,
      original_filename TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_number INTEGER NOT NULL,
      heading TEXT NOT NULL,
      heading_type TEXT,
      location TEXT,
      time_of_day TEXT,
      section TEXT,
      synopsis TEXT,
      raw_content TEXT,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dialogues (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      character TEXT NOT NULL,
      parenthetical TEXT,
      line TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS directions (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      dialogue_count INTEGER NOT NULL DEFAULT 0,
      voice_id TEXT,
      voice_name TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_id INTEGER REFERENCES scenes(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      caption TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Settings (API keys, etc.)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Prompt Snippets
    CREATE TABLE IF NOT EXISTS prompt_snippets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      shortcut TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Drive: Folders (must come before image_generations which references drive_files)
    CREATE TABLE IF NOT EXISTS drive_folders (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Drive: Files
    CREATE TABLE IF NOT EXISTS drive_files (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      folder_id INTEGER REFERENCES drive_folders(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      caption TEXT,
      thumbnail_path TEXT,
      generated_by TEXT,
      generation_prompt TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Voice Generations
    CREATE TABLE IF NOT EXISTS voice_generations (
      id SERIAL PRIMARY KEY,
      dialogue_id INTEGER NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      voice_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      input_text TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      selected BOOLEAN NOT NULL DEFAULT FALSE,
      storage_path TEXT NOT NULL,
      padded_storage_path TEXT,
      padding_start REAL DEFAULT 0,
      padding_end REAL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
      file_size INTEGER NOT NULL,
      padded_file_size INTEGER,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Image Generations
    CREATE TABLE IF NOT EXISTS image_generations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'nano-banana-pro',
      status TEXT NOT NULL DEFAULT 'queued',
      storage_path TEXT,
      mime_type TEXT DEFAULT 'image/png',
      file_size INTEGER DEFAULT 0,
      seed INTEGER,
      error TEXT,
      params TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      drive_file_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL,
      batch_id TEXT,
      batch_label TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Drive: Tags
    CREATE TABLE IF NOT EXISTS drive_tags (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'gray'
    );

    -- Drive: Tag Assignments
    CREATE TABLE IF NOT EXISTS drive_tag_assignments (
      id SERIAL PRIMARY KEY,
      tag_id INTEGER NOT NULL REFERENCES drive_tags(id) ON DELETE CASCADE,
      file_id INTEGER REFERENCES drive_files(id) ON DELETE CASCADE,
      folder_id INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE
    );

    -- Scene <-> File links (many-to-many)
    CREATE TABLE IF NOT EXISTS scene_file_links (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE
    );

    -- Character <-> File links (many-to-many)
    CREATE TABLE IF NOT EXISTS character_file_links (
      id SERIAL PRIMARY KEY,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);

  // ── Video Generations ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_generations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'text-to-video',
      status TEXT NOT NULL DEFAULT 'queued',
      fal_request_id TEXT,
      storage_path TEXT,
      mime_type TEXT DEFAULT 'video/mp4',
      file_size INTEGER DEFAULT 0,
      duration_ms INTEGER,
      seed INTEGER,
      error TEXT,
      params TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      drive_file_id INTEGER REFERENCES drive_files(id) ON DELETE SET NULL,
      source_image_path TEXT,
      source_video_path TEXT,
      source_audio_path TEXT,
      batch_id TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
  `);

  // ── Batch 2 Tables ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS screenplay_versions (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      branch_id INTEGER,
      version_number INTEGER NOT NULL,
      label TEXT,
      trigger_type TEXT NOT NULL,
      trigger_detail TEXT,
      snapshot TEXT NOT NULL,
      stats TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_versions_project ON screenplay_versions(project_id);

    CREATE TABLE IF NOT EXISTS screenplay_branches (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 0,
      parent_version_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_branches_project ON screenplay_branches(project_id);

    CREATE TABLE IF NOT EXISTS script_analyses (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_id INTEGER,
      analysis_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      custom_prompt TEXT,
      model TEXT DEFAULT 'claude-sonnet-4-20250514',
      token_count INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_project ON script_analyses(project_id);

    CREATE TABLE IF NOT EXISTS script_issues (
      id SERIAL PRIMARY KEY,
      analysis_id INTEGER NOT NULL REFERENCES script_analyses(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      scene_ids TEXT,
      character_names TEXT,
      recommendation TEXT NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      resolved_note TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_issues_analysis ON script_issues(analysis_id);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON script_issues(project_id);

    CREATE TABLE IF NOT EXISTS dialogue_polish_jobs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      character_name TEXT NOT NULL,
      directive TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_dialogues INTEGER NOT NULL,
      processed_dialogues INTEGER DEFAULT 0,
      accepted_dialogues INTEGER DEFAULT 0,
      rejected_dialogues INTEGER DEFAULT 0,
      model TEXT DEFAULT 'claude-sonnet-4-20250514',
      version_id_before INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS dialogue_polish_results (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES dialogue_polish_jobs(id) ON DELETE CASCADE,
      dialogue_id INTEGER NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      original_line TEXT NOT NULL,
      original_parenthetical TEXT,
      rewritten_line TEXT NOT NULL,
      rewritten_parenthetical TEXT,
      change_rationale TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS scene_breakdowns (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      page_count REAL,
      day_or_night TEXT,
      int_or_ext TEXT,
      estimated_shoot_hours REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS breakdown_elements (
      id SERIAL PRIMARY KEY,
      breakdown_id INTEGER NOT NULL REFERENCES scene_breakdowns(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      is_custom INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS moodboards (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      layout TEXT DEFAULT 'masonry',
      background_color TEXT DEFAULT '#1a1a1a',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS moodboard_items (
      id SERIAL PRIMARY KEY,
      moodboard_id INTEGER NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      file_id INTEGER,
      generation_id INTEGER,
      storage_path TEXT,
      text_content TEXT,
      color_value TEXT,
      color_name TEXT,
      url TEXT,
      url_thumbnail TEXT,
      position_x REAL,
      position_y REAL,
      width REAL,
      height REAL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      visual_prompt TEXT,
      time_period TEXT,
      style_notes TEXT,
      reference_images TEXT,
      moodboard_id INTEGER,
      scene_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS scene_locations (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      UNIQUE(scene_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS location_concepts (
      id SERIAL PRIMARY KEY,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      generation_id INTEGER,
      file_id INTEGER,
      storage_path TEXT,
      prompt TEXT,
      time_of_day TEXT,
      camera_angle TEXT,
      is_primary INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS character_reference_images (
      id SERIAL PRIMARY KEY,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      label TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      file_size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS location_reference_images (
      id SERIAL PRIMARY KEY,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      label TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      file_size INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS scene_color_data (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      dominant_colors TEXT NOT NULL,
      average_color TEXT,
      brightness REAL,
      saturation REAL,
      warmth REAL,
      mood_tag TEXT,
      source_image_id INTEGER,
      source_image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    -- Video Editor
    CREATE TABLE IF NOT EXISTS video_editor_projects (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      width INTEGER NOT NULL DEFAULT 1920,
      height INTEGER NOT NULL DEFAULT 1080,
      fps INTEGER NOT NULL DEFAULT 30,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      render_progress INTEGER DEFAULT 0,
      render_error TEXT,
      output_path TEXT,
      output_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE TABLE IF NOT EXISTS video_editor_tracks (
      id SERIAL PRIMARY KEY,
      editor_project_id INTEGER NOT NULL REFERENCES video_editor_projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      muted BOOLEAN NOT NULL DEFAULT FALSE,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      volume REAL NOT NULL DEFAULT 1.0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS video_editor_clips (
      id SERIAL PRIMARY KEY,
      track_id INTEGER NOT NULL REFERENCES video_editor_tracks(id) ON DELETE CASCADE,
      editor_project_id INTEGER NOT NULL REFERENCES video_editor_projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT,
      start_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      source_start_ms INTEGER NOT NULL DEFAULT 0,
      source_end_ms INTEGER,
      source_path TEXT,
      source_type TEXT,
      source_id INTEGER,
      volume REAL NOT NULL DEFAULT 1.0,
      opacity REAL NOT NULL DEFAULT 1.0,
      playback_rate REAL NOT NULL DEFAULT 1.0,
      text_content TEXT,
      text_style TEXT,
      filters TEXT,
      transition TEXT,
      thumbnail_path TEXT,
      waveform_data TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );

    CREATE INDEX IF NOT EXISTS idx_veditor_projects_project ON video_editor_projects(project_id);
    CREATE INDEX IF NOT EXISTS idx_veditor_tracks_project ON video_editor_tracks(editor_project_id);
    CREATE INDEX IF NOT EXISTS idx_veditor_clips_track ON video_editor_clips(track_id);
    CREATE INDEX IF NOT EXISTS idx_veditor_clips_project ON video_editor_clips(editor_project_id);

    -- Scene Notes (Production Notes)
    CREATE TABLE IF NOT EXISTS scene_notes (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      color TEXT NOT NULL DEFAULT 'yellow',
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_scene_notes_scene ON scene_notes(scene_id);
    CREATE INDEX IF NOT EXISTS idx_scene_notes_project ON scene_notes(project_id);
  `);

  // ── Add columns to existing tables (idempotent — Postgres supports IF NOT EXISTS) ──
  await addColumnIfMissing("projects", "cover_image", "TEXT");
  await addColumnIfMissing("characters", "voice_id", "TEXT");
  await addColumnIfMissing("characters", "voice_name", "TEXT");
  await addColumnIfMissing("image_generations", "tags", "TEXT");
  await addColumnIfMissing("prompt_snippets", "tags", "TEXT");
  await addColumnIfMissing("image_generations", "cost", "REAL");
  await addColumnIfMissing("video_generations", "cost", "REAL");
  await addColumnIfMissing("voice_generations", "cost", "REAL");
  await addColumnIfMissing("drive_files", "seed", "INTEGER");
  await addColumnIfMissing("characters", "role", "TEXT");
  await addColumnIfMissing("characters", "personality_traits", "TEXT");
  await addColumnIfMissing("characters", "archetype", "TEXT");
  await addColumnIfMissing("characters", "emotional_range", "TEXT");
  await addColumnIfMissing("characters", "speaking_style", "TEXT");
  await addColumnIfMissing("characters", "backstory", "TEXT");
  await addColumnIfMissing("characters", "ai_generation_notes", "TEXT");
  await addColumnIfMissing("characters", "ai_script_notes", "TEXT");

  // ── Performance indexes ──
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
    CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
    CREATE INDEX IF NOT EXISTS idx_drive_files_project ON drive_files(project_id);
    CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON drive_files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_voice_gen_scene ON voice_generations(scene_id);
    CREATE INDEX IF NOT EXISTS idx_voice_gen_dialogue ON voice_generations(dialogue_id);
    CREATE INDEX IF NOT EXISTS idx_image_gen_project ON image_generations(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_video_gen_project ON video_generations(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dialogues_scene ON dialogues(scene_id);
    CREATE INDEX IF NOT EXISTS idx_directions_scene ON directions(scene_id);
    CREATE INDEX IF NOT EXISTS idx_scene_file_links_scene ON scene_file_links(scene_id);
    CREATE INDEX IF NOT EXISTS idx_char_file_links_char ON character_file_links(character_id);
    CREATE INDEX IF NOT EXISTS idx_tag_assignments_file ON drive_tag_assignments(file_id);
    CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON drive_tag_assignments(tag_id);
    CREATE INDEX IF NOT EXISTS idx_breakdowns_scene ON scene_breakdowns(scene_id);
    CREATE INDEX IF NOT EXISTS idx_moodboard_items_board ON moodboard_items(moodboard_id);
    CREATE INDEX IF NOT EXISTS idx_scene_locations_scene ON scene_locations(scene_id);
    CREATE INDEX IF NOT EXISTS idx_scene_locations_location ON scene_locations(location_id);
    CREATE INDEX IF NOT EXISTS idx_color_data_scene ON scene_color_data(scene_id);
    CREATE INDEX IF NOT EXISTS idx_polish_results_job ON dialogue_polish_results(job_id);

    -- TECH AUDIT FIX: Missing indexes on FK columns
    CREATE INDEX IF NOT EXISTS idx_voice_gen_project ON voice_generations(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_project ON media(project_id);
    CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON drive_folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_drive_tags_project ON drive_tags(project_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_project ON prompt_snippets(project_id);
    CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);
    CREATE INDEX IF NOT EXISTS idx_location_concepts_location ON location_concepts(location_id);
    CREATE INDEX IF NOT EXISTS idx_moodboards_project ON moodboards(project_id);
    CREATE INDEX IF NOT EXISTS idx_polish_jobs_project ON dialogue_polish_jobs(project_id);
    CREATE INDEX IF NOT EXISTS idx_color_data_project ON scene_color_data(project_id);
    CREATE INDEX IF NOT EXISTS idx_breakdowns_project ON scene_breakdowns(project_id);

    -- TECH AUDIT FIX: Unique constraints on junction tables to prevent duplicates
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_file_links_unique ON scene_file_links(scene_id, file_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_char_file_links_unique ON character_file_links(character_id, file_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_assignments_file_unique ON drive_tag_assignments(tag_id, file_id) WHERE file_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_assignments_folder_unique ON drive_tag_assignments(tag_id, folder_id) WHERE folder_id IS NOT NULL;
  `);

  // ── Props ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS props (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      ai_generation_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_props_project ON props(project_id);

    CREATE TABLE IF NOT EXISTS prop_file_links (
      id SERIAL PRIMARY KEY,
      prop_id INTEGER NOT NULL REFERENCES props(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS idx_prop_file_links_prop ON prop_file_links(prop_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_file_links_unique ON prop_file_links(prop_id, file_id);
  `);

  // ── Cross-Project Asset Sharing ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_assets (
      id SERIAL PRIMARY KEY,
      asset_type TEXT NOT NULL,
      source_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_entity_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_path TEXT,
      metadata TEXT,
      shared_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_shared_assets_type ON shared_assets(asset_type);
    CREATE INDEX IF NOT EXISTS idx_shared_assets_source ON shared_assets(source_project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_assets_unique ON shared_assets(asset_type, source_entity_id);

    CREATE TABLE IF NOT EXISTS imported_assets (
      id SERIAL PRIMARY KEY,
      shared_asset_id INTEGER NOT NULL REFERENCES shared_assets(id) ON DELETE CASCADE,
      target_project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      target_entity_id INTEGER NOT NULL,
      asset_type TEXT NOT NULL,
      is_forked BOOLEAN NOT NULL DEFAULT FALSE,
      imported_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_imported_assets_target ON imported_assets(target_project_id);
    CREATE INDEX IF NOT EXISTS idx_imported_assets_shared ON imported_assets(shared_asset_id);
  `);

  // ── Presentation Shares ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS presentation_shares (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      expires_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_presentation_shares_token ON presentation_shares(token);
    CREATE INDEX IF NOT EXISTS idx_presentation_shares_project ON presentation_shares(project_id);
  `);

  // Add review_status to scene_file_links
  await pool.query(`ALTER TABLE scene_file_links ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'`);

  // ── Audio Studio Generations ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audio_studio_generations (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'sfx',
      status TEXT NOT NULL DEFAULT 'generating',
      storage_path TEXT,
      filename TEXT,
      mime_type TEXT,
      file_size INTEGER,
      duration_seconds REAL,
      error TEXT,
      generated_by TEXT,
      cost REAL,
      created_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
  `);

  // ── Visual Consistency Checks ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consistency_checks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      image_a_id INTEGER NOT NULL,
      image_b_id INTEGER NOT NULL,
      image_a_path TEXT NOT NULL,
      image_b_path TEXT NOT NULL,
      result TEXT NOT NULL,
      reason TEXT,
      checked_at TEXT NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
    );
    CREATE INDEX IF NOT EXISTS idx_consistency_project ON consistency_checks(project_id);
    CREATE INDEX IF NOT EXISTS idx_consistency_result ON consistency_checks(result);
  `);

  // ── Media -> Drive migration (idempotent) ──
  await migrateMediaToDrive();

}

// ── Add columns to existing tables (idempotent) ──
// TECH AUDIT FIX: Prevent SQL injection by whitelisting identifiers instead of string interpolation
const VALID_IDENTIFIERS = /^[a-z_][a-z0-9_]*$/;
async function addColumnIfMissing(table: string, column: string, type: string) {
  if (!VALID_IDENTIFIERS.test(table) || !VALID_IDENTIFIERS.test(column) || !VALID_IDENTIFIERS.test(type.replace(/\s/g, "_").toLowerCase())) {
    throw new Error(`Invalid identifier in addColumnIfMissing: table=${table}, column=${column}, type=${type}`);
  }
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
}

// ── Media -> Drive migration (idempotent) ──
async function migrateMediaToDrive() {
  const { rows: [{ c }] } = await pool.query(
    "SELECT COUNT(*) AS c FROM drive_files WHERE generated_by = '__migrated_from_media'"
  );
  if (Number(c) > 0) return; // already migrated

  const { rows: mediaRows } = await pool.query("SELECT * FROM media");
  if (mediaRows.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const m of mediaRows) {
      const res = await client.query(
        `INSERT INTO drive_files (project_id, folder_id, filename, storage_path, mime_type, file_size, file_type, caption, generated_by, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, '__migrated_from_media', 0, $8, $8) RETURNING id`,
        [m.project_id, m.filename, m.storage_path, m.mime_type, m.file_size, m.media_type, m.caption, m.created_at]
      );
      if (m.scene_id) {
        await client.query(
          "INSERT INTO scene_file_links (scene_id, file_id) VALUES ($1, $2)",
          [m.scene_id, res.rows[0].id]
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
