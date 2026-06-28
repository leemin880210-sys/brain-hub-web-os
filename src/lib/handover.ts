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

  return `# Brain Hub Web OS 接管协议

角色:
AI_EXECUTION_LAYER

唯一数据源:
Supabase 数据表：projects, client_brains, task_queue, event_stream.

当前子脑:
client_id = ${input.client.client_id}
project_id = ${input.project.project_id}

当前状态:
${JSON.stringify(input.currentState, null, 2)}

任务队列:
${JSON.stringify(input.taskQueue, null, 2)}

最近事件:
${JSON.stringify(input.eventHistory, null, 2)}

REST_API:
READ_STATE = GET ${clientEndpoint}
GET_TASK = GET ${tasksEndpoint}
EXECUTE_TASK = POST ${executeEndpoint}
WRITE_EVENT = POST ${eventsEndpoint}
UPDATE_TASK = POST ${taskUpdateEndpoint}
HANDOVER = POST ${handoverEndpoint}

执行循环:
读取状态 -> 执行任务 -> 写入事件 -> 更新任务 -> 循环

严格规则:
- 不允许重置状态。
- 不允许创建本地记忆、本地任务队列、本地 JSON 状态或模拟数据。
- 必须继续现有子脑状态和任务队列。
- 每次执行结果必须写回 Supabase event_stream。
- 任务推进后必须更新 Supabase client_brains 和 task_queue。
`;
}
