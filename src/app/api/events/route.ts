import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();

    return ok(await externalBrainApi(`/events${query ? `?${query}` : ""}`));
  } catch (error) {
    return fail("Failed to load external events", 502, error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await externalBrainApi("/events", {
        method: "POST",
        body: JSON.stringify(await request.json())
      }),
      { status: 201 }
    );
  } catch (error) {
    return fail("Failed to write external event", 502, error);
  }
}
