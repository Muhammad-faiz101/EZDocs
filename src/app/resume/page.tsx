"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type { ProgressSummary } from "@/lib/checklist-engine";

interface SessionRow {
  sessionCode: string;
  serviceName: string;
  jurisdiction: string;
  versionNumber: string;
  applicantLabel: string;
  isOutdated: boolean;
  latestVersionNumber: string;
  progress: ProgressSummary;
  updatedAt: string;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyChecklistsPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [deviceCodes, setDeviceCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setDeviceCodes(
        JSON.parse(localStorage.getItem("ezdocs_recent_sessions") || "[]")
      );
    } catch {
      // storage not available
    }
    async function load() {
      try {
        const res = await fetch("/api/sessions");
        const data = await res.json();
        if (res.ok) setSessions(data.sessions || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCodeError("Please enter your checklist code.");
      return;
    }
    router.push(`/checklists/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">My checklists</h1>
        <p className="mt-1 text-slate-600">
          Open a checklist you made earlier using its code.
        </p>

        <form onSubmit={handleOpen} className="mt-6">
          <label htmlFor="code" className="field-label">
            Checklist code
          </label>
          <div className="mt-1.5 flex max-w-md gap-2">
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              placeholder="e.g. EZD-HRP-1001"
              className="input font-mono uppercase"
            />
            <button type="submit" className="btn btn-primary">
              Open
            </button>
          </div>
          {codeError && (
            <p className="mt-2 text-sm text-rose-700">{codeError}</p>
          )}
        </form>

        {deviceCodes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-semibold text-slate-900">
              Opened on this device
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {deviceCodes.map((c) => (
                <li key={c}>
                  <Link
                    href={`/checklists/${encodeURIComponent(c)}`}
                    className="font-mono text-link"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-base font-semibold text-slate-900">
            Recent checklists
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No checklists yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {sessions.map((s) => (
                <li key={s.sessionCode}>
                  <Link
                    href={`/checklists/${encodeURIComponent(s.sessionCode)}`}
                    className="flex flex-col gap-1 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-2"
                  >
                    <div>
                      <p className="text-slate-900">
                        {s.applicantLabel || s.serviceName}
                      </p>
                      <p className="text-sm text-slate-500">
                        <span className="font-mono">{s.sessionCode}</span> ·{" "}
                        {s.serviceName} · Updated {formatDate(s.updatedAt)}
                      </p>
                      {s.isOutdated && (
                        <p className="text-sm text-amber-700">
                          Version {s.latestVersionNumber} is available
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 sm:text-right">
                      {s.progress.ready} of {s.progress.total} ready
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
