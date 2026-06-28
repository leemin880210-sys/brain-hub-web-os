import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await externalBrainApi("/projects"));
  } catch (error) {
    return fail("Failed to load external projects", 502, error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await externalBrainApi("/projects", {
        method: "POST",
        body: JSON.stringify(await request.json())
      }),
      { status: 201 }
    );
  } catch (error) {
    return fail("Failed to write external project", 502, error);
  }
}
