import { fail, ok } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const taskStatuses = new Set<TaskStatus>(["pending", "running", "done"]);

type Params = {
  params: Promise<{
    task_id: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
  try {
    const { task_id } = await context.params;
    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.action === "string") {
      patch.action = body.action.trim();
    }

    if (typeof body.status === "string") {
      if (!taskStatuses.has(body.status as TaskStatus)) {
        return fail("Unsupported task status", 400);
      }
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return fail("No task fields provided", 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("task_queue")
      .update(patch)
      .eq("task_id", task_id)
      .select("*")
      .single();

    if (error) throw error;
    return ok({ task: data });
  } catch (error) {
    return fail("Failed to update task", 400, error);
  }
}
