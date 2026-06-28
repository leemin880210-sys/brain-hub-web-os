"use client";

import {
  Activity,
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
  Users2
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClientBrain, EventStreamItem, OverviewPayload, Project, TaskQueueItem } from "@/lib/types";

type RuntimeResponse = {
  status: string;
  phase: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }

  return payload as T;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "done") return "status done";
  if (status === "running") return "status running";
  if (status === "pending") return "status pending";
  return "status mode";
}

function Metric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
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

export function DashboardClient() {
  const [data, setData] = useState<OverviewPayload>({
    projects: [],
    clients: [],
    tasks: [],
    recent_events: []
  });
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [taskAction, setTaskAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const overview = await fetchJson<OverviewPayload>("/api/overview");
      setData(overview);
      setSelectedClientId((current) => current || overview.clients[0]?.client_id || "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cloud overview unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  const selectedClient = useMemo(
    () => data.clients.find((client) => client.client_id === selectedClientId) ?? data.clients[0],
    [data.clients, selectedClientId]
  );
  const selectedProject = useMemo(
    () => data.projects.find((project) => project.project_id === selectedClient?.project_id),
    [data.projects, selectedClient?.project_id]
  );
  const clientTasks = useMemo(
    () => data.tasks.filter((task) => task.client_id === selectedClient?.client_id),
    [data.tasks, selectedClient?.client_id]
  );
  const clientEvents = useMemo(
    () => data.recent_events.filter((event) => event.client_id === selectedClient?.client_id),
    [data.recent_events, selectedClient?.client_id]
  );

  const pendingCount = data.tasks.filter((task) => task.status === "pending").length;
  const runningCount = data.tasks.filter((task) => task.status === "running").length;
  const handoverLink = selectedClient
    ? `${origin}/handover?client_id=${encodeURIComponent(selectedClient.client_id)}`
    : "";

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
      setNotice("Task queued in Supabase");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  async function runCycle() {
    if (!selectedClient) return;

    setBusy(true);
    setNotice("");
    try {
      const result = await fetchJson<RuntimeResponse>("/api/runtime/step", {
        method: "POST",
        body: JSON.stringify({
          client_id: selectedClient.client_id,
          auto_complete: true
        })
      });
      setNotice(`Runtime ${result.status} at ${result.phase}`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Runtime step failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyHandoverLink() {
    if (!handoverLink) return;
    await navigator.clipboard.writeText(handoverLink);
    setNotice("Handover link copied");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cloud Runtime</p>
          <h1>Brain Hub Web OS</h1>
        </div>
        <button className="icon-button" type="button" onClick={load} disabled={loading || busy} aria-label="Refresh">
          <RefreshCw size={18} />
        </button>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}

      <section className="metric-grid" aria-label="Overview">
        <Metric icon={<Layers3 size={20} />} label="Projects" value={data.projects.length} />
        <Metric icon={<Users2 size={20} />} label="Clients" value={data.clients.length} />
        <Metric icon={<Clock3 size={20} />} label="Pending" value={pendingCount} />
        <Metric icon={<Activity size={20} />} label="Running" value={runningCount} />
      </section>

      <section className="workspace">
        <section className="panel">
          <div className="panel-title">
            <Database size={18} />
            <h2>Projects</h2>
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
            {!loading && data.projects.length === 0 ? <p className="empty">No cloud projects</p> : null}
          </div>
        </section>

        <section className="panel clients-panel">
          <div className="panel-title">
            <Users2 size={18} />
            <h2>Clients</h2>
          </div>
          <div className="client-list">
            {data.clients.map((client: ClientBrain) => (
              <button
                className={client.client_id === selectedClient?.client_id ? "client-row active" : "client-row"}
                key={client.client_id}
                type="button"
                onClick={() => setSelectedClientId(client.client_id)}
              >
                <div>
                  <strong>{client.name}</strong>
                  <span>{client.client_id}</span>
                </div>
                <div className="client-row-meta">
                  <span className="status mode">{client.status}</span>
                  <ArrowRight size={16} />
                </div>
              </button>
            ))}
            {!loading && data.clients.length === 0 ? <p className="empty">No cloud clients</p> : null}
          </div>
        </section>

        <section className="panel detail-panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">Selected Brain</p>
              <h2>{selectedClient?.name ?? "No client"}</h2>
            </div>
            {selectedClient ? <span className="status mode">{selectedClient.status}</span> : null}
          </div>

          <div className="state-grid">
            <div>
              <span>Client ID</span>
              <strong>{selectedClient?.client_id ?? "-"}</strong>
            </div>
            <div>
              <span>Project</span>
              <strong>{selectedProject?.name ?? selectedClient?.project_id ?? "-"}</strong>
            </div>
            <div className="wide">
              <span>Current Task</span>
              <strong>{selectedClient?.current_task || "Idle"}</strong>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="primary-button" onClick={runCycle} disabled={!selectedClient || busy}>
              <Play size={17} />
              Run Cycle
            </button>
            <button type="button" className="secondary-button" onClick={copyHandoverLink} disabled={!selectedClient}>
              <Copy size={17} />
              Copy Link
            </button>
            <a className="secondary-button" href={handoverLink || "#"}>
              <ExternalLink size={17} />
              Open
            </a>
          </div>

          <form className="task-form" onSubmit={createTask}>
            <input
              aria-label="Task action"
              value={taskAction}
              onChange={(event) => setTaskAction(event.target.value)}
              placeholder="Task action"
            />
            <button type="submit" className="icon-button dark" disabled={!selectedClient || busy || !taskAction.trim()}>
              <Plus size={18} />
            </button>
          </form>

          <div className="handover-strip">
            <Link2 size={17} />
            <span>{handoverLink || "No handover link"}</span>
          </div>
        </section>
      </section>

      <section className="bottom-grid">
        <section className="panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>Task Queue</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {clientTasks.map((task: TaskQueueItem) => (
                  <tr key={task.task_id}>
                    <td>{task.action}</td>
                    <td>
                      <span className={statusClass(task.status)}>{task.status}</span>
                    </td>
                    <td>{formatDate(task.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && clientTasks.length === 0 ? <p className="empty">No tasks for this client</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <Activity size={18} />
            <h2>Event Stream</h2>
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
            {!loading && clientEvents.length === 0 ? <p className="empty">No events for this client</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
