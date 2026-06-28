import { buildHandoverPayload } from "@/lib/brain-os";
import { fail, ok, requireString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    if (!clientId) {
      return fail("client_id is required", 400);
    }

    return ok(await buildHandoverPayload(clientId, request));
  } catch (error) {
    return fail("Failed to load handover payload", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientId = requireString(body.client_id, "client_id");

    return ok(await buildHandoverPayload(clientId, request));
  } catch (error) {
    return fail("Failed to create handover payload", 400, error);
  }
}
