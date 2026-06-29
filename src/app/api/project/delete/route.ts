import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_SYSTEM_ID, syncSystemBrain } from "@/lib/system-brain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = requireString(body.project_id, "project_id");
    const supabase = getSupabaseAdmin();

    const { data: existing, error: lookupError } = await supabase
      .from("projects")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return fail("Project not found", 404);
    }

    const { error } = await supabase.from("projects").delete().eq("project_id", projectId);

    if (error) throw error;
    const system_brain = await syncSystemBrain(DEFAULT_SYSTEM_ID);
    return ok({ deleted: true, project_id: projectId, system_brain });
  } catch (error) {
    return fail("Failed to delete project", 400, error);
  }
}
