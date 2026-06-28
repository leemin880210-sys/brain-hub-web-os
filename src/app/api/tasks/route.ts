import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();

    return ok(await externalBrainApi(`/tasks${query ? `?${query}` : ""}`));
  } catch (error) {
    return fail("Failed to load external tasks", 502, error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await externalBrainApi("/tasks", {
        method: "POST",
        body: JSON.stringify(await request.json())
      }),
      { status: 201 }
    );
  } catch (error) {
    return fail("Failed to write external task", 502, error);
  }
}
