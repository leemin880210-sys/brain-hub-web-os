import { buildHandoverText } from "@/lib/handover";
import { getBaseUrl, getSupabaseAdmin } from "@/lib/supabase";
import type { ClientBrain, CurrentState, EventStreamItem, HandoverPayload, Project, TaskQueueItem } from "@/lib/types";

export type ClientStatePack = {
  client_state: ClientBrain;
  project: Project;
  task_queue: TaskQueueItem[];
  event_stream: EventStreamItem[];
  current_mode: ClientBrain["status"];
};

export async function loadClientStatePack(clientId: string, eventLimit = 100): Promise<ClientStatePack> {
  const supabase = getSupabaseAdmin();
  const { data: client, error: clientError } = await supabase
    .from("client_brains")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (clientError || !client) {
    throw clientError ?? new Error("Client not found");
  }

  const typedClient = client as ClientBrain;
  const [projectResult, tasksResult, eventsResult] = await Promise.all([
    supabase.from("projects").select("*").eq("project_id", typedClient.project_id).single(),
    supabase.from("task_queue").select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
    supabase
      .from("event_stream")
      .select("*")
      .eq("client_id", clientId)
      .order("timestamp", { ascending: false })
      .limit(eventLimit)
  ]);

  if (projectResult.error) throw projectResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (eventsResult.error) throw eventsResult.error;

  return {
    client_state: typedClient,
    project: projectResult.data as Project,
    task_queue: (tasksResult.data ?? []) as TaskQueueItem[],
    event_stream: (eventsResult.data ?? []) as EventStreamItem[],
    current_mode: typedClient.status
  };
}

export function buildCurrentState(client: ClientBrain): CurrentState {
  return {
    client_id: client.client_id,
    project_id: client.project_id,
    name: client.name,
    status: client.status,
    current_task: client.current_task
  };
}

export async function buildHandoverPayload(clientId: string, request: Request): Promise<HandoverPayload> {
  const statePack = await loadClientStatePack(clientId, 50);
  const baseUrl = getBaseUrl(request);
  const currentState = buildCurrentState(statePack.client_state);
  const handoverLink = `${baseUrl}/handover?client_id=${encodeURIComponent(clientId)}`;

  return {
    handover_link: handoverLink,
    handover_text: buildHandoverText({
      baseUrl,
      project: statePack.project,
      client: statePack.client_state,
      currentState,
      taskQueue: statePack.task_queue,
      eventHistory: statePack.event_stream
    }),
    client_state: statePack.client_state,
    current_mode: statePack.current_mode,
    project: statePack.project,
    client: statePack.client_state,
    current_state: currentState,
    task_queue: statePack.task_queue,
    event_stream: statePack.event_stream,
    event_history: statePack.event_stream
  };
}
