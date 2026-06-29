import { fail, ok, requireString } from "@/lib/http";
import { writeEvent } from "@/lib/runtime-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function POST(request: Request) {
  try {
    const handoff = asRecord(await request.json().catch(() => ({})));
    const state = asRecord(handoff.state);
    const clientId = requireString(handoff.client_id ?? state.client_id, "client_id");
    const summary = requireString(handoff.summary, "summary");
    const nextStep = requireString(handoff.next_step, "next_step");

    if (!Array.isArray(handoff.chat_log)) {
      return fail("chat_log is required", 400);
    }

    if (Object.keys(state).length === 0) {
      return fail("state is required", 400);
    }

    const event = await writeEvent({
      clientId,
      type: "update",
      input: {
        endpoint: "/api/handoff",
        source: "frontend_handoff_generator",
        handoff
      },
      output: {
        result: "handoff_received",
        summary,
        next_step: nextStep,
        generated_at: handoff.generated_at ?? new Date().toISOString()
      }
    });

    return ok(
      {
        received: true,
        handoff,
        event
      },
      { status: 201 }
    );
  } catch (error) {
    return fail("Failed to receive handoff", 400, error);
  }
}
