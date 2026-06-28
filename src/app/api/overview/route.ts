import { fail, ok } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClientBrain, EventStreamItem, Project, TaskQueueItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [projects, clients, tasks, events] = await Promise.all([
      supabase.from("projects").select("*").order("name", { ascending: true }),
      supabase.from("client_brains").select("*").order("client_id", { ascending: true }),
      supabase.from("task_queue").select("*").order("created_at", { ascending: true }),
      supabase.from("event_stream").select("*").order("timestamp", { ascending: false }).limit(30)
    ]);

    if (projects.error) throw projects.error;
    if (clients.error) throw clients.error;
    if (tasks.error) throw tasks.error;
    if (events.error) throw events.error;

    return ok({
      projects: (projects.data ?? []) as Project[],
      clients: (clients.data ?? []) as ClientBrain[],
      tasks: (tasks.data ?? []) as TaskQueueItem[],
      recent_events: (events.data ?? []) as EventStreamItem[]
    });
  } catch (error) {
    return fail("Failed to load cloud overview", 500, error);
  }
}
