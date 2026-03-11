# Young Owls Studio

AI-powered screenplay production platform. Upload scripts, parse them with Claude, then use AI tools for visual development, breakdowns, audio, and video.

**Design Identity**: Dark Cinema Premium — deep space backgrounds (#0a0a14), Electric Indigo primary (#6366f1), Cyan accent (#22d3ee). Dark-first design, inspired by professional post-production suites.

## Tech Stack

- **Framework**: Next.js 16.1 (App Router), React 19, TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS v4 (`@theme inline`), shadcn/ui (Vega style, oklch colors)
- **Database**: Neon Postgres (serverless) via Drizzle ORM
- **AI**: Anthropic Claude (claude-sonnet-4-20250514) via `@anthropic-ai/sdk`
- **Storage**: Supabase Storage (env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Video/Image Gen**: fal.ai API (`FAL_KEY`)
- **Voice**: ElevenLabs API (`ELEVENLABS_API_KEY`)
- **Animation**: GSAP (always check `prefers-reduced-motion`)
- **Icons**: Phosphor Icons — **always use deep imports**: `import { Play } from "@phosphor-icons/react/dist/csr/Play"`
- **Charts**: Recharts (dynamically imported)
- **Video Preview**: Remotion Player (lazy loaded via `next/dynamic`)
- **Deploy**: Netlify with `@netlify/plugin-nextjs`, Node 22

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Workspace (project list)
│   ├── settings/page.tsx                 # Global settings (API keys)
│   ├── global-error.tsx                  # Root error boundary
│   ├── layout.tsx                        # Root layout (fonts, theme, providers)
│   ├── globals.css                       # Tailwind v4 theme tokens, animations
│   ├── api/                              # ~110 API route handlers
│   │   ├── projects/                     # CRUD projects
│   │   ├── screenplay/parse|upload/      # Script upload & Claude parsing
│   │   ├── scenes/                       # Scene CRUD + modifications
│   │   ├── characters/                   # Character management
│   │   ├── breakdowns/                   # Scene breakdowns (AI)
│   │   ├── script-doctor/                # Script analysis (AI)
│   │   ├── dialogue-polish/              # Dialogue rewriting (AI)
│   │   ├── generate/image|video/         # fal.ai image/video generation
│   │   ├── voices/                       # ElevenLabs TTS
│   │   ├── audio-studio/                 # Sound effects generation
│   │   ├── locations/                    # Location extraction & management
│   │   ├── drive/                        # File management system
│   │   ├── moodboards/                   # Visual moodboards
│   │   ├── video-editor/                 # NLE video editor backend
│   │   ├── versions/                     # Screenplay versioning
│   │   └── storage/[...path]/            # Supabase proxy
│   └── project/[id]/
│       ├── page.tsx                      # Overview dashboard
│       ├── upload/                       # Script upload
│       ├── scenes/                       # Scene browser
│       ├── characters/                   # Character list
│       ├── breakdowns/                   # Scene breakdowns
│       ├── script-doctor/                # AI script analysis
│       ├── dialogue-polish/              # AI dialogue rewriting
│       ├── generate/                     # Image generation
│       ├── generate-video/               # Video generation
│       ├── camera-angles/                # Camera angle generation
│       ├── upscale/                      # Video upscaling
│       ├── audio-studio/                 # Audio/SFX generation
│       ├── video-editor/                 # NLE timeline editor
│       ├── locations/                    # Location management
│       ├── moodboards/                   # Visual moodboards
│       ├── color-script/                 # Color script analysis
│       ├── drive/                        # File browser
│       ├── versions/                     # Script version history
│       ├── budget/                       # Budget estimation
│       └── snippets/                     # Prompt snippets
├── components/
│   ├── ui/                               # shadcn/ui primitives (~40 components)
│   ├── video-gen/                        # Video gen sub-components
│   ├── image-gen-*.tsx                   # Image gen sub-components
│   ├── sidebar-config-dialog.tsx         # Sidebar customization
│   ├── theme-customizer.tsx              # Theme settings
│   ├── command-palette.tsx               # Cmd+K palette
│   ├── confirm-dialog.tsx                # Confirmation dialog
│   ├── prompt-with-mentions.tsx          # Prompt input with @mentions
│   └── onboarding/                       # Walkthrough/onboarding
├── hooks/
│   ├── use-sidebar-config.ts             # Sidebar navigation config
│   ├── use-image-generation-queue.ts     # Image gen queue management
│   ├── use-video-generation-queue.ts     # Video gen queue management
│   ├── use-gallery-size.ts               # Gallery thumbnail sizing
│   ├── use-keyboard-shortcuts.ts         # Global keyboard shortcuts
│   └── use-walkthrough.ts                # Onboarding state
└── lib/
    ├── db/
    │   ├── index.ts                      # Neon pool + ensureSchema()
    │   ├── schema.ts                     # Drizzle pgTable definitions
    │   └── queries.ts                    # Shared query functions
    ├── types.ts                          # All shared TypeScript interfaces
    ├── claude.ts                         # Claude API helpers
    ├── claude-script-doctor.ts           # Script analysis prompt
    ├── fal.ts                            # fal.ai API (SSRF protected)
    ├── elevenlabs.ts                     # ElevenLabs TTS
    ├── storage.ts                        # Supabase storage helpers
    ├── supabase.ts                       # Supabase client
    ├── screenplay-parser.ts              # Script parsing logic
    ├── location-extractor.ts             # Location extraction from headings
    ├── gsap.ts                           # GSAP singleton export
    ├── theme/                            # Theme system (presets, context, hooks)
    ├── logger.ts                         # Server-side logger
    ├── env.ts                            # Environment variable access
    └── utils.ts                          # cn() and shared utilities
```

## Database

Neon Postgres via `@neondatabase/serverless`. Connection string from `NETLIFY_DATABASE_URL`.

**Key tables**: projects, scenes, dialogues, directions, characters, locations, scene_locations, location_concepts, image_generations, video_generations, voice_generations, audio_studio_generations, drive_files, drive_folders, drive_tags, scene_breakdowns, breakdown_elements, script_analyses, script_issues, dialogue_polish_jobs, dialogue_polish_results, screenplay_versions, screenplay_branches, moodboards, moodboard_items, scene_color_data, video_editor_projects, video_editor_tracks, video_editor_clips, scene_notes, scene_file_links, character_file_links, settings, prompt_snippets, media

Schema initialization is lazy via `ensureSchema()` — creates tables with `CREATE TABLE IF NOT EXISTS` and adds columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## Conventions

### Code Style
- `"use client"` directive on all pages with hooks/state/event handlers
- API routes: validate params, return `NextResponse.json()`, wrap in try/catch with `logger.error()`
- Icons: **ALWAYS deep imports** — `import { X } from "@phosphor-icons/react/dist/csr/X"` (never barrel imports)
- Colors: **ONLY semantic** — `bg-primary`, `text-muted-foreground`, `bg-muted` etc. Never hardcoded `bg-blue-500`
- Spacing: Use `gap-*` not `space-y-*`
- Animations: Always check `window.matchMedia("(prefers-reduced-motion: reduce)")` before GSAP
- Font system: 8 Google Fonts loaded (Geist, Geist_Mono, Inter, Figtree, JetBrains_Mono, IBM_Plex_Sans, Space_Grotesk, Libre_Baskerville, Syne) — user can switch via theme customizer

### API Security
- SSRF protection on fal.ai URLs via `assertFalOrigin()`
- Input validation: `Number()` + `isNaN()` check on all numeric params
- SQL injection prevented by Drizzle ORM parameterized queries
- Supabase credentials in env vars (not hardcoded)
- CSP headers configured in `next.config.ts`
- No auth on API routes yet (TODO)

### Design System
- shadcn/ui with Vega style
- Theme: oklch color space, CSS custom properties
- Dark mode via `data-theme` and `.dark` class
- Customizable via theme-customizer component
- Responsive: mobile-first with bottom nav on mobile

## Environment Variables

```
NETLIFY_DATABASE_URL          # Neon Postgres connection string
ANTHROPIC_API_KEY             # Claude API
FAL_KEY                       # fal.ai for image/video generation
ELEVENLABS_API_KEY            # Text-to-speech
NEXT_PUBLIC_SUPABASE_URL      # Supabase storage URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
NEXT_PUBLIC_SITE_URL          # Site URL for metadata
```

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run type-check   # TypeScript check (tsc --noEmit)
npm run lint         # ESLint
```

## Deployment

```bash
# Deploy to Netlify (may need TLS workaround on macOS)
NODE_TLS_REJECT_UNAUTHORIZED=0 npx netlify deploy --build --prod
```

## Key Patterns

### Data Flow
1. User uploads screenplay (.txt, .fdx, .docx, .fountain)
2. Claude parses it into structured scenes, dialogues, directions, characters
3. Data stored in Neon Postgres
4. AI tools operate on parsed data (breakdowns, analysis, dialogue polish)
5. Visual tools generate images/videos via fal.ai
6. Audio tools generate voice/SFX via ElevenLabs
7. Everything stored in Supabase Storage, linked via drive_files

### Sidebar Navigation
Configured in `src/hooks/use-sidebar-config.ts`. Groups: Project, Writing, Visual, Production, Audio. Each item has visibility, order, icon, and URL.

### Theme System
Multi-layered: base theme (oklch tokens in CSS) + user customization (font, colors, radius). Stored in `localStorage('screenplay-theme')`. Font applied via `data-font` attribute on `<html>`.
