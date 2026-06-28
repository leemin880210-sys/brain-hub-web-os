import { fail, ok, requireString } from "@/lib/http";
import { taskStatuses } from "@/lib/runtime-api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const status = searchParams.get("status");

    let query = getSupabaseAdmin().from("task_queue").select("*").order("created_at", { ascending: true });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (status) {
      if (!taskStatuses.has(status as TaskStatus)) {
        return fail("Unsupported task status", 400);
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return ok({ tasks: data ?? [] });
  } catch (error) {
    return fail("Failed to load tasks", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client_id = requireString(body.client_id, "client_id");
    const action = requireString(body.action, "action");
    const status = (body.status ?? "pending") as TaskStatus;

    if (!taskStatuses.has(status)) {
      return fail("Unsupported task status", 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("task_queue")
      .insert({
        client_id,
        action,
        status
      })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ task: data }, { status: 201 });
  } catch (error) {
    return fail("Failed to create task", 400, error);
  }
}
