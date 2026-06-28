import { randomUUID } from "crypto";

import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectName = requireString(body.project_name ?? body.name, "project_name");
    const projectId =
      typeof body.project_id === "string" && body.project_id.trim().length > 0
        ? body.project_id.trim()
        : `P${randomUUID().slice(0, 8).toUpperCase()}`;
    const supabase = getSupabaseAdmin();

    const { data: existingByName, error: lookupError } = await supabase
      .from("projects")
      .select("*")
      .eq("name", projectName)
      .limit(1);

    if (lookupError) throw lookupError;

    if (existingByName?.[0]) {
      return ok({ project: existingByName[0], created: false });
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        project_id: projectId,
        name: projectName,
        mode: "operation_system"
      })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ project: data, created: true }, { status: 201 });
  } catch (error) {
    return fail("Failed to create project", 400, error);
  }
}
