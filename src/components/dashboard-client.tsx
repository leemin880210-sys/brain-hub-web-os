"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  Layers3,
  Plus,
  RefreshCw,
  Trash2,
  Users2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isBusinessProject } from "@/lib/project-classification";
import type { ClientBrain, ContextPackItem, EventStreamItem, Project, TaskQueueItem } from "@/lib/types";

type ApiEnvelope<T> = T & {
  success: boolean;
  error?: string;
  details?: unknown;
};

type SystemBrain = {
  system_id: string;
  name: string;
  mode: string;
  status: string;
};

type CountPayload = {
  projects: number;
  clients: number;
  tasks: number;
  events: number;
};

type SystemPayload = {
  system: SystemBrain;
  counts: CountPayload;
};

type HealthPayload = {
  api: string;
  supabase: string;
  source: string;
  data_real: boolean;
  counts: CountPayload;
};

type CreateProjectResponse = {
  project: Project;
  created: boolean;
};

type CreateClientResponse = {
  client: ClientBrain;
};

type DeleteProjectResponse = {
  deleted: boolean;
  deleted_id: string;
  project_id: string;
};

type DeleteClientResponse = {
  deleted: boolean;
  deleted_id: string;
  client_id: string;
  project_id: string;
};

type ClientStatePack = {
  client_state?: ClientBrain;
  client?: ClientBrain;
  state?: ClientBrain;
  current_mode?: string;
  task_queue?: TaskQueueItem[];
  tasks?: TaskQueueItem[];
  event_stream?: EventStreamItem[];
  event_history?: EventStreamItem[];
  events?: EventStreamItem[];
};

type ContextPackResponse = {
  context_pack: ContextPackItem;
};

type HandoffPayload = {
  version: "handoff.v1";
  generated_at: string;
  client_id: string;
  project_id: string;
  chat_log: unknown[];
  summary: string;
  state: Record<string, unknown>;
  next_step: string;
  context_pack_id?: string;
};

type HandoffResponse = {
  received: boolean;
  handoff: HandoffPayload;
  event: EventStreamItem;
};

type DashboardData = {
  projects: Project[];
  clients: ClientBrain[];
  recent_events: EventStreamItem[];
};

type ApiStatus = {
  loading: boolean;
  apiConnected: boolean;
  supabaseConnected: boolean;
  dataReal: boolean;
  source: string;
  error: string;
};

const API_BASE = "https://leemin880210-sys.vercel.app/api";

const emptyCounts: CountPayload = {
  projects: 0,
  clients: 0,
  tasks: 0,
  events: 0
};

const defaultSystemBrain: SystemBrain = {
  system_id: "brain_os",
  name: "系统",
  mode: "cloud_brain_os",
  status: "connecting"
};

const statusText: Record<string, string> = {
  idle: "空闲",
  pending: "待处理",
  running: "进行中",
  done: "已完成",
  blocked: "已阻塞",
  failed: "失败",
  connected: "已连接",
  connecting: "连接中",
  account_ops: "采集",
  operation_ops: "执行",
  evolution_ops: "优化",
  operation_system: "运营项目",
  cloud_brain_os: "云端外脑"
};

function apiUrl(url: string) {
  if (url.startsWith("http")) return url;
  if (url === "/api") return API_BASE;
  if (url.startsWith("/api/")) return `${API_BASE}${url.slice(4)}`;
  return url;
}

function errorMessage(payload: ApiEnvelope<unknown>, fallback: string) {
  if (payload.error) return payload.error;
  if (typeof payload.details === "string") return payload.details;
  if (payload.details && typeof payload.details === "object") {
    const record = payload.details as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(url), {
    ...init,
    headers,
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({
    success: false,
    error: "接口返回不是 JSON"
  }))) as ApiEnvelope<T>;

  if (!response.ok || payload.success !== true) {
    throw new Error(errorMessage(payload, `接口请求失败：${url}`));
  }

  return payload;
}

async function tryFetchJson<T>(url: string, init?: RequestInit) {
  try {
    return await fetchJson<T>(url, init);
  } catch {
    return null;
  }
}

function asArray<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, fallback = "-") {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function displayStatus(value?: string) {
  if (!value) return "-";
  return statusText[value] ?? value;
}

function statusClass(status: string) {
  if (status === "done") return "status done";
  if (status === "running") return "status running";
  if (status === "pending") return "status pending";
  return "status mode";
}

function isVisibleProject(project: Project) {
  return isBusinessProject(project);
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusBadge({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <article className={ok ? "metric" : "metric status-error-card"}>
      <div className="metric-icon">{ok ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}</div>
      <div>
        <span>{label}</span>
        <strong>{ok ? "正常" : "等待"}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function DashboardClient() {
  const [systemBrain, setSystemBrain] = useState<SystemBrain>(defaultSystemBrain);
  const [systemCounts, setSystemCounts] = useState<CountPayload>(emptyCounts);
  const [data, setData] = useState<DashboardData>({
    projects: [],
    clients: [],
    recent_events: []
  });
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    loading: true,
    apiConnected: false,
    supabaseConnected: false,
    dataReal: false,
    source: "-",
    error: ""
  });
  const [statePack, setStatePack] = useState<ClientStatePack | null>(null);
  const [contextPack, setContextPack] = useState<ContextPackItem | null>(null);
  const [handoffJson, setHandoffJson] = useState<HandoffPayload | null>(null);
  const [handoffSentAt, setHandoffSentAt] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  const loadClientContext = useCallback(async (clientId: string) => {
    const [clientPayload, tasksPayload, eventsPayload] = await Promise.all([
      fetchJson<ClientStatePack>(`/api/client/${encodeURIComponent(clientId)}`),
      fetchJson<unknown>(`/api/tasks?client_id=${encodeURIComponent(clientId)}`),
      fetchJson<unknown>(`/api/events?client_id=${encodeURIComponent(clientId)}`)
    ]);

    setStatePack({
      ...clientPayload,
      task_queue:
        clientPayload.task_queue?.length || clientPayload.tasks?.length
          ? clientPayload.task_queue ?? clientPayload.tasks
          : asArray<TaskQueueItem>(tasksPayload, ["task_queue", "tasks"]),
      event_stream:
        clientPayload.event_stream?.length || clientPayload.event_history?.length || clientPayload.events?.length
          ? clientPayload.event_stream ?? clientPayload.event_history ?? clientPayload.events
          : asArray<EventStreamItem>(eventsPayload, ["event_stream", "event_history", "events"])
    });
  }, []);

  const load = useCallback(
    async (projectOverride?: string, clientOverride?: string) => {
      setLoading(true);
      setNotice("");
      setNoticeTone("info");

      const [systemPayload, healthPayload, projectsPayload, eventsPayload] = await Promise.all([
        tryFetchJson<SystemPayload>("/api/system"),
        tryFetchJson<HealthPayload>("/api/health"),
        tryFetchJson<unknown>("/api/projects"),
        tryFetchJson<unknown>("/api/events")
      ]);

      setApiStatus({
        loading: false,
        apiConnected: healthPayload?.api === "connected" || Boolean(systemPayload?.system),
        supabaseConnected: healthPayload?.supabase === "connected" || Boolean(systemPayload?.system),
        dataReal: healthPayload?.data_real === true || Boolean(systemPayload?.system),
        source: healthPayload?.source ?? "api",
        error: systemPayload || projectsPayload ? "" : "外脑连接中"
      });

      setSystemBrain(systemPayload?.system ?? defaultSystemBrain);

      const projects = asArray<Project>(projectsPayload, ["projects"]).filter(isVisibleProject);
      setSystemCounts({
        ...(systemPayload?.counts ?? healthPayload?.counts ?? emptyCounts),
        projects: projects.length
      });

      const nextProjectId =
        projectOverride && projects.some((project) => project.project_id === projectOverride)
          ? projectOverride
          : selectedProjectId && projects.some((project) => project.project_id === selectedProjectId)
            ? selectedProjectId
            : projects[0]?.project_id ?? "";

      const clientsPayload = nextProjectId
        ? await tryFetchJson<unknown>(`/api/clients?project_id=${encodeURIComponent(nextProjectId)}`)
        : null;
      const clients = asArray<ClientBrain>(clientsPayload, ["clients"]);
      const nextClientId =
        clientOverride && clients.some((client) => client.client_id === clientOverride)
          ? clientOverride
          : selectedClientId && clients.some((client) => client.client_id === selectedClientId)
            ? selectedClientId
            : clients[0]?.client_id ?? "";

      setData({
        projects,
        clients,
        recent_events: asArray<EventStreamItem>(eventsPayload, ["events", "event_stream", "event_history"])
      });
      setSelectedProjectId(nextProjectId);
      setSelectedClientId(nextClientId);

      if (nextClientId) {
        try {
          await loadClientContext(nextClientId);
        } catch {
          setStatePack(null);
        }
      } else {
        setStatePack(null);
      }

      setContextPack(null);
      setHandoffJson(null);
      setHandoffSentAt("");

      if (!systemPayload && !projectsPayload) {
        setNotice("外脑连接中");
      }

      setLoading(false);
    },
    [loadClientContext, selectedClientId, selectedProjectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProject = useMemo(
    () => data.projects.find((project) => project.project_id === selectedProjectId),
    [data.projects, selectedProjectId]
  );
  const selectedClient = useMemo(
    () =>
      statePack?.client_state ??
      statePack?.client ??
      statePack?.state ??
      data.clients.find((client) => client.client_id === selectedClientId) ??
      null,
    [data.clients, selectedClientId, statePack]
  );
  const clientTasks = useMemo(
    () => statePack?.task_queue ?? statePack?.tasks ?? [],
    [statePack]
  );
  const clientEvents = useMemo(
    () =>
      statePack?.event_stream ??
      statePack?.event_history ??
      statePack?.events ??
      data.recent_events.filter((event) => event.client_id === selectedClient?.client_id),
    [data.recent_events, selectedClient?.client_id, statePack]
  );

  const pack = useMemo(() => asRecord(contextPack?.pack), [contextPack]);
  const packState = useMemo(() => {
    const fromPack = asRecord(pack.state ?? pack.current_state ?? pack.client_state);
    if (Object.keys(fromPack).length > 0) return fromPack;
    return selectedClient ? asRecord(selectedClient) : {};
  }, [pack, selectedClient]);
  const packTasks = useMemo(() => {
    const tasks = asArray<TaskQueueItem>(pack.task_queue, []);
    return tasks.length ? tasks : clientTasks;
  }, [clientTasks, pack.task_queue]);
  const memorySummary = useMemo(() => {
    const memory = asRecord(pack.memory);
    return (
      textValue(memory.latest_context_pack_summary, "") ||
      textValue(contextPack?.summary, "") ||
      "暂无记忆摘要"
    );
  }, [contextPack?.summary, pack.memory]);
  const nextStep = useMemo(() => {
    const runtime = asRecord(pack.runtime_instruction);
    const instruction = asRecord(pack.EXECUTION_INSTRUCTION);
    return (
      textValue(runtime.next_action, "") ||
      textValue(instruction.command, "") ||
      textValue(pack.current_task, "") ||
      selectedClient?.current_task ||
      "等待任务"
    );
  }, [pack, selectedClient?.current_task]);

  const pendingCount = clientTasks.filter((task) => task.status === "pending").length;
  const runningCount = clientTasks.filter((task) => task.status === "running").length;

  async function createProject() {
    const nextProjectName = projectName.trim();

    if (!nextProjectName) {
      setNoticeTone("error");
      setNotice("请先填写项目名称");
      return;
    }

    setBusy(true);
    setNoticeTone("info");
    setNotice("正在创建项目...");
    try {
      const result = await fetchJson<CreateProjectResponse>("/api/project/create", {
        method: "POST",
        body: JSON.stringify({
          project_name: nextProjectName,
          system_id: "brain_os"
        })
      });
      setProjectName("");
      setSelectedProjectId(result.project.project_id);
      setSelectedClientId("");
      setContextPack(null);
      setHandoffJson(null);
      setHandoffSentAt("");
      await load(result.project.project_id, "");
      setNoticeTone("success");
      setNotice(result.created ? "项目已创建" : "项目已存在，已切换到该项目");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "项目创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(projectId: string) {
    if (!projectId) {
      setNoticeTone("error");
      setNotice("缺少项目 ID，无法删除");
      return;
    }

    setBusy(true);
    setNoticeTone("info");
    setNotice("正在删除项目...");
    try {
      const result = await fetchJson<DeleteProjectResponse>("/api/project/delete", {
        method: "DELETE",
        body: JSON.stringify({
          project_id: projectId
        })
      });

      if (!result.deleted || result.deleted_id !== projectId) {
        throw new Error("项目删除失败：接口未确认删除");
      }

      setSelectedProjectId("");
      setSelectedClientId("");
      setStatePack(null);
      setContextPack(null);
      setHandoffJson(null);
      setHandoffSentAt("");
      await load("", "");
      setNoticeTone("success");
      setNotice("项目已删除，列表已刷新");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "项目删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function createClient() {
    const nextClientName = clientName.trim();

    if (!selectedProjectId) {
      setNoticeTone("error");
      setNotice("请先选择或创建项目");
      return;
    }

    if (!nextClientName) {
      setNoticeTone("error");
      setNotice("请填写子项目名称");
      return;
    }

    setBusy(true);
    setNoticeTone("info");
    setNotice("正在创建子项目...");
    try {
      const result = await fetchJson<CreateClientResponse>("/api/client/create", {
        method: "POST",
        body: JSON.stringify({
          client_name: nextClientName,
          project_id: selectedProjectId
        })
      });
      setClientName("");
      setContextPack(null);
      setHandoffJson(null);
      setHandoffSentAt("");
      await load(selectedProjectId, result.client.client_id);
      setNoticeTone("success");
      setNotice("子项目已创建");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "子项目创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient(clientId: string) {
    if (!clientId) {
      setNoticeTone("error");
      setNotice("缺少子项目 ID，无法删除");
      return;
    }

    setBusy(true);
    setNoticeTone("info");
    setNotice("正在删除子项目...");
    try {
      const result = await fetchJson<DeleteClientResponse>("/api/client/delete", {
        method: "DELETE",
        body: JSON.stringify({
          client_id: clientId
        })
      });

      if (!result.deleted || result.deleted_id !== clientId) {
        throw new Error("子项目删除失败：接口未确认删除");
      }

      const nextProjectId = result.project_id || selectedProjectId;
      setSelectedClientId("");
      setStatePack(null);
      setContextPack(null);
      setHandoffJson(null);
      setHandoffSentAt("");
      await load(nextProjectId, "");
      setNoticeTone("success");
      setNotice("子项目已删除，列表已刷新");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "子项目删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedClientId("");
    setStatePack(null);
    setContextPack(null);
    setHandoffJson(null);
    setHandoffSentAt("");
    setNoticeTone("info");
    setNotice("正在加载子项目...");
    await load(projectId, "");
  }

  async function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setContextPack(null);
    setHandoffJson(null);
    setHandoffSentAt("");
    setBusy(true);
    setNoticeTone("info");
    setNotice("正在加载工作状态...");
    try {
      await loadClientContext(clientId);
      setNotice("");
    } catch {
      setNoticeTone("error");
      setNotice("工作状态加载失败");
    } finally {
      setBusy(false);
    }
  }

  async function fetchSelectedContextPack() {
    if (!selectedClient) {
      throw new Error("请选择子项目");
    }

    const result = await fetchJson<ContextPackResponse>(
      `/api/client/${encodeURIComponent(selectedClient.client_id)}/context_pack`
    );

    return result.context_pack;
  }

  function createHandoffPayload(sourceContextPack: ContextPackItem): HandoffPayload {
    const sourcePack = asRecord(sourceContextPack.pack);
    const sourceMemory = asRecord(sourcePack.memory);
    const sourceRuntime = asRecord(sourcePack.runtime_instruction);
    const sourceInstruction = asRecord(sourcePack.EXECUTION_INSTRUCTION);
    const sourceState = asRecord(sourcePack.state ?? sourcePack.current_state ?? sourcePack.client_state);
    const sourceTasks = asArray<TaskQueueItem>(sourcePack.task_queue, []);
    const sourceEvents = asArray<EventStreamItem>(sourcePack.event_stream, []);
    const chatLog = asArray<unknown>(sourceMemory.chat_log, []);
    const clientId = selectedClient?.client_id ?? textValue(sourceState.client_id, selectedClientId);
    const projectId = selectedProject?.project_id ?? textValue(sourceState.project_id, selectedProjectId);
    const nextAction =
      textValue(sourceRuntime.next_action, "") ||
      textValue(sourceInstruction.command, "") ||
      textValue(sourcePack.current_task, "") ||
      selectedClient?.current_task ||
      "等待任务";
    const handoffState: Record<string, unknown> = {
      ...(selectedClient ? asRecord(selectedClient) : {}),
      ...sourceState,
      client_id: clientId,
      project_id: projectId
    };
    const summaryBase =
      textValue(sourceContextPack.summary, "") ||
      textValue(sourceMemory.latest_context_pack_summary, "") ||
      `子项目 ${selectedClient?.name ?? clientId} 已生成接管包。`;
    const summary = [
      summaryBase,
      `当前状态：${displayStatus(textValue(handoffState.status, selectedClient?.status ?? "-"))}。`,
      `任务队列：${sourceTasks.length || clientTasks.length} 个任务；事件流：${sourceEvents.length || clientEvents.length} 条事件；当前对话：${chatLog.length} 条。`,
      `下一步：${nextAction}。`
    ].join("\n");

    return {
      version: "handoff.v1",
      generated_at: new Date().toISOString(),
      client_id: clientId,
      project_id: projectId,
      chat_log: chatLog,
      summary,
      state: handoffState,
      next_step: nextAction,
      context_pack_id: sourceContextPack.pack_id
    };
  }

  async function ensureHandoffPayload() {
    const sourceContextPack = contextPack ?? (await fetchSelectedContextPack());

    if (!contextPack) {
      setContextPack(sourceContextPack);
    }

    const payload = createHandoffPayload(sourceContextPack);
    setHandoffJson(payload);
    setHandoffSentAt("");
    return payload;
  }

  async function generateHandoffJson() {
    setContextLoading(true);
    setNoticeTone("info");
    setNotice("正在生成 handoff.json...");
    try {
      await ensureHandoffPayload();
      setNoticeTone("success");
      setNotice("handoff.json 已生成");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "handoff.json 生成失败");
    } finally {
      setContextLoading(false);
    }
  }

  async function sendHandoffJson() {
    if (!selectedClient) {
      setNoticeTone("error");
      setNotice("请选择子项目");
      return;
    }

    setBusy(true);
    setNoticeTone("info");
    setNotice("正在发送给外脑...");
    try {
      const payload = handoffJson ?? (await ensureHandoffPayload());
      const result = await fetchJson<HandoffResponse>("/api/handoff", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!result.received) {
        throw new Error("外脑未确认接收 handoff.json");
      }

      setHandoffJson(result.handoff ?? payload);
      setHandoffSentAt(new Date().toISOString());
      setNoticeTone("success");
      setNotice("handoff.json 已发送给外脑");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "handoff.json 发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyHandoffJson() {
    if (!handoffJson) {
      setNoticeTone("info");
      setNotice("请先生成 handoff.json");
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(handoffJson, null, 2));
    document.getElementById("handoff-json-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setNoticeTone("success");
    setNotice("当前 handoff.json 已显示并复制");
  }

  async function loadContextPack() {
    if (!selectedClient) {
      setNoticeTone("error");
      setNotice("请先选择子项目");
      return;
    }

    setContextLoading(true);
    setNoticeTone("info");
    setNotice("正在获取接管包...");
    try {
      const result = await fetchJson<ContextPackResponse>(
        `/api/client/${encodeURIComponent(selectedClient.client_id)}/context_pack`
      );
      setContextPack(result.context_pack);
      setNoticeTone("success");
      setNotice("接管包已加载");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "接管包加载失败");
    } finally {
      setContextLoading(false);
    }
  }

  async function copyContextPack() {
    if (!contextPack) return;

    await navigator.clipboard.writeText(JSON.stringify(contextPack, null, 2));
    setNoticeTone("success");
    setNotice("接管包已复制");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">外脑状态</p>
          <h1>接管控制台</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          disabled={loading || busy || contextLoading}
          aria-label="刷新"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      {notice ? (
        <div className={noticeTone === "error" ? "notice error" : noticeTone === "success" ? "notice success" : "notice"}>
          {notice}
        </div>
      ) : null}

      <section className="metric-grid" aria-label="接口状态">
        <StatusBadge
          label="接口"
          ok={apiStatus.apiConnected}
          detail={apiStatus.loading ? "连接中" : apiStatus.error || "已响应"}
        />
        <StatusBadge
          label="云数据库"
          ok={apiStatus.supabaseConnected}
          detail={apiStatus.loading ? "连接中" : apiStatus.error || "已连接"}
        />
        <Metric icon={<Layers3 size={20} />} label="项目" value={data.projects.length} />
        <Metric icon={<Users2 size={20} />} label="子项目" value={systemCounts.clients} />
      </section>

      <section className="workspace hierarchy-workspace">
        <section className="panel">
          <div className="panel-title">
            <Database size={18} />
            <h2>项目列表</h2>
          </div>

          <form
            className="create-project-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createProject();
            }}
          >
            <input
              aria-label="项目名称"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="项目名称"
            />
            <button type="button" className="primary-button" onClick={() => void createProject()} disabled={busy}>
              <Plus size={18} />
              新建项目
            </button>
          </form>

          <div className="list">
            {data.projects.map((project: Project) => (
              <div
                className={project.project_id === selectedProjectId ? "project-row project-button active" : "project-row project-button"}
                key={project.project_id}
                onClick={() => void selectProject(project.project_id)}
              >
                <div className="row-content">
                  <strong>{project.name}</strong>
                  <span>{project.project_id}</span>
                </div>
                <button
                  type="button"
                  className="row-delete-button"
                  title="删除项目"
                  data-action="delete-project"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteProject(project.project_id);
                  }}
                  disabled={busy}
                  aria-label="删除项目"
                >
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              </div>
            ))}
            {!loading && data.projects.length === 0 ? <p className="empty">暂无项目</p> : null}
          </div>
        </section>

        <section className="panel clients-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">{selectedProject?.name ?? "未选择项目"}</p>
              <h2>子项目列表</h2>
            </div>
            <span className="status mode">{data.clients.length}</span>
          </div>

          <form
            className="create-client-form compact-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createClient();
            }}
          >
            <input
              aria-label="子项目名称"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="子项目名称"
              disabled={!selectedProjectId}
            />
            <button type="button" className="primary-button" onClick={() => void createClient()} disabled={busy}>
              <Plus size={18} />
              新建子项目
            </button>
          </form>

          <div className="client-list">
            {data.clients.map((client: ClientBrain) => (
              <div
                className={client.client_id === selectedClient?.client_id ? "client-row active" : "client-row"}
                key={client.client_id}
                onClick={() => void selectClient(client.client_id)}
              >
                <div className="row-content">
                  <strong>{client.name}</strong>
                  <span>{client.client_id}</span>
                </div>
                <div className="client-row-meta">
                  <span className="status mode">{displayStatus(client.status)}</span>
                </div>
                <button
                  type="button"
                  className="row-delete-button"
                  title="删除子项目"
                  data-action="delete-client"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteClient(client.client_id);
                  }}
                  disabled={busy}
                  aria-label="删除子项目"
                >
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              </div>
            ))}
            {!loading && selectedProjectId && data.clients.length === 0 ? <p className="empty">当前项目暂无子项目</p> : null}
            {!loading && !selectedProjectId ? <p className="empty">请先选择项目</p> : null}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">工作状态</p>
              <h2>{selectedClient?.name ?? "未选择子项目"}</h2>
            </div>
            {selectedClient ? <span className="status mode">{displayStatus(selectedClient.status)}</span> : null}
          </div>

          <div className="state-grid">
            <div>
              <span>项目</span>
              <strong>{selectedProject?.name ?? "-"}</strong>
            </div>
            <div>
              <span>子项目 ID</span>
              <strong>{selectedClient?.client_id ?? "-"}</strong>
            </div>
            <div>
              <span>模式</span>
              <strong>{displayStatus(statePack?.current_mode || selectedClient?.status)}</strong>
            </div>
            <div>
              <span>任务数</span>
              <strong>{clientTasks.length}</strong>
            </div>
            <div className="wide">
              <span>当前任务</span>
              <strong>{selectedClient?.current_task || "空闲"}</strong>
            </div>
          </div>

          <div className="actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void generateHandoffJson()}
              disabled={!selectedClient || busy || contextLoading}
            >
              <Activity size={17} />
              {contextLoading ? "生成中" : "生成接管包"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void sendHandoffJson()}
              disabled={!selectedClient || busy || contextLoading}
            >
              <Database size={17} />
              发送给外脑
            </button>
            <button type="button" className="secondary-button" onClick={() => void copyHandoffJson()} disabled={!handoffJson}>
              <Copy size={17} />
              查看当前 handoff.json
            </button>
          </div>
        </section>
      </section>

      <section className="handover-grid" aria-label="接管结果">
        <section className="panel context-card">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>STATE</h2>
          </div>
          <div className="state-grid compact-state-grid">
            <div>
              <span>client_id</span>
              <strong>{textValue(packState.client_id, selectedClient?.client_id ?? "-")}</strong>
            </div>
            <div>
              <span>project_id</span>
              <strong>{textValue(packState.project_id, selectedProjectId || "-")}</strong>
            </div>
            <div>
              <span>status</span>
              <strong>{displayStatus(textValue(packState.status, selectedClient?.status ?? "-"))}</strong>
            </div>
            <div>
              <span>current_task</span>
              <strong>{textValue(packState.current_task, selectedClient?.current_task || "空闲")}</strong>
            </div>
          </div>
        </section>

        <section className="panel context-card">
          <div className="panel-title">
            <Database size={18} />
            <h2>TASK</h2>
          </div>
          <div className="context-list">
            {packTasks.map((task) => (
              <div className="compact-row" key={task.task_id}>
                <span>{task.action}</span>
                <span className={statusClass(task.status)}>{displayStatus(task.status)}</span>
              </div>
            ))}
            {!loading && packTasks.length === 0 ? <p className="empty">暂无任务</p> : null}
          </div>
        </section>

        <section className="panel context-card">
          <div className="panel-title">
            <Layers3 size={18} />
            <h2>MEMORY</h2>
          </div>
          <div className="context-summary">
            <p>{memorySummary}</p>
            {contextPack?.created_at ? <span>{formatDate(contextPack.created_at)}</span> : null}
          </div>
        </section>

        <section className="panel context-card">
          <div className="panel-title">
            <Activity size={18} />
            <h2>NEXT STEP</h2>
          </div>
          <div className="next-step-box">{nextStep}</div>
        </section>
      </section>

      <section id="handoff-json-panel" className="panel handoff-json-panel" aria-label="当前 handoff.json">
        <div className="panel-title split">
          <div>
            <p className="eyebrow">接管传递</p>
            <h2>当前 handoff.json</h2>
          </div>
          <span className="status mode">{handoffSentAt ? `已发送 ${formatDate(handoffSentAt)}` : "未发送"}</span>
        </div>
        <pre className="json-box">
          {handoffJson ? JSON.stringify(handoffJson, null, 2) : "尚未生成 handoff.json"}
        </pre>
      </section>
    </main>
  );
}
