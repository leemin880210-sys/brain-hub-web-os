# Brain Hub Web OS

Cloud-Based Multi-Agent Brain Operating System for project, client brain, task queue, event stream, handover, and runtime execution workflows.

This app stores operational data only in Supabase. The repository contains application source, SQL schema, and environment templates; it does not contain local client state, task queue, memory, or event history.

## Stack

- Next.js Web UI
- Node.js REST API via Next.js route handlers
- Supabase cloud database

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the Supabase values.
4. Install dependencies and run the app.

```bash
npm install
npm run dev
```

## Core URLs

- Dashboard: `/`
- Handover: `/handover?client_id=A001`
- Runtime step: `POST /api/runtime/step`

## Cloud Runtime Contract

The source of truth is Supabase:

- `projects`
- `client_brains`
- `task_queue`
- `event_stream`

Runtime loop:

```text
READ STATE -> GET TASK -> EXECUTE -> WRITE EVENT -> UPDATE STATE -> REPEAT
```
