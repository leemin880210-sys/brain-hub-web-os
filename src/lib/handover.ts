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
  const memoryEndpoint = `${input.baseUrl}/api/memory?client_id=${encodeURIComponent(input.client.client_id)}`;
  const memoryConfigEndpoint = `${input.baseUrl}/api/memory/config`;
  const contextPackEndpoint = `${input.baseUrl}/api/context_pack?client_id=${encodeURIComponent(input.client.client_id)}`;

  return `# 外脑系统接管协议

角色:
AI_EXECUTION_LAYER

唯一数据源:
Supabase tables: projects, client_brains, task_queue, event_stream, chat_log, decision_log, action_log, context_packs.

当前子项目:
client_id = ${input.client.client_id}
project_id = ${input.project.project_id}

接管读取顺序:
1. STATE = GET ${clientEndpoint}
2. TASK = GET ${tasksEndpoint}
3. EVENT = GET ${eventsEndpoint}
4. MEMORY = GET ${memoryEndpoint}
5. CONTEXT PACK = GET ${contextPackEndpoint}

当前状态:
${JSON.stringify(input.currentState, null, 2)}

任务队列:
${JSON.stringify(input.taskQueue, null, 2)}

最近事件:
${JSON.stringify(input.eventHistory, null, 2)}

API 接口:
读取状态 = GET ${clientEndpoint}
读取任务 = GET ${tasksEndpoint}
读取事件 = GET ${eventsEndpoint}
读取记忆 = GET ${memoryEndpoint}
读取记忆配置 = GET ${memoryConfigEndpoint}
执行任务 = POST ${executeEndpoint}
写入事件 = POST ${eventsEndpoint}
更新任务 = POST ${taskUpdateEndpoint}
接管 = POST ${handoverEndpoint}

执行循环:
READ -> EXECUTE -> ANALYZE -> WRITE MEMORY -> UPDATE STATE

强制规则:
- 不允许重置状态。
- 不允许创建本地运行状态或模拟数据。
- 必须继续现有项目、子项目状态和任务队列。
- 每次执行结果必须写入记忆。
- 每次接管必须包含 STATE + TASK + EVENT + MEMORY。`;
}
