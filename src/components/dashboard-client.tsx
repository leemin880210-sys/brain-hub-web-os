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
  Users2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientBrain, EventStreamItem, OverviewPayload, Project, TaskQueueItem } from "@/lib/types";

type ApiEnvelope<T> = T & {
  success: boolean;
  error?: string;
  details?: unknown;
};

type HealthPayload = {
  api: string;
  supabase: string;
  source: string;
  data_real: boolean;
  counts: {
    projects: number;
    clients: number;
    tasks: number;
    events: number;
  };
};

type ExecuteResponse = {
  result: string;
};

type CreateClientResponse = {
  client: ClientBrain;
};

type ClientStatePack = {
  client_state?: ClientBrain;
  client?: ClientBrain;
  state?: ClientBrain;
  task_queue?: TaskQueueItem[];
  tasks?: TaskQueueItem[];
  event_stream?: EventStreamItem[];
  event_history?: EventStreamItem[];
  events?: EventStreamItem[];
};

type ApiStatus = {
  loading: boolean;
  apiConnected: boolean;
  supabaseConnected: boolean;
  dataReal: boolean;
  source: string;
  error: string;
  counts: HealthPayload["counts"];
};

const API_BASE = "https://leemin880210-sys.vercel.app/api";

const statusText: Record<string, string> = {
  idle: "空闲",
  pending: "待处理",
  running: "执行中",
  done: "已完成",
  blocked: "已阻塞",
  failed: "失败",
  account_ops: "采集模式",
  operation_ops: "执行模式",
  evolution_ops: "优化模式"
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
  const [data, setData] = useState<OverviewPayload>({
    projects: [],
    clients: [],
    tasks: [],
    recent_events: []
  });
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    loading: true,
    apiConnected: false,
    supabaseConnected: false,
    dataReal: false,
    source: "-",
    error: "",
    counts: {
      projects: 0,
      clients: 0,
      tasks: 0,
      events: 0
    }
  });
  const [statePack, setStatePack] = useState<ClientStatePack | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientProjectId, setClientProjectId] = useState("");
  const [taskAction, setTaskAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  const refreshHealth = useCallback(async () => {
    setApiStatus((current) => ({ ...current, loading: true }));
    try {
      const health = await fetchJson<HealthPayload>("/api/health");
      setApiStatus({
        loading: false,
        apiConnected: health.api === "connected",
        supabaseConnected: health.supabase === "connected",
        dataReal: health.data_real === true,
        source: health.source,
        error: "",
        counts: health.counts
      });
    } catch (error) {
      setApiStatus((current) => ({
        ...current,
        loading: false,
        apiConnected: false,
        supabaseConnected: false,
        dataReal: false,
        error: error instanceof Error ? error.message : "外脑连接中..."
      }));
      throw error;
    }
  }, []);

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

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      await refreshHealth();
      const [projectsPayload, clientsPayload, tasksPayload, eventsPayload] = await Promise.all([
        fetchJson<unknown>("/api/projects"),
        fetchJson<unknown>("/api/clients"),
        fetchJson<unknown>("/api/tasks"),
        fetchJson<unknown>("/api/events")
      ]);
      const overview: OverviewPayload = {
        projects: asArray<Project>(projectsPayload, ["projects"]),
        clients: asArray<ClientBrain>(clientsPayload, ["clients"]),
        tasks: asArray<TaskQueueItem>(tasksPayload, ["tasks", "task_queue"]),
        recent_events: asArray<EventStreamItem>(eventsPayload, ["events", "event_stream", "event_history"])
      };
      setData(overview);
      setClientProjectId((current) => current || overview.projects[0]?.project_id || "");

      const nextClientId = selectedClientId || overview.clients[0]?.client_id || "";
      setSelectedClientId(nextClientId);
      if (nextClientId) {
        await loadClientContext(nextClientId);
      } else {
        setStatePack(null);
      }
    } catch {
      setNotice("外脑连接中...");
    } finally {
      setLoading(false);
    }
  }, [loadClientContext, refreshHealth, selectedClientId]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  const selectedClient = useMemo(
    () =>
      statePack?.client_state ??
      statePack?.client ??
      statePack?.state ??
      data.clients.find((client) => client.client_id === selectedClientId) ??
      data.clients[0],
    [data.clients, selectedClientId, statePack]
  );
  const selectedProject = useMemo(
    () => data.projects.find((project) => project.project_id === selectedClient?.project_id),
    [data.projects, selectedClient?.project_id]
  );
  const clientTasks = useMemo(
    () =>
      statePack?.task_queue ??
      statePack?.tasks ??
      data.tasks.filter((task) => task.client_id === selectedClient?.client_id),
    [data.tasks, selectedClient?.client_id, statePack]
  );
  const clientEvents = useMemo(
    () =>
      statePack?.event_stream ??
      statePack?.event_history ??
      statePack?.events ??
      data.recent_events.filter((event) => event.client_id === selectedClient?.client_id),
    [data.recent_events, selectedClient?.client_id, statePack]
  );

  const pendingCount = data.tasks.filter((task) => task.status === "pending").length;
  const runningCount = data.tasks.filter((task) => task.status === "running").length;
  const handoverLink = selectedClient
    ? `${origin}/handover?client_id=${encodeURIComponent(selectedClient.client_id)}`
    : "";
  const createProjectId = clientProjectId || data.projects[0]?.project_id || "";

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextClientName = clientName.trim();

    if (!nextClientName || !createProjectId) {
      setNotice("请填写副脑名称并选择所属项目");
      return;
    }

    setBusy(true);
    setNotice("外脑连接中...");
    try {
      await fetchJson<CreateClientResponse>("/api/client/create", {
        method: "POST",
        body: JSON.stringify({
          client_name: nextClientName,
          project_id: createProjectId
        })
      });
      setClientName("");
      setNotice("副脑已创建");
      await load();
    } catch {
      setNotice("外脑连接中...");
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
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "任务创建失败");
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
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "执行失败");
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "接管失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setBusy(true);
    setNotice("");
    try {
      await loadClientContext(clientId);
      setNotice(`已加载子脑：${clientId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "子脑加载失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">外脑 API 实时校验</p>
          <h1>Brain Hub 外脑控制台</h1>
        </div>
        <button className="icon-button" type="button" onClick={load} disabled={loading || busy} aria-label="刷新">
          <RefreshCw size={18} />
        </button>
      </header>

      {notice ? <div className={apiStatus.apiConnected ? "notice" : "notice error"}>{notice}</div> : null}

      <section className="metric-grid" aria-label="API 状态">
        <StatusBadge
          label="后端 API"
          ok={apiStatus.apiConnected}
          detail={apiStatus.loading ? "连接中..." : apiStatus.error || "健康检查通过"}
        />
        <StatusBadge
          label="Supabase"
          ok={apiStatus.supabaseConnected}
          detail={apiStatus.loading ? "连接中..." : apiStatus.error || "云数据库查询成功"}
        />
        <StatusBadge
          label="真实数据"
          ok={apiStatus.dataReal}
          detail={
            apiStatus.loading
              ? "连接中..."
              : `来源=${apiStatus.source}；项目=${apiStatus.counts.projects}；子脑=${apiStatus.counts.clients}；任务=${apiStatus.counts.tasks}`
          }
        />
        <Metric icon={<Server size={20} />} label="事件数" value={apiStatus.counts.events} />
      </section>

      <section className="metric-grid" aria-label="总览">
        <Metric icon={<Layers3 size={20} />} label="项目" value={data.projects.length} />
        <Metric icon={<Users2 size={20} />} label="子脑" value={data.clients.length} />
        <Metric icon={<Clock3 size={20} />} label="待处理" value={pendingCount} />
        <Metric icon={<Activity size={20} />} label="执行中" value={runningCount} />
      </section>

      <section className="panel create-client-panel">
        <div className="panel-title">
          <Users2 size={18} />
          <h2>新建副脑</h2>
        </div>
        <form className="create-client-form" onSubmit={createClient}>
          <input
            aria-label="副脑名称"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="副脑名称"
          />
          <select
            aria-label="所属项目"
            value={createProjectId}
            onChange={(event) => setClientProjectId(event.target.value)}
            disabled={!data.projects.length}
          >
            {data.projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.name || project.project_id}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-button" disabled={busy || !clientName.trim() || !createProjectId}>
            <Plus size={18} />
            新建副脑
          </button>
        </form>
      </section>

      <section className="workspace">
        <section className="panel">
          <div className="panel-title">
            <Database size={18} />
            <h2>项目列表</h2>
          </div>
          <div className="list">
            {data.projects.map((project: Project) => (
              <div className="project-row" key={project.project_id}>
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.project_id}</span>
                </div>
                <span className="status mode">{project.mode}</span>
              </div>
            ))}
            {!loading && data.projects.length === 0 ? <p className="empty">暂无项目</p> : null}
          </div>
        </section>

        <section className="panel clients-panel">
          <div className="panel-title">
            <Users2 size={18} />
            <h2>子脑列表</h2>
          </div>
          <div className="client-list">
            {data.clients.map((client: ClientBrain) => (
              <button
                className={client.client_id === selectedClient?.client_id ? "client-row active" : "client-row"}
                key={client.client_id}
                type="button"
                onClick={() => void selectClient(client.client_id)}
              >
                <div>
                  <strong>{client.name}</strong>
                  <span>{client.client_id}</span>
                </div>
                <div className="client-row-meta">
                  <span className="status mode">{displayStatus(client.status)}</span>
                  <ArrowRight size={16} />
                </div>
              </button>
            ))}
            {!loading && data.clients.length === 0 ? <p className="empty">暂无子脑</p> : null}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">当前子脑</p>
              <h2>{selectedClient?.name ?? "未选择子脑"}</h2>
            </div>
            {selectedClient ? <span className="status mode">{displayStatus(selectedClient.status)}</span> : null}
          </div>

          <div className="state-grid">
            <div>
              <span>子脑 ID</span>
              <strong>{selectedClient?.client_id ?? "-"}</strong>
            </div>
            <div>
              <span>所属项目</span>
              <strong>{selectedProject?.name ?? selectedClient?.project_id ?? "-"}</strong>
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
            {!loading && clientTasks.length === 0 ? <p className="empty">暂无任务</p> : null}
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
            {!loading && clientEvents.length === 0 ? <p className="empty">暂无事件</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
