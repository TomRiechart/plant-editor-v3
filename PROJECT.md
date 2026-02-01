# Plant Collection Editor - Project Documentation

## 📋 Overview
AI-powered image editing application for replacing plants in interior photos.

**Status:** 🚧 In Development  
**Started:** 2026-01-31  
**Owner:** Tom Riechart

---

## 🎯 Core Features

### 1. Collection Management
- Create/edit/delete collections of room images
- Each collection has one "main" image (for editing) and multiple "linked" images (for implementation)
- Upload multiple images at once

### 2. Plant Gallery
- Library of plant images
- Add/remove plants
- Plants used as reference for AI replacement

### 3. Image Editing (Generate)
- Canvas with Fabric.js for drawing masks
- Single plant mode: one color (red)
- Multi-plant mode: up to 3 plants with different colors (red/blue/yellow)
- Adjustable brush size
- Generate 3 variations via Fal.ai

### 4. Implement Pipeline
- Take one edit and apply to multiple images
- 3-step AI pipeline:
  1. **Analyze**: Gemini detects differences between original and edited
  2. **Generate**: Gemini creates custom prompts for each target image
  3. **Apply**: Fal.ai applies changes to each target (3 variations each)

### 5. Results & Comparison
- Display 3 variations per generation
- Image compare wiper (hover to see before/after)
- Download results
- Edit results further

---

## 🛠 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- TanStack Query (data fetching)
- Fabric.js (canvas)
- Framer Motion (animations)
- shadcn/ui (components)

### Backend (Local)
- Express.js server
- SQLite database (better-sqlite3)
- Local file storage for images

### AI Services
- **Fal.ai**: nano-banana-pro for image editing (4K, 3 variations)
- **Google Gemini**: gemini-1.5-pro for image analysis

---

## 📁 Project Structure

```
plant-editor/
├── .env                    # API keys (DO NOT COMMIT)
├── .gitignore
├── PROJECT.md              # This file
├── PROGRESS.md             # Development progress log
├── TESTS.md                # Test results and coverage
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
│
├── src/
│   ├── main.tsx            # Entry point
│   ├── App.tsx             # Root component
│   ├── index.css           # Global styles
│   │
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   └── editor/
│   │       ├── CollectionSelector.tsx
│   │       ├── CollectionDetail.tsx
│   │       ├── PlantEditor.tsx
│   │       ├── DrawingCanvas.tsx
│   │       ├── Sidebar.tsx
│   │       ├── PlantsGallery.tsx
│   │       ├── DrawingToolbar.tsx
│   │       ├── ResultsModal.tsx
│   │       ├── ImplementModal.tsx
│   │       ├── ImageCompareWiper.tsx
│   │       ├── ImageUploadDialog.tsx
│   │       └── SettingsModal.tsx
│   │
│   ├── hooks/
│   │   ├── useCollections.ts
│   │   ├── usePlants.ts
│   │   ├── useGenerate.ts
│   │   └── useImplement.ts
│   │
│   ├── stores/
│   │   └── editorStore.ts
│   │
│   ├── services/
│   │   ├── api.ts          # API client
│   │   ├── fal.ts          # Fal.ai integration
│   │   └── gemini.ts       # Gemini integration
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── lib/
│       └── utils.ts
│
├── server/
│   ├── index.ts            # Express server
│   ├── db.ts               # SQLite setup
│   ├── routes/
│   │   ├── collections.ts
│   │   ├── plants.ts
│   │   ├── generate.ts
│   │   └── implement.ts
│   └── services/
│       ├── fal.ts
│       └── gemini.ts
│
├── data/
│   ├── plant-editor.db     # SQLite database
│   └── uploads/            # Uploaded images
│       ├── collections/
│       └── plants/
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 🗄 Database Schema

### collections
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Collection name |
| thumbnail_url | TEXT | Thumbnail image path |
| created_at | DATETIME | Creation timestamp |

### collection_images
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| collection_id | TEXT | FK → collections.id |
| image_url | TEXT | Image file path |
| is_main | BOOLEAN | Is this the main editing image? |
| name | TEXT | Image name |
| order_index | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

### plants
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Plant name |
| image_url | TEXT | Image file path |
| thumbnail_url | TEXT | Thumbnail path |
| created_at | DATETIME | Creation timestamp |

### app_settings
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| key | TEXT | Setting key |
| value | TEXT | Setting value |
| updated_at | DATETIME | Last update |

---

## 🔑 API Keys

Stored in `.env` file (not committed to git):
- `FAL_API_KEY` - Fal.ai for image editing
- `GOOGLE_AI_API_KEY` - Google AI Studio for Gemini

---

## 📝 Notes

- PIN for settings: 6262
- Brush colors: red (#ef4444), blue (#3b82f6), yellow (#eab308)
- Fal.ai processing time: ~2.5 min per image at 4K
- Staggered parallel processing: 10 sec delay between images to avoid rate limits
