import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok, requireString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return fail("client_id is required", 400);
    }

    return ok(await externalBrainApi(`/handover?client_id=${encodeURIComponent(clientId)}`));
  } catch (error) {
    return fail("Failed to load external handover payload", 502, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = requireString(body.client_id, "client_id");

    return ok(
      await externalBrainApi("/handover", {
        method: "POST",
        body: JSON.stringify({ ...body, client_id: clientId })
      })
    );
  } catch (error) {
    return fail("Failed to request external handover", 502, error);
  }
}
