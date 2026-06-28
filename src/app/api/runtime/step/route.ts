import { fail, ok } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClientBrain, TaskQueueItem } from "@/lib/types";

export const dynamic = "force-dynamic";

async function insertEvent(clientId: string, input: Record<string, unknown>, output: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin()
    .from("event_stream")
    .insert({
      client_id: clientId,
      type: "execution",
      input,
      output
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function getNextPendingTask(clientId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("task_queue")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TaskQueueItem | null;
}

async function updateClientTask(clientId: string, currentTask: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("client_brains")
    .update({ current_task: currentTask })
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ClientBrain;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
    const autoComplete = body.auto_complete !== false;

    if (!clientId) {
      return fail("client_id is required", 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: client, error: clientError } = await supabase
      .from("client_brains")
      .select("*")
      .eq("client_id", clientId)
      .single();

    if (clientError || !client) {
      return fail("Client not found", 404, clientError);
    }

    const runningResult = await supabase
      .from("task_queue")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "running")
      .order("updated_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (runningResult.error) throw runningResult.error;

    const runningTask = runningResult.data as TaskQueueItem | null;

    if (runningTask && !autoComplete && !body.agent_output) {
      return ok({
        status: "running",
        phase: "EXECUTE",
        client,
        task: runningTask,
        message: "Running task is waiting for agent_output"
      });
    }

    if (runningTask) {
      const output = body.agent_output ?? {
        status: "done",
        result: `Executed task: ${runningTask.action}`
      };

      const { data: completedTask, error: taskError } = await supabase
        .from("task_queue")
        .update({ status: "done" })
        .eq("task_id", runningTask.task_id)
        .select("*")
        .single();

      if (taskError) throw taskError;

      const nextPending = await getNextPendingTask(clientId);
      const updatedClient = await updateClientTask(clientId, nextPending?.action ?? "");
      const event = await insertEvent(
        clientId,
        {
          loop: ["READ_STATE", "GET_TASK", "EXECUTE", "WRITE_EVENT", "UPDATE_STATE"],
          task: runningTask
        },
        {
          status: "done",
          output
        }
      );

      return ok({
        status: "done",
        phase: "UPDATE_STATE",
        client: updatedClient,
        task: completedTask,
        next_task: nextPending,
        event
      });
    }

    const nextTask = await getNextPendingTask(clientId);

    if (!nextTask) {
      const updatedClient = await updateClientTask(clientId, "");
      const event = await insertEvent(
        clientId,
        {
          loop: ["READ_STATE", "GET_TASK"],
          client_id: clientId
        },
        {
          status: "idle",
          reason: "task_queue_empty"
        }
      );

      return ok({
        status: "idle",
        phase: "GET_TASK",
        client: updatedClient,
        task: null,
        event
      });
    }

    const { data: running, error: startError } = await supabase
      .from("task_queue")
      .update({ status: "running" })
      .eq("task_id", nextTask.task_id)
      .select("*")
      .single();

    if (startError) throw startError;

    await updateClientTask(clientId, nextTask.action);

    const startEvent = await insertEvent(
      clientId,
      {
        loop: ["READ_STATE", "GET_TASK", "EXECUTE"],
        task: nextTask
      },
      {
        status: "running",
        action: nextTask.action
      }
    );

    if (!autoComplete) {
      return ok({
        status: "running",
        phase: "EXECUTE",
        task: running,
        event: startEvent
      });
    }

    const output = body.agent_output ?? {
      status: "done",
      result: `Executed task: ${nextTask.action}`
    };

    const { data: completedTask, error: completeError } = await supabase
      .from("task_queue")
      .update({ status: "done" })
      .eq("task_id", nextTask.task_id)
      .select("*")
      .single();

    if (completeError) throw completeError;

    const nextPending = await getNextPendingTask(clientId);
    const updatedClient = await updateClientTask(clientId, nextPending?.action ?? "");
    const doneEvent = await insertEvent(
      clientId,
      {
        loop: ["WRITE_EVENT", "UPDATE_STATE"],
        task: completedTask
      },
      {
        status: "done",
        output
      }
    );

    return ok({
      status: "done",
      phase: "UPDATE_STATE",
      client: updatedClient,
      task: completedTask,
      next_task: nextPending,
      events: [startEvent, doneEvent]
    });
  } catch (error) {
    return fail("Runtime step failed", 500, error);
  }
}
