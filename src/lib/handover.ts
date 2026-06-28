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
  const runtimeEndpoint = `${input.baseUrl}/api/runtime/step`;
  const clientEndpoint = `${input.baseUrl}/api/client/${input.client.client_id}`;
  const tasksEndpoint = `${input.baseUrl}/api/tasks?client_id=${encodeURIComponent(input.client.client_id)}`;
  const eventsEndpoint = `${input.baseUrl}/api/events?client_id=${encodeURIComponent(input.client.client_id)}`;
  const taskUpdateEndpoint = `${input.baseUrl}/api/tasks/update`;
  const handoverEndpoint = `${input.baseUrl}/api/handover`;

  return `# Brain Hub Web OS Handover Protocol

ROLE:
AI_EXECUTION_LAYER

SOURCE_OF_TRUTH:
External AI_MEMORY_SYSTEM API through Brain Hub Web OS REST API.

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
WRITE_EVENT = POST ${eventsEndpoint}
UPDATE_TASK = POST ${taskUpdateEndpoint}
HANDOVER = POST ${handoverEndpoint}
RUN_LOOP_STEP = POST ${runtimeEndpoint}

EXECUTION_LOOP:
READ API -> GET STATE -> GET TASK -> EXECUTE -> WRITE EVENT -> UPDATE TASK -> REPEAT

STRICT_RULES:
- Do not reset state.
- Do not create local memory, local task queues, or local state files.
- Continue the existing client state and task queue.
- Write every execution result back to the cloud event stream.
- Update cloud client state after task progress.
`;
}
