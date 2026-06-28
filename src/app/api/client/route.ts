import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (clientId) {
      return ok(await externalBrainApi(`/client/${encodeURIComponent(clientId)}`));
    }

    return ok(await externalBrainApi("/clients"));
  } catch (error) {
    return fail("Failed to load external client data", 502, error);
  }
}
