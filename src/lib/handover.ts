import type { ClientBrain, CurrentState, EventStreamItem, Project, TaskQueueItem } from "@/lib/types";

type HandoverInput = {
  baseUrl: string;
  project: Project;
  client: ClientBrain;
  currentState: CurrentState;
  taskQueue: TaskQueueItem[];
  eventHistory: EventStreamItem[];
};

export function buildHandoverText(input: HandoverInput) {
  const executeEndpoint = `${input.baseUrl}/api/execute`;
  const clientEndpoint = `${input.baseUrl}/api/client/${input.client.client_id}`;
  const tasksEndpoint = `${input.baseUrl}/api/tasks?client_id=${encodeURIComponent(input.client.client_id)}`;
  const eventsEndpoint = `${input.baseUrl}/api/events?client_id=${encodeURIComponent(input.client.client_id)}`;
  const taskUpdateEndpoint = `${input.baseUrl}/api/tasks/update`;
  const handoverEndpoint = `${input.baseUrl}/api/handover`;

  return `# Brain Hub Web OS Handover Protocol

ROLE:
AI_EXECUTION_LAYER

SOURCE_OF_TRUTH:
Supabase tables: projects, client_brains, task_queue, event_stream.

CLIENT:
client_id = ${input.client.client_id}
project_id = ${input.project.project_id}

CURRENT_STATE:
${JSON.stringify(input.currentState, null, 2)}

TASK_QUEUE:
${JSON.stringify(input.taskQueue, null, 2)}

RECENT_EVENT_HISTORY:
${JSON.stringify(input.eventHistory, null, 2)}

REST_API:
READ_STATE = GET ${clientEndpoint}
GET_TASK = GET ${tasksEndpoint}
EXECUTE_TASK = POST ${executeEndpoint}
WRITE_EVENT = POST ${eventsEndpoint}
UPDATE_TASK = POST ${taskUpdateEndpoint}
HANDOVER = POST ${handoverEndpoint}

EXECUTION_LOOP:
READ -> EXECUTE -> WRITE -> UPDATE -> LOOP

STRICT_RULES:
- Do not reset state.
- Do not create local memory, local task queues, local JSON state, or simulated data.
- Continue the existing client state and task queue.
- Write every execution result back to Supabase event_stream.
- Update Supabase client_brains and task_queue after task progress.
`;
}
