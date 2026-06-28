import { loadClientStatePack } from "@/lib/brain-os";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    client_id: string;
  }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    const { client_id } = await context.params;
    const statePack = await loadClientStatePack(client_id);

    return ok(statePack);
  } catch (error) {
    return fail("Failed to load client state pack", 404, error);
  }
}
