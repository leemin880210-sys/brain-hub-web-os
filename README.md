# Brain Hub Web OS

Frontend UI plus Backend API server for the AI external brain.

The UI does not use local JSON, fixture data, or static state. It calls the backend API routes, and those API routes read and write Supabase.

## Data Flow

```text
Web UI -> /api/* -> Supabase -> AI external brain
```

## Environment

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-api-domain
```

## Required API

- `GET https://leemin880210-sys.vercel.app/api/projects`
- `GET https://leemin880210-sys.vercel.app/api/clients`
- `GET https://leemin880210-sys.vercel.app/api/client/:id`
- `GET https://leemin880210-sys.vercel.app/api/tasks`
- `GET https://leemin880210-sys.vercel.app/api/events`
- `POST https://leemin880210-sys.vercel.app/api/handover`

Client takeover in the UI calls:

```text
GET https://leemin880210-sys.vercel.app/api/client/:id
GET https://leemin880210-sys.vercel.app/api/tasks?client_id=:id
GET https://leemin880210-sys.vercel.app/api/events?client_id=:id
POST https://leemin880210-sys.vercel.app/api/handover
```
