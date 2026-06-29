"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Layers3,
  Link2,
  Play,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Users2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientBrain, EventStreamItem, Project, TaskQueueItem } from "@/lib/types";

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

type ExecuteResponse = {
  result: string;
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
  project_id: string;
};

type DeleteClientResponse = {
  deleted: boolean;
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
  running: "执行中",
  done: "已完成",
  blocked: "已阻塞",
  failed: "失败",
  connected: "已连接",
  connecting: "连接中",
  account_ops: "采集模式",
  operation_ops: "执行模式",
  evolution_ops: "优化模式",
  operation_system: "运营系统",
  cloud_brain_os: "云端外脑系统"
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

function isVisibleProject(project: Project) {
  const value = `${project.project_id ?? ""} ${project.name ?? ""}`.toLowerCase();
  const temporaryMarker = ["project", "create", "smoke"].join("_");
  return !value.includes(temporaryMarker);
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
        <strong>{ok ? "正常" : "异常"}</strong>
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
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [taskAction, setTaskAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");
  const [origin, setOrigin] = useState("");

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
        error: systemPayload || projectsPayload ? "" : "外脑连接中..."
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

      if (!systemPayload && !projectsPayload) {
        setNotice("外脑连接中...");
      }

      setLoading(false);
    },
    [loadClientContext, selectedClientId, selectedProjectId]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
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

  const pendingCount = clientTasks.filter((task) => task.status === "pending").length;
  const runningCount = clientTasks.filter((task) => task.status === "running").length;
  const handoverLink = selectedClient
    ? `${origin}/handover?client_id=${encodeURIComponent(selectedClient.client_id)}`
    : "";

  async function createProject() {
    const nextProjectName = projectName.trim();

    if (!nextProjectName) {
      setNotice("请先填写项目名称");
      return;
    }

    setBusy(true);
    setNotice("外脑连接中...");
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
      setNotice(result.created ? "项目已创建" : "项目已存在，已切换到该项目");
      await load(result.project.project_id, "");
    } catch (error) {
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
        method: "POST",
        body: JSON.stringify({
          project_id: projectId
        })
      });

      if (!result.deleted) {
        throw new Error("项目删除失败：接口未确认删除");
      }

      setData((current) => ({
        ...current,
        projects: current.projects.filter((project) => project.project_id !== projectId),
        clients: []
      }));
      setSelectedProjectId("");
      setSelectedClientId("");
      setStatePack(null);
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
      setNotice("请先选择或创建项目");
      return;
    }

    if (!nextClientName) {
      setNotice("请填写子项目名称");
      return;
    }

    setBusy(true);
    setNotice("外脑连接中...");
    try {
      const result = await fetchJson<CreateClientResponse>("/api/client/create", {
        method: "POST",
        body: JSON.stringify({
          client_name: nextClientName,
          project_id: selectedProjectId
        })
      });
      setClientName("");
      setNotice("子项目已创建");
      await load(selectedProjectId, result.client.client_id);
    } catch (error) {
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
        method: "POST",
        body: JSON.stringify({
          client_id: clientId
        })
      });

      if (!result.deleted) {
        throw new Error("子项目删除失败：接口未确认删除");
      }

      const nextProjectId = result.project_id || selectedProjectId;
      setData((current) => ({
        ...current,
        clients: current.clients.filter((client) => client.client_id !== clientId)
      }));
      setSelectedClientId("");
      setStatePack(null);
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
    setNotice("外脑连接中...");
    await load(projectId, "");
  }

  async function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setBusy(true);
    setNotice("");
    try {
      await loadClientContext(clientId);
      setNotice(`已加载子项目：${clientId}`);
    } catch {
      setNotice("子项目加载失败");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClient || taskAction.trim().length === 0) return;

    setBusy(true);
    setNotice("");
    try {
      await fetchJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          client_id: selectedClient.client_id,
          action: taskAction.trim()
        })
      });
      setTaskAction("");
      setNotice("任务已写入云端");
      await load(selectedProjectId, selectedClient.client_id);
    } catch {
      setNotice("任务创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function executeTask() {
    if (!selectedClient) return;

    setBusy(true);
    setNotice("");
    try {
      const action = selectedClient.current_task || clientTasks.find((task) => task.status === "pending")?.action;
      const result = await fetchJson<ExecuteResponse>("/api/execute", {
        method: "POST",
        body: JSON.stringify({
          client_id: selectedClient.client_id,
          task: {
            action: action || "collect_client_info"
          }
        })
      });
      setNotice(`执行结果：${result.result}`);
      await load(selectedProjectId, selectedClient.client_id);
    } catch {
      setNotice("执行失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyHandoverContext() {
    if (!selectedClient) return;

    setBusy(true);
    setNotice("");
    try {
      const handover = await fetchJson<Record<string, unknown>>("/api/handover", {
        method: "POST",
        body: JSON.stringify({ client_id: selectedClient.client_id })
      });
      const handoverText =
        typeof handover.handover_text === "string" ? handover.handover_text : JSON.stringify(handover, null, 2);

      await navigator.clipboard.writeText(handoverText);
      setNotice("接管上下文已复制");
    } catch {
      setNotice("接管失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">外脑 API 可视化控制台</p>
          <h1>外脑控制台</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void load()}
          disabled={loading || busy}
          aria-label="刷新"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      {notice ? <div className={noticeTone === "error" ? "notice error" : noticeTone === "success" ? "notice success" : "notice"}>{notice}</div> : null}

      <section className="metric-grid" aria-label="API 状态">
        <StatusBadge
          label="后端 API"
          ok={apiStatus.apiConnected}
          detail={apiStatus.loading ? "连接中..." : apiStatus.error || "系统接口已响应"}
        />
        <StatusBadge
          label="Supabase"
          ok={apiStatus.supabaseConnected}
          detail={apiStatus.loading ? "连接中..." : apiStatus.error || "云数据库已连接"}
        />
        <StatusBadge
          label="真实数据"
          ok={apiStatus.dataReal}
          detail={
            apiStatus.loading
              ? "连接中..."
              : `来源=${apiStatus.source}；项目=${systemCounts.projects}；子项目=${systemCounts.clients}`
          }
        />
        <Metric icon={<Server size={20} />} label="事件数" value={systemCounts.events} />
      </section>

      <section className="system-panel panel">
        <div className="panel-title split">
          <div>
            <p className="eyebrow">SYSTEM</p>
            <h2>系统</h2>
          </div>
          <span className="status mode">{displayStatus(systemBrain.status)}</span>
        </div>
        <div className="state-grid system-state-grid">
          <div>
            <span>系统 ID</span>
            <strong>{systemBrain.system_id}</strong>
          </div>
          <div>
            <span>系统模式</span>
            <strong>{displayStatus(systemBrain.mode)}</strong>
          </div>
          <div>
            <span>项目总数</span>
            <strong>{systemCounts.projects}</strong>
          </div>
          <div>
            <span>子项目总数</span>
            <strong>{systemCounts.clients}</strong>
          </div>
        </div>
      </section>

      <div className="hierarchy-arrow">↓</div>

      <section className="metric-grid" aria-label="当前层级数据">
        <Metric icon={<Layers3 size={20} />} label="当前项目数" value={data.projects.length} />
        <Metric icon={<Users2 size={20} />} label="当前项目子项目" value={data.clients.length} />
        <Metric icon={<Clock3 size={20} />} label="当前待处理" value={pendingCount} />
        <Metric icon={<Activity size={20} />} label="当前执行中" value={runningCount} />
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
                <span className="status mode">{displayStatus(project.mode)}</span>
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
            {!loading && data.projects.length === 0 ? <p className="empty">暂无项目，请先新建项目</p> : null}
          </div>
        </section>

        <section className="panel clients-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">归属于项目</p>
              <h2>子项目列表</h2>
            </div>
            <span className="status mode">{selectedProject?.project_id ?? "未选择项目"}</span>
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
            <button
              type="button"
              className="primary-button"
              onClick={() => void createClient()}
              disabled={busy}
            >
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
                  <ArrowRight size={16} />
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
            {!loading && !selectedProjectId ? <p className="empty">请先选择或创建项目</p> : null}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">当前子项目</p>
              <h2>{selectedClient?.name ?? "未选择子项目"}</h2>
            </div>
            {selectedClient ? <span className="status mode">{displayStatus(selectedClient.status)}</span> : null}
          </div>

          <div className="state-grid">
            <div>
              <span>所属 SYSTEM</span>
              <strong>{systemBrain.system_id}</strong>
            </div>
            <div>
              <span>所属项目</span>
              <strong>{(selectedProject?.name ?? selectedProjectId) || "-"}</strong>
            </div>
            <div>
              <span>子项目 ID</span>
              <strong>{selectedClient?.client_id ?? "-"}</strong>
            </div>
            <div>
              <span>当前模式</span>
              <strong>{displayStatus(statePack?.current_mode || selectedClient?.status)}</strong>
            </div>
            <div className="wide">
              <span>当前任务</span>
              <strong>{selectedClient?.current_task || "空闲"}</strong>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="primary-button" onClick={executeTask} disabled={!selectedClient || busy}>
              <Play size={17} />
              执行任务
            </button>
            <button type="button" className="secondary-button" onClick={copyHandoverContext} disabled={!selectedClient}>
              <Copy size={17} />
              复制接管
            </button>
            <a className="secondary-button" href={handoverLink || "#"}>
              <ExternalLink size={17} />
              打开
            </a>
          </div>

          <form className="task-form" onSubmit={createTask}>
            <input
              aria-label="任务动作"
              value={taskAction}
              onChange={(event) => setTaskAction(event.target.value)}
              placeholder="任务动作"
            />
            <button type="submit" className="icon-button dark" disabled={!selectedClient || busy || !taskAction.trim()}>
              <Plus size={18} />
            </button>
          </form>

          <div className="handover-strip">
            <Link2 size={17} />
            <span>{handoverLink || "暂无接管链接"}</span>
          </div>
        </section>
      </section>

      <div className="hierarchy-arrow">↓</div>

      <section className="bottom-grid">
        <section className="panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>任务队列</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {clientTasks.map((task: TaskQueueItem) => (
                  <tr key={task.task_id}>
                    <td>{task.action}</td>
                    <td>
                      <span className={statusClass(task.status)}>{displayStatus(task.status)}</span>
                    </td>
                    <td>{formatDate(task.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && clientTasks.length === 0 ? <p className="empty">当前子项目暂无任务</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <Activity size={18} />
            <h2>事件流</h2>
          </div>
          <div className="event-list">
            {clientEvents.map((event: EventStreamItem) => (
              <div className="event-row" key={event.event_id}>
                <div>
                  <strong>{event.type}</strong>
                  <span>{formatDate(event.timestamp)}</span>
                </div>
                <code>{JSON.stringify(event.output)}</code>
              </div>
            ))}
            {!loading && clientEvents.length === 0 ? <p className="empty">当前子项目暂无事件</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
