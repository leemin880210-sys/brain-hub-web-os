import { fail, ok, requireString } from "@/lib/http";
import { eventTypes, writeEvent } from "@/lib/runtime-api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { EventType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");
    const limit = Number(searchParams.get("limit") ?? 50);

    let query = getSupabaseAdmin()
      .from("event_stream")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return ok({ events: data ?? [] });
  } catch (error) {
    return fail("Failed to load events", 500, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const client_id = requireString(body.client_id, "client_id");
    const type = (body.event_type ?? body.type ?? "update") as EventType;

    if (!eventTypes.has(type)) {
      return fail("Unsupported event type", 400);
    }

    const event = await writeEvent({
      clientId: client_id,
      type,
      input: body.input ?? {},
      output: {
        ...(body.output ?? {}),
        ...(typeof body.result === "string" ? { result: body.result } : {})
      }
    });

    return ok({ event }, { status: 201 });
  } catch (error) {
    return fail("Failed to create event", 400, error);
  }
}
