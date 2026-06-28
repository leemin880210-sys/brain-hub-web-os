import { loadClientStatePack } from "@/lib/brain-os";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    client_id: string;
  }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    const { client_id } = await context.params;
    const statePack = await loadClientStatePack(client_id);

    return ok({
      client_state: statePack.client_state,
      current_task: statePack.client_state.current_task,
      mode: statePack.current_mode,
      project: statePack.project,
      task_queue: statePack.task_queue,
      event_stream: statePack.event_stream
    });
  } catch (error) {
    return fail("Failed to load client state", 404, error);
  }
}
