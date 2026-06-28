import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProjectMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("projects")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return ok({ projects: data ?? [] });
  } catch (error) {
    return fail("Failed to load projects", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project_id = requireString(body.project_id, "project_id");
    const name = requireString(body.name, "name");
    const mode = (body.mode ?? "operation_system") as ProjectMode;

    if (mode !== "operation_system") {
      return fail("Unsupported project mode", 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("projects")
      .insert({ project_id, name, mode })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ project: data }, { status: 201 });
  } catch (error) {
    return fail("Failed to create project", 400, error);
  }
}
