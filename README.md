# D&D Companion

A real-time campaign transcription and management web application for in-person D&D sessions. Mostly handles automatic audio-playing and note-taking at the moment.

## Features

- **Real-Time Transcription**: Automatic speech-to-text with AI-powered speaker identification
- **Automated Atmosphere**: Sound effects and music that react to your session
- **Smart Health Tracking**: AI detects damage and healing from dialogue
- **Session Recaps**: AI-generated "Previously on..." summaries
- **Campaign Management**: Organize campaigns, track sessions, manage players and NPCs

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript, Tailwind CSS, Zustand |
| Backend | Node.js + Express, Socket.io |
| Database | PostgreSQL + Prisma ORM |
| Real-time Transcription | Deepgram Streaming API |
| AI/LLM | OpenAI GPT-4 API |
| Audio | Web Audio API + Howler.js |
| Auth | Clerk |

## Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys for:
  - [Clerk](https://clerk.com) (authentication)
  - [Deepgram](https://deepgram.com) (transcription)
  - [OpenAI](https://openai.com) (AI features)

## Setup

### 1. Clone and Install Dependencies

```bash
cd DnD_Companion
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dnd_companion?schema=public"

# Server
PORT=3001
NODE_ENV=development

# Auth (Clerk)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Deepgram
DEEPGRAM_API_KEY=your_deepgram_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# CORS
CLIENT_URL=http://localhost:5173
```

Create a `.env` file in the `client` directory:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio
npm run db:studio
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:server  # Backend on http://localhost:3001
npm run dev:client  # Frontend on http://localhost:5173
```

## Development Mode

In development mode, authentication is simplified:
- The server accepts a `x-mock-user-id` header for testing
- A mock user is automatically created if it doesn't exist

## Project Structure

```
DnD_Companion/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client
│   │   ├── stores/           # Zustand stores
│   │   └── types/            # TypeScript types
│   └── package.json
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── routes/           # Express route handlers
│   │   ├── services/         # Business logic
│   │   ├── websocket/        # Socket.io handlers
│   │   ├── middleware/       # Express middleware
│   │   └── lib/              # Utilities (Prisma client)
│   ├── prisma/               # Database schema
│   └── package.json
├── shared/                    # Shared TypeScript types
└── package.json              # Root package.json (workspaces)
```

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Sessions
- `GET /api/sessions?campaignId=xxx` - List sessions
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions` - Create session
- `PATCH /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Players
- `GET /api/players?campaignId=xxx` - List players
- `POST /api/players` - Create player
- `PATCH /api/players/:id` - Update player
- `PATCH /api/players/:id/hp` - Update player HP
- `DELETE /api/players/:id` - Delete player

### NPCs
- `GET /api/npcs?campaignId=xxx` - List NPCs
- `POST /api/npcs` - Create NPC
- `PATCH /api/npcs/:id` - Update NPC
- `DELETE /api/npcs/:id` - Delete NPC

### Sound Mappings
- `GET /api/sound-mappings?campaignId=xxx` - List sound mappings
- `POST /api/sound-mappings` - Create mapping
- `PATCH /api/sound-mappings/:id` - Update mapping
- `DELETE /api/sound-mappings/:id` - Delete mapping

## WebSocket Events

### Client → Server
- `authenticate` - Authenticate socket connection
- `session:start` - Start a live session
- `session:pause` - Pause transcription
- `session:resume` - Resume transcription
- `session:end` - End session and generate recap
- `audio:chunk` - Send audio data for transcription
- `speaker:attribute` - Manually correct speaker attribution
- `audio:manual-trigger` - Trigger a sound effect
- `health:confirm` - Confirm/reject health event

### Server → Client
- `authenticated` - Authentication result
- `session:started` - Session started successfully
- `session:paused` - Session paused
- `session:resumed` - Session resumed
- `session:ended` - Session ended
- `transcript:segment` - New transcript segment
- `speaker:updated` - Speaker attribution updated
- `audio:trigger` - Sound trigger event
- `health:event` - Detected health event
- `player:updated` - Player data updated
- `error` - Error message

## License

MIT


