# My AI Buddy - Personal Life Assistant

A privacy-first AI personal life assistant that runs locally. It records, analyzes, and summarizes your daily life using RAG (Retrieval-Augmented Generation) with a persona-aware AI buddy.

## Features

- **Dashboard** — Personalized AI welcome greeting, habit summary, to-do list, and AI-generated daily summary
- **Chat with Buddy** — Streaming AI chat with RAG-powered context, markdown rendering, abort/clear support
- **Daily Journal** — Write daily logs with mood tracking, stored as vector embeddings
- **Habit Tracker** — Log habits (Exercise, Reading, Learning, Coding) with text entries, streaks, and history. Supports logging for past dates.
- **To-do List** — Manage tasks with date picker. AI auto-extracts todos from chat and journal entries.
- **RAG Memory** — All data (chat, journal, todos, habits) stored in ChromaDB and used as context for smarter responses
- **Smart Filtering** — Buddy understands time references (yesterday, last week, 3 days ago) and filters memory by date/type
- **AI Welcome Greeting** — Dashboard shows a personalized greeting based on your recent mood and activity, cached for 4 hours and refreshed when you log new data
- **100% Local** — All data stays on your machine

## Tech Stack

- **Frontend:** Next.js + React + Tailwind CSS
- **LLM Engine:** Ollama (llama3.2)
- **Embeddings:** Ollama (nomic-embed-text)
- **Vector Database:** ChromaDB
- **Language:** TypeScript

## Prerequisites

- **Node.js** >= 20 ([download](https://nodejs.org))
- **Docker** ([download](https://www.docker.com/products/docker-desktop))
- **Ollama** ([download](https://ollama.com/download))

## Setup Guide

### 1. Install Ollama models

After installing Ollama, open a terminal and pull the required models:

```bash
# Chat model (~2GB)
ollama pull llama3.2

# Embedding model (~270MB)
ollama pull nomic-embed-text
```

Make sure Ollama is running:

```bash
ollama serve
```

### 2. Start ChromaDB

```bash
docker compose up -d
```

This starts ChromaDB with token authentication and CORS enabled on port 8000.

### 3. Configure environment

Create a `.env` file in the project root:

```bash
CHROMA_TOKEN=your-secret-token-here
```

Make sure this token matches the one in `docker-compose.yml`.

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Streaming chat API with RAG + metadata filtering
│   │   ├── greeting/route.ts   # AI welcome greeting based on recent logs
│   │   ├── habits/route.ts     # Habits CRUD (stored in ChromaDB)
│   │   ├── health/route.ts     # Service health check (Ollama + ChromaDB)
│   │   ├── journal/route.ts    # Journal CRUD (stored in ChromaDB)
│   │   └── todos/route.ts      # Todos CRUD (stored in ChromaDB)
│   ├── chat/page.tsx            # Chat page
│   ├── habits/page.tsx          # Habits page
│   ├── journal/page.tsx         # Journal page
│   ├── not-found.tsx            # 404 page
│   ├── page.tsx                 # Dashboard (home)
│   ├── layout.tsx               # Root layout with sidebar
│   └── globals.css              # Theme & styles
├── components/
│   ├── ChatView.tsx             # Chat interface with streaming + abort
│   ├── DashboardView.tsx        # Dashboard: greeting, habits, todos, summary
│   ├── HabitsView.tsx           # Habit logging, streaks, and history
│   ├── JournalView.tsx          # Journal entry form + mood selector + history
│   ├── Markdown.tsx             # Markdown renderer for AI responses
│   └── Sidebar.tsx              # Navigation sidebar with health status
└── lib/
    ├── extract-todos.ts         # AI auto-extraction of todos from messages
    ├── filter.ts                # Date/type detection for metadata filtering
    ├── greeting-cache.ts        # Greeting cache invalidation helper
    ├── memory.ts                # ChromaDB client with retry (add, query, update, delete)
    ├── ollama.ts                # Ollama client (chat, stream, embeddings)
    ├── persona.json             # AI buddy identity & user profile config
    └── prompt.ts                # System prompt & summary prompt builder
```

## How RAG Works

1. All inputs (chat, journal, todos, habits) are embedded via `nomic-embed-text` and stored in ChromaDB
2. When you ask Buddy a question, it detects date/type filters from your message
3. It performs a filtered semantic search + a broad search, merges and deduplicates results
4. Relevant context is injected into the system prompt alongside the persona profile
5. Ollama generates a response with full awareness of your history

## ChromaDB Data Schema

All data is stored in a single `daily_logs` collection:

| Field | Description |
|-------|-------------|
| `document` | Original text content |
| `embedding` | 768-dim vector from nomic-embed-text |
| `metadata.type` | `"chat"` / `"journal"` / `"todo"` / `"habit"` |
| `metadata.date` | ISO date (e.g., `2026-03-24`) for filtering |
| `metadata.timestamp` | Full ISO datetime |

Additional metadata per type:
- **chat**: `role` (assistant responses)
- **journal**: `mood`, `id`
- **todo**: `done`, `source` (manual/ai), `id`
- **habit**: `category` (Exercise/Reading/etc.), `id`
