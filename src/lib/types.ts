export type ProjectMode = "operation_system";
export type ClientStatus = "account_ops" | "operation_ops" | "evolution_ops";
export type TaskStatus = "pending" | "running" | "done" | "blocked" | "failed";
export type EventType = "execution" | "chat" | "update" | "task_execution" | "state_update";
export type ExecutionResult = "success" | "failed" | "blocked";

export type Project = {
  project_id: string;
  name: string;
  mode: ProjectMode;
  created_at?: string;
  updated_at?: string;
};

export type ClientBrain = {
  client_id: string;
  project_id: string;
  name: string;
  status: ClientStatus;
  current_task: string;
  created_at?: string;
  updated_at?: string;
};

export type TaskQueueItem = {
  task_id: string;
  client_id: string;
  action: string;
  status: TaskStatus;
  created_at?: string;
  updated_at?: string;
};

export type EventStreamItem = {
  event_id: string;
  client_id: string;
  type: EventType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
};

export type CurrentState = {
  client_id: string;
  project_id: string;
  name: string;
  status: ClientStatus;
  current_task: string;
};

export type OverviewPayload = {
  projects: Project[];
  clients: ClientBrain[];
  tasks: TaskQueueItem[];
  recent_events: EventStreamItem[];
};

export type HandoverPayload = {
  handover_link: string;
  handover_text: string;
  client_state: ClientBrain;
  current_mode: ClientStatus;
  project: Project;
  client: ClientBrain;
  current_state: CurrentState;
  task_queue: TaskQueueItem[];
  event_stream: EventStreamItem[];
  event_history: EventStreamItem[];
};
