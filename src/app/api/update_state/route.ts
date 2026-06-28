import { fail, ok, requireString } from "@/lib/http";
import { eventTypes, taskStatuses, writeEvent } from "@/lib/runtime-api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClientStatus, EventType, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const clientStatuses = new Set<ClientStatus>(["account_ops", "operation_ops", "evolution_ops"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client_id = requireString(body.client_id, "client_id");
    const state = body.state && typeof body.state === "object" ? (body.state as Record<string, unknown>) : body;
    const clientPatch: Record<string, unknown> = {};

    if (typeof state.name === "string" && state.name.trim()) {
      clientPatch.name = state.name.trim();
    }

    if (typeof state.status === "string") {
      if (!clientStatuses.has(state.status as ClientStatus)) {
        return fail("Unsupported client status", 400);
      }
      clientPatch.status = state.status;
    }

    if (typeof state.current_task === "string") {
      clientPatch.current_task = state.current_task.trim();
    }

    if (Object.keys(clientPatch).length === 0) {
      return fail("No client state fields provided", 400);
    }

    const { data: client, error: clientError } = await getSupabaseAdmin()
      .from("client_brains")
      .update(clientPatch)
      .eq("client_id", client_id)
      .select("*")
      .single();

    if (clientError) throw clientError;

    let task = null;
    const task_id = typeof body.task_id === "string" ? body.task_id.trim() : "";
    const task_status = typeof body.task_status === "string" ? (body.task_status as TaskStatus) : undefined;

    if (task_id && task_status) {
      if (!taskStatuses.has(task_status)) {
        return fail("Unsupported task status", 400);
      }

      const taskResult = await getSupabaseAdmin()
        .from("task_queue")
        .update({ status: task_status })
        .eq("task_id", task_id)
        .eq("client_id", client_id)
        .select("*")
        .single();

      if (taskResult.error) throw taskResult.error;
      task = taskResult.data;
    }

    const eventType = (body.event_type ?? "state_update") as EventType;

    if (!eventTypes.has(eventType)) {
      return fail("Unsupported event type", 400);
    }

    const event = await writeEvent({
      clientId: client_id,
      type: eventType,
      input: {
        endpoint: "/api/update_state",
        state,
        task_id: task_id || null,
        task_status: task_status ?? null
      },
      output: {
        result: "success",
        client_state: client,
        task
      }
    });

    return ok({
      client_state: client,
      current_task: client.current_task,
      mode: client.status,
      task,
      event
    });
  } catch (error) {
    return fail("Failed to update state", 400, error);
  }
}
