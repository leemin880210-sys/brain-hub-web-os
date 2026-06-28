import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok, requireString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireString(body.client_id, "client_id");

    return ok(
      await externalBrainApi("/update_state", {
        method: "POST",
        body: JSON.stringify(body)
      })
    );
  } catch (error) {
    return fail("Failed to update external state", 502, error);
  }
}
