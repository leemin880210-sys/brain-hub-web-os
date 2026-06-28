import { fail, ok, requireString } from "@/lib/http";
import {
  getNextPendingTask,
  isActionAllowed,
  loadClient,
  parseIncomingTask,
  refreshClientTaskPointer,
  taskStatusFromResult,
  updateClientCurrentTask,
  updateTaskStatus,
  upsertRunnableTask,
  writeEvent
} from "@/lib/runtime-api";
import type { ExecutionResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = requireString(body.client_id, "client_id");
    const client = await loadClient(clientId);
    const pendingTask = body.task ? null : await getNextPendingTask(clientId);

    if (!body.task && !body.action && !pendingTask) {
      await updateClientCurrentTask(clientId, "");
      const event = await writeEvent({
        clientId,
        type: "execution",
        input: {
          endpoint: "/api/runtime/step",
          loop: ["READ", "EXECUTE", "WRITE", "UPDATE"],
          client_id: clientId
        },
        output: {
          result: "success",
          status: "idle",
          reason: "task_queue_empty"
        }
      });

      return ok({
        status: "idle",
        phase: "READ",
        client_state: client,
        current_task: "",
        mode: client.status,
        task: null,
        event
      });
    }

    const incomingTask = body.task
      ? parseIncomingTask(body.task, body.action)
      : {
          task_id: pendingTask?.task_id,
          action: pendingTask?.action ?? ""
        };
    const gate = isActionAllowed(client.status, incomingTask.action);
    const runningTask = await upsertRunnableTask(clientId, incomingTask);

    await updateClientCurrentTask(clientId, runningTask.action);

    const result: ExecutionResult = gate.allowed ? "success" : "blocked";
    const finalTask = await updateTaskStatus(runningTask.task_id, taskStatusFromResult(result));
    const pointer = await refreshClientTaskPointer(clientId);
    const event = await writeEvent({
      clientId,
      type: "task_execution",
      input: {
        endpoint: "/api/runtime/step",
        loop: ["READ", "EXECUTE", "WRITE", "UPDATE"],
        mode: client.status,
        task: runningTask
      },
      output: {
        result,
        task_id: finalTask.task_id,
        action: finalTask.action,
        reason: gate.reason || undefined
      }
    });

    return ok({
      status: result === "success" ? "done" : result,
      phase: "UPDATE",
      client_state: pointer.client,
      current_task: pointer.client.current_task,
      mode: pointer.client.status,
      task: finalTask,
      next_task: pointer.next_task,
      event
    });
  } catch (error) {
    return fail("Runtime step failed", 400, error);
  }
}
