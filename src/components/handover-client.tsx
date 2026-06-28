"use client";

import { Activity, ArrowLeft, CheckCircle2, Clipboard, Database, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventStreamItem, HandoverPayload, TaskQueueItem } from "@/lib/types";

type RuntimeResponse = {
  status: string;
  phase: string;
};

const API_BASE = "https://leemin880210-sys.vercel.app/api";

function apiUrl(url: string) {
  if (url.startsWith("http")) return url;
  if (url === "/api") return API_BASE;
  if (url.startsWith("/api/")) return `${API_BASE}${url.slice(4)}`;
  return url;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), {
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

export function HandoverClient() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id") ?? "";
  const [payload, setPayload] = useState<HandoverPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      setNotice("Missing client_id");
      return;
    }

    setLoading(true);
    setNotice("");
    try {
      const handover = await fetchJson<HandoverPayload>(`/api/handover?client_id=${encodeURIComponent(clientId)}`);
      setPayload(handover);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Handover unavailable");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingTasks = useMemo(
    () => payload?.task_queue.filter((task) => task.status === "pending") ?? [],
    [payload?.task_queue]
  );
  const runningTasks = useMemo(
    () => payload?.task_queue.filter((task) => task.status === "running") ?? [],
    [payload?.task_queue]
  );

  async function runCycle() {
    if (!payload) return;

    setBusy(true);
    setNotice("");
    try {
      const result = await fetchJson<RuntimeResponse>("/api/runtime/step", {
        method: "POST",
        body: JSON.stringify({
          client_id: payload.client.client_id,
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

  async function copyProtocol() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload.handover_text);
    setNotice("Handover protocol copied");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Handover</p>
          <h1>{payload?.client.name ?? clientId}</h1>
        </div>
        <div className="topbar-actions">
          <Link className="secondary-button" href="/">
            <ArrowLeft size={17} />
            Dashboard
          </Link>
          <button className="icon-button" type="button" onClick={load} disabled={loading || busy} aria-label="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}

      <section className="handover-layout">
        <section className="panel">
          <div className="panel-title split">
            <div>
              <p className="eyebrow">Execution Mode</p>
              <h2>{payload?.client.client_id ?? "-"}</h2>
            </div>
            {payload ? <span className="status mode">{payload.client.status}</span> : null}
          </div>

          <div className="state-grid">
            <div>
              <span>Project</span>
              <strong>{payload?.project.name ?? "-"}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{pendingTasks.length}</strong>
            </div>
            <div>
              <span>Running</span>
              <strong>{runningTasks.length}</strong>
            </div>
            <div>
              <span>Current Task</span>
              <strong>{payload?.client.current_task || "Idle"}</strong>
            </div>
          </div>

          <div className="actions">
            <button className="primary-button" type="button" onClick={runCycle} disabled={!payload || busy}>
              <Play size={17} />
              Run Cycle
            </button>
            <button className="secondary-button" type="button" onClick={copyProtocol} disabled={!payload}>
              <Clipboard size={17} />
              Copy Protocol
            </button>
          </div>

          <div className="protocol-box">
            <pre>{payload?.handover_text ?? "No handover payload"}</pre>
          </div>
        </section>

        <section className="side-stack">
          <section className="panel">
            <div className="panel-title">
              <Database size={18} />
              <h2>State</h2>
            </div>
            <pre className="json-box">{JSON.stringify(payload?.current_state ?? {}, null, 2)}</pre>
          </section>

          <section className="panel">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <h2>Task Queue</h2>
            </div>
            <div className="compact-list">
              {payload?.task_queue.map((task: TaskQueueItem) => (
                <div className="compact-row" key={task.task_id}>
                  <span>{task.action}</span>
                  <span className={statusClass(task.status)}>{task.status}</span>
                </div>
              ))}
              {!loading && payload?.task_queue.length === 0 ? <p className="empty">No tasks</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <Activity size={18} />
              <h2>Events</h2>
            </div>
            <div className="compact-list">
              {payload?.event_history.slice(0, 8).map((event: EventStreamItem) => (
                <div className="compact-row" key={event.event_id}>
                  <span>{event.type}</span>
                  <span>{formatDate(event.timestamp)}</span>
                </div>
              ))}
              {!loading && payload?.event_history.length === 0 ? <p className="empty">No events</p> : null}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
