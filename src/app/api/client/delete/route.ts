import { fail, ok, requireString } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = requireString(body.client_id, "client_id");
    const supabase = getSupabaseAdmin();

    const { data: existing, error: lookupError } = await supabase
      .from("client_brains")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return fail("Client not found", 404);
    }

    const { error } = await supabase.from("client_brains").delete().eq("client_id", clientId);

    if (error) throw error;
    return ok({ deleted: true, client_id: clientId, project_id: existing.project_id });
  } catch (error) {
    return fail("Failed to delete client", 400, error);
  }
}
