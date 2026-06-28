import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  ClientBrain,
  ClientStatus,
  EventStreamItem,
  EventType,
  ExecutionResult,
  TaskQueueItem,
  TaskStatus
} from "@/lib/types";

export const taskStatuses = new Set<TaskStatus>(["pending", "running", "done", "blocked", "failed"]);
export const eventTypes = new Set<EventType>(["execution", "chat", "update", "task_execution", "state_update"]);

const blockedAccountOpsActions = new Set([
  "analyze_account",
  "shop_account_analysis",
  "create_merchant_brain",
  "merchant_brain_factory",
  "generate_content",
  "content_pipeline",
  "publish_content",
  "data_review",
  "optimize_strategy",
  "evolution_ops"
]);

export type IncomingTask = {
  task_id?: string;
  action: string;
  input?: Record<string, unknown>;
};

export function parseIncomingTask(task: unknown, fallbackAction?: unknown): IncomingTask {
  if (typeof task === "string") {
    const action = task.trim();
    if (!action) throw new Error("task action is required");
    return { action };
  }

  if (task && typeof task === "object") {
    const taskRecord = task as Record<string, unknown>;
    const action = typeof taskRecord.action === "string" ? taskRecord.action.trim() : "";

    if (!action) throw new Error("task.action is required");

    return {
      task_id: typeof taskRecord.task_id === "string" ? taskRecord.task_id.trim() : undefined,
      action,
      input: taskRecord.input && typeof taskRecord.input === "object" ? (taskRecord.input as Record<string, unknown>) : {}
    };
  }

  if (typeof fallbackAction === "string" && fallbackAction.trim()) {
    return { action: fallbackAction.trim() };
  }

  throw new Error("task is required");
}

export function isActionAllowed(mode: ClientStatus, action: string) {
  if (mode !== "account_ops") {
    return {
      allowed: true,
      reason: ""
    };
  }

  const normalized = action.trim().toLowerCase();
  const blocked = Array.from(blockedAccountOpsActions).some((blockedAction) => normalized.includes(blockedAction));

  return {
    allowed: !blocked,
    reason: blocked ? "action_not_allowed_in_account_ops" : ""
  };
}

export async function loadClient(clientId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("client_brains")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (error || !data) {
    throw error ?? new Error("Client not found");
  }

  return data as ClientBrain;
}

export async function getNextPendingTask(clientId: string) {
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

export async function upsertRunnableTask(clientId: string, task: IncomingTask) {
  const supabase = getSupabaseAdmin();

  if (task.task_id) {
    const { data, error } = await supabase
      .from("task_queue")
      .update({ action: task.action, status: "running" })
      .eq("task_id", task.task_id)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (error) throw error;
    return data as TaskQueueItem;
  }

  const { data, error } = await supabase
    .from("task_queue")
    .insert({
      client_id: clientId,
      action: task.action,
      status: "running"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as TaskQueueItem;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { data, error } = await getSupabaseAdmin()
    .from("task_queue")
    .update({ status })
    .eq("task_id", taskId)
    .select("*")
    .single();

  if (error) throw error;
  return data as TaskQueueItem;
}

export async function updateClientCurrentTask(clientId: string, currentTask: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("client_brains")
    .update({ current_task: currentTask })
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error) throw error;
  return data as ClientBrain;
}

export async function writeEvent({
  clientId,
  type,
  input,
  output
}: {
  clientId: string;
  type: EventType;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}) {
  if (!eventTypes.has(type)) {
    throw new Error("Unsupported event type");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("event_stream")
    .insert({
      client_id: clientId,
      type,
      input: input ?? {},
      output: output ?? {}
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as EventStreamItem;
}

export async function refreshClientTaskPointer(clientId: string) {
  const nextTask = await getNextPendingTask(clientId);
  const client = await updateClientCurrentTask(clientId, nextTask?.action ?? "");

  return {
    client,
    next_task: nextTask
  };
}

export function taskStatusFromResult(result: ExecutionResult): TaskStatus {
  if (result === "success") return "done";
  return result;
}
