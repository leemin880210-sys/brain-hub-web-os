import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

function asArray(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key];
    }
    if (Array.isArray(record.data)) return record.data;
  }
  return [];
}

export async function GET() {
  try {
    const [projects, clients, tasks, events] = await Promise.all([
      externalBrainApi("/projects"),
      externalBrainApi("/clients"),
      externalBrainApi("/tasks"),
      externalBrainApi("/events")
    ]);

    return ok({
      projects: asArray(projects, ["projects", "project_brains"]),
      clients: asArray(clients, ["clients", "client_brains"]),
      tasks: asArray(tasks, ["tasks", "task_queue"]),
      recent_events: asArray(events, ["events", "event_stream", "event_history"])
    });
  } catch (error) {
    return fail("Failed to load external overview", 502, error);
  }
}
