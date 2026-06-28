import { fail, ok, requireString } from "@/lib/http";
import { getNextPendingTask, taskStatuses, updateClientCurrentTask } from "@/lib/runtime-api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TaskQueueItem, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const task_id = requireString(body.task_id, "task_id");
    const patch: Record<string, unknown> = {};

    if (typeof body.status === "string") {
      if (!taskStatuses.has(body.status as TaskStatus)) {
        return fail("Unsupported task status", 400);
      }
      patch.status = body.status;
    }

    if (typeof body.action === "string") {
      patch.action = body.action.trim();
    }

    if (Object.keys(patch).length === 0) {
      return fail("No task update fields provided", 400);
    }

    const { data: task, error } = await getSupabaseAdmin()
      .from("task_queue")
      .update(patch)
      .eq("task_id", task_id)
      .select("*")
      .single();

    if (error) throw error;

    const updatedTask = task as TaskQueueItem;
    const nextTask = await getNextPendingTask(updatedTask.client_id);
    const client = await updateClientCurrentTask(
      updatedTask.client_id,
      updatedTask.status === "running" ? updatedTask.action : nextTask?.action ?? ""
    );

    return ok({
      task: updatedTask,
      client,
      next_task: nextTask
    });
  } catch (error) {
    return fail("Failed to update task", 400, error);
  }
}
