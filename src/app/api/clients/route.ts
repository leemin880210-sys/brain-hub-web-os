import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const clientStatuses = new Set<ClientStatus>(["account_ops", "operation_ops", "evolution_ops"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    const status = searchParams.get("status");
    let query = getSupabaseAdmin().from("client_brains").select("*").order("client_id", { ascending: true });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (status) {
      if (!clientStatuses.has(status as ClientStatus)) {
        return fail("Unsupported client status", 400);
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return ok({ clients: data ?? [] });
  } catch (error) {
    return fail("Failed to load clients", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client_id = requireString(body.client_id, "client_id");
    const project_id = requireString(body.project_id, "project_id");
    const name = requireString(body.name, "name");
    const status = (body.status ?? "account_ops") as ClientStatus;

    if (!clientStatuses.has(status)) {
      return fail("Unsupported client status", 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("client_brains")
      .insert({
        client_id,
        project_id,
        name,
        status,
        current_task: typeof body.current_task === "string" ? body.current_task : ""
      })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ client: data }, { status: 201 });
  } catch (error) {
    return fail("Failed to create client", 400, error);
  }
}
