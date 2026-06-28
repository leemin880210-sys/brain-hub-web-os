import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return ok(
      await externalBrainApi("/execute", {
        method: "POST",
        body: JSON.stringify(await request.json().catch(() => ({})))
      })
    );
  } catch (error) {
    return fail("External task execution failed", 502, error);
  }
}
