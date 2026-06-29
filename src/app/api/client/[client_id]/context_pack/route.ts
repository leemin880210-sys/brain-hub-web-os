import { fail, ok } from "@/lib/http";
import { generateContextPack } from "@/lib/memory-engine";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    client_id: string;
  }>;
};

export async function GET(request: Request, context: Params) {
  try {
    const { client_id } = await context.params;
    const contextPack = await generateContextPack(client_id, request);

    return ok({ context_pack: contextPack });
  } catch (error) {
    return fail("Failed to load context pack", 500, error);
  }
}
