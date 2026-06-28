# Brain Hub Web OS

Web(A) visual console for an external Brain API(B).

No project, client, task, event, or state data is stored locally. The UI calls Web(A) API routes, and those routes proxy the external AI_MEMORY_SYSTEM API.

## Environment

```env
BRAIN_API_BASE=https://your-brain-api-domain.com/api
BRAIN_API_TOKEN=
NEXT_PUBLIC_APP_URL=https://your-web-domain
```

## Web(A) API Layer

- `GET /api/projects` -> B `/projects`
- `GET /api/clients` -> B `/clients`
- `GET /api/client` -> B `/clients` or B `/client/:client_id`
- `GET /api/client/:client_id` -> B `/client/:client_id`
- `GET /api/tasks?client_id=A001` -> B `/tasks?client_id=A001`
- `GET /api/events` -> B `/events`
- `POST /api/handover` -> B `/handover`

## UI Handover Flow

Clicking a client calls:

```text
GET /api/client/:id
GET /api/tasks?client_id=:id
```

The UI displays state, task queue, event stream, and a copyable AI handover context.
