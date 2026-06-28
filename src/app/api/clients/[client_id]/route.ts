import { externalBrainApi } from "@/lib/external-brain-api";
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

    return ok(await externalBrainApi(`/client/${encodeURIComponent(client_id)}`));
  } catch (error) {
    return fail("Failed to load external client state", 502, error);
  }
}
