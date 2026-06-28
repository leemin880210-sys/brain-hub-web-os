import { fail, ok } from "@/lib/http";
import { loadSystemBrain, syncSystemBrain } from "@/lib/system-brain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const systemId = searchParams.get("system_id") ?? undefined;
    const system = await loadSystemBrain(systemId);

    return ok({
      system
    });
  } catch (error) {
    return fail("Failed to load system brain", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const systemId = typeof body.system_id === "string" && body.system_id.trim() ? body.system_id.trim() : undefined;
    const system_brain = await syncSystemBrain(systemId);
    const system = await loadSystemBrain(system_brain.system_id);

    return ok({
      system_brain,
      system
    });
  } catch (error) {
    return fail("Failed to sync system brain", 400, error);
  }
}
