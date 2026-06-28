import { randomUUID } from "crypto";

import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ClientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const clientStatuses = new Set<ClientStatus>(["account_ops", "operation_ops", "evolution_ops"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientName = requireString(body.client_name, "client_name");
    const projectId = requireString(body.project_id, "project_id");
    const clientId =
      typeof body.client_id === "string" && body.client_id.trim().length > 0
        ? body.client_id.trim()
        : `C${randomUUID().slice(0, 8).toUpperCase()}`;
    const status = (body.status ?? "account_ops") as ClientStatus;

    if (!clientStatuses.has(status)) {
      return fail("Unsupported client status", 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("client_brains")
      .insert({
        client_id: clientId,
        project_id: projectId,
        name: clientName,
        status,
        current_task: ""
      })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ client: data }, { status: 201 });
  } catch (error) {
    return fail("Failed to create client", 400, error);
  }
}
