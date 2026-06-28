import { loadClientStatePack } from "@/lib/brain-os";
import { fail, ok } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (clientId) {
      const statePack = await loadClientStatePack(clientId);

      return ok({
        client_state: statePack.client_state,
        current_task: statePack.client_state.current_task,
        mode: statePack.current_mode,
        project: statePack.project,
        task_queue: statePack.task_queue,
        event_stream: statePack.event_stream
      });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("client_brains")
      .select("*")
      .order("client_id", { ascending: true });

    if (error) throw error;
    return ok({ clients: data ?? [] });
  } catch (error) {
    return fail("Failed to load client data", 500, error);
  }
}
