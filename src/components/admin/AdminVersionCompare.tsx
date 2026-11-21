"use client";

import React, { useEffect, useState } from "react";
import { GitCompare, Loader2 } from "lucide-react";
import { VersionDiffView } from "@/components/VersionDiffView";
import type {
  ChecklistVersionRecord,
  ServiceRecord,
  VersionComparisonResult,
} from "@/lib/types";

interface AdminVersionCompareProps {
  services: ServiceRecord[];
  initialServiceId?: number;
}

export function AdminVersionCompare({
  services,
  initialServiceId,
}: AdminVersionCompareProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<number>(
    initialServiceId || services[0]?.id || 0
  );
  const [versions, setVersions] = useState<ChecklistVersionRecord[]>([]);
  const [baseId, setBaseId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");
  const [comparison, setComparison] = useState<VersionComparisonResult | null>(
    null
  );
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  useEffect(() => {
    if (!selectedServiceId) return;
    let active = true;
    async function loadVersions() {
      setLoadingVersions(true);
      setComparison(null);
      try {
        const res = await fetch(
          `/api/admin/versions?serviceId=${selectedServiceId}`
        );
        const data = await res.json();
        if (active && res.ok) {
          const list = (data.versions || []) as ChecklistVersionRecord[];
          setVersions(list);
          if (list.length >= 2) {
            // list is newest-first -> compare older (index 1) -> newer (index 0)
            setTargetId(list[0].id);
            setBaseId(list[1].id);
          } else {
            setBaseId("");
            setTargetId("");
          }
        }
      } finally {
        if (active) setLoadingVersions(false);
      }
    }
    loadVersions();
    return () => {
      active = false;
    };
  }, [selectedServiceId]);

  useEffect(() => {
    if (!baseId || !targetId) return;
    let active = true;
    async function runCompare() {
      setComparing(true);
      try {
        const res = await fetch(
          `/api/versions/compare?baseId=${baseId}&targetId=${targetId}`
        );
        const data = await res.json();
        if (active && res.ok) {
          setComparison(data.comparison);
        }
      } finally {
        if (active) setComparing(false);
      }
    }
    runCompare();
    return () => {
      active = false;
    };
  }, [baseId, targetId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <GitCompare className="h-6 w-6 text-teal-600" />
          Compare versions
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick two versions of a service to see what was added, removed or changed.
        </p>
      </div>

      {/* Selector Bar */}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.jurisdiction.split(",")[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Older version
            </label>
            <select
              value={baseId}
              disabled={versions.length < 2}
              onChange={(e) => setBaseId(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm disabled:bg-slate-100"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} [{v.status.toUpperCase()}] —{" "}
                  {v.effectiveDate}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Newer version
            </label>
            <select
              value={targetId}
              disabled={versions.length < 2}
              onChange={(e) => setTargetId(Number(e.target.value))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm disabled:bg-slate-100"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} [{v.status.toUpperCase()}] —{" "}
                  {v.effectiveDate}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadingVersions || comparing ? (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          Loading…
        </div>
      ) : versions.length < 2 ? (
        <div className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
          This service has fewer than two versions, so there's nothing to compare yet.
        </div>
      ) : comparison ? (
        <VersionDiffView comparison={comparison} />
      ) : null}
    </div>
  );
}
