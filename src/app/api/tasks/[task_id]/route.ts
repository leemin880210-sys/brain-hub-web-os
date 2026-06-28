import { externalBrainApi } from "@/lib/external-brain-api";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    task_id: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
  try {
    const { task_id } = await context.params;
    const body = await request.json();

    return ok(
      await externalBrainApi("/tasks/update", {
        method: "POST",
        body: JSON.stringify({ task_id, ...body })
      })
    );
  } catch (error) {
    return fail("Failed to update external task", 502, error);
  }
}
