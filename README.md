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

- `GET /api/projects`
- `GET /api/clients`
- `GET /api/client/:id`
- `GET /api/tasks`
- `GET /api/events`
- `POST /api/handover`

Client takeover in the UI calls:

```text
GET /api/client/:id
GET /api/tasks?client_id=:id
GET /api/events?client_id=:id
POST /api/handover
```
