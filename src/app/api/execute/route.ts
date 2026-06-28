import { fail, ok, requireString } from "@/lib/http";
import {
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
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  let eventInput: Record<string, unknown> = {
    endpoint: "/api/execute",
    client_id: clientId,
    task: body.task ?? null
  };

  try {
    const client_id = requireString(body.client_id, "client_id");
    const task = parseIncomingTask(body.task, body.action);
    const client = await loadClient(client_id);
    const gate = isActionAllowed(client.status, task.action);
    const runningTask = await upsertRunnableTask(client_id, task);

    eventInput = {
      ...eventInput,
      loop: ["READ", "EXECUTE", "WRITE", "UPDATE"],
      mode: client.status,
      task: runningTask
    };

    await updateClientCurrentTask(client_id, runningTask.action);

    const result: ExecutionResult = gate.allowed ? "success" : "blocked";
    const output = gate.allowed
      ? body.output ?? { result: "success", message: `Executed task: ${runningTask.action}` }
      : { result: "blocked", reason: gate.reason };

    const finalTask = await updateTaskStatus(runningTask.task_id, taskStatusFromResult(result));
    const pointer = await refreshClientTaskPointer(client_id);
    const event = await writeEvent({
      clientId: client_id,
      type: "task_execution",
      input: eventInput,
      output: {
        result,
        task_id: finalTask.task_id,
        action: finalTask.action,
        mode: client.status,
        data: output
      }
    });

    return ok({
      result,
      client_state: pointer.client,
      current_task: pointer.client.current_task,
      mode: pointer.client.status,
      task: finalTask,
      next_task: pointer.next_task,
      event
    });
  } catch (error) {
    if (clientId) {
      await writeEvent({
        clientId,
        type: "task_execution",
        input: eventInput,
        output: {
          result: "failed",
          reason: error instanceof Error ? error.message : "Execution failed"
        }
      }).catch(() => null);
    }

    return fail("Task execution failed", 400, error);
  }
}
