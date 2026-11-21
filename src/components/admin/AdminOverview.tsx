"use client";

import React from "react";
import Link from "next/link";
import type { ProgressSummary } from "@/lib/checklist-engine";

export interface AdminStatsData {
  stats: {
    totalServices: number;
    activeServices: number;
    servicesWithPublishedChecklist: number;
    totalDocuments: number;
    publishedVersionsCount: number;
    draftVersionsCount: number;
    totalSessions: number;
    fullyReadySessions: number;
    avgReadinessPercent: number;
    totalMissingDetected: number;
    totalNeedsVerification: number;
    totalExcludedConditional: number;
    outdatedSessions: number;
    upgradedSessionsCount: number;
  };
  recentSessions: {
    sessionCode: string;
    serviceName: string;
    serviceSlug: string;
    jurisdiction: string;
    versionNumber: string;
    applicantLabel: string;
    progress: ProgressSummary;
    isOutdated: boolean;
    parentSessionCode: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

interface AdminOverviewProps {
  data: AdminStatsData | null;
  onNavigateTab: (tab: "services" | "documents" | "versions" | "compare") => void;
}

export function AdminOverview({ data, onNavigateTab }: AdminOverviewProps) {
  if (!data) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  const { stats, recentSessions } = data;

  const figures = [
    {
      label: "Services",
      value: stats.totalServices,
      note: `${stats.servicesWithPublishedChecklist} with a published checklist`,
    },
    {
      label: "Published versions",
      value: stats.publishedVersionsCount,
      note: `${stats.draftVersionsCount} draft${
        stats.draftVersionsCount === 1 ? "" : "s"
      }`,
    },
    {
      label: "Saved checklists",
      value: stats.totalSessions,
      note: `${stats.avgReadinessPercent}% ready on average`,
    },
    {
      label: "On an older version",
      value: stats.outdatedSessions,
      note: `${stats.upgradedSessionsCount} updated copies made`,
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Overview</h1>

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white sm:grid-cols-4">
        {figures.map((f, i) => (
          <div
            key={f.label}
            className={`p-4 ${i > 0 ? "border-l border-slate-200" : ""} ${
              i === 2 ? "border-l-0 border-t sm:border-l sm:border-t-0" : ""
            } ${i === 3 ? "border-t sm:border-t-0" : ""}`}
          >
            <dt className="text-sm text-slate-500">{f.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">
              {f.value}
            </dd>
            <dd className="text-xs text-slate-500">{f.note}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => onNavigateTab("versions")}
          className="text-link"
        >
          Create a new version
        </button>
        <span className="mx-2 text-slate-300">|</span>
        <button
          type="button"
          onClick={() => onNavigateTab("compare")}
          className="text-link"
        >
          Compare versions
        </button>
        <span className="mx-2 text-slate-300">|</span>
        <button
          type="button"
          onClick={() => onNavigateTab("documents")}
          className="text-link"
        >
          Documents ({stats.totalDocuments})
        </button>
      </p>

      <h2 className="mt-10 text-base font-semibold text-slate-900">
        Recent checklists
      </h2>
      <p className="text-sm text-slate-500">
        {stats.totalMissingDetected} documents are marked missing across all
        checklists.
      </p>

      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Version</th>
              <th className="px-4 py-2.5 font-medium">Ready</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentSessions.map((s) => (
              <tr key={s.sessionCode}>
                <td className="px-4 py-3 font-mono text-slate-800">
                  {s.sessionCode}
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-800">
                    {s.applicantLabel || "—"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {s.serviceName}
                    {s.parentSessionCode &&
                      ` · updated from ${s.parentSessionCode}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {s.versionNumber}
                  {s.isOutdated && (
                    <span className="ml-2 text-xs text-amber-700">older</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {s.progress.ready}/{s.progress.total}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/checklists/${encodeURIComponent(s.sessionCode)}`}
                    className="text-link"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
