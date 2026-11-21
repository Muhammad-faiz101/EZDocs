"use client";

import React from "react";
import type { RequirementDiffItem, VersionComparisonResult } from "@/lib/types";

interface VersionDiffViewProps {
  comparison: VersionComparisonResult;
  compact?: boolean;
}

function Group({
  title,
  count,
  border,
  children,
}: {
  title: string;
  count: number;
  border: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">
        {title} ({count})
      </h4>
      <ul className={`mt-2 space-y-4 border-l-2 pl-4 ${border}`}>{children}</ul>
    </div>
  );
}

export function VersionDiffView({
  comparison,
  compact = false,
}: VersionDiffViewProps) {
  const byType = (t: RequirementDiffItem["changeType"]) =>
    comparison.requirements.filter((r) => r.changeType === t);
  const added = byType("added");
  const removed = byType("removed");
  const modified = byType("modified");
  const unchanged = byType("unchanged");
  const { baseVersion, targetVersion, summary } = comparison;

  return (
    <div className="space-y-6 text-sm">
      <p className="text-slate-700">
        Version {baseVersion.versionNumber} → {targetVersion.versionNumber}:{" "}
        {summary.addedCount} added, {summary.removedCount} removed,{" "}
        {summary.modifiedCount} changed
        {!compact && `, ${summary.unchangedCount} unchanged`}.
      </p>

      {added.length + removed.length + modified.length === 0 && (
        <p className="text-slate-600">
          The documents are the same in both versions.
        </p>
      )}

      <Group title="Added" count={added.length} border="border-emerald-500">
        {added.map((item) => (
          <li key={item.documentCode}>
            <p className="font-medium text-slate-900">{item.title}</p>
            {item.after && (
              <>
                <p className="mt-0.5 text-slate-500">
                  {item.after.requirementType === "mandatory"
                    ? "Needed by everyone"
                    : item.after.conditionSummary}{" "}
                  · {item.after.originalOrCopy}
                </p>
                <p className="mt-1 text-slate-600">{item.after.instructions}</p>
              </>
            )}
          </li>
        ))}
      </Group>

      <Group title="Removed" count={removed.length} border="border-rose-500">
        {removed.map((item) => (
          <li key={item.documentCode}>
            <p className="font-medium text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-slate-500">No longer required.</p>
          </li>
        ))}
      </Group>

      <Group title="Changed" count={modified.length} border="border-amber-400">
        {modified.map((item) => (
          <li key={item.documentCode}>
            <p className="font-medium text-slate-900">{item.title}</p>
            <div className="mt-2 space-y-3">
              {item.fieldChanges.map((fc) => (
                <div key={fc.field}>
                  <p className="text-slate-500">{fc.label}</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-600">
                      <span className="block text-xs text-slate-500">
                        Before
                      </span>
                      {fc.before}
                    </div>
                    <div className="rounded-md bg-emerald-50 px-3 py-2 text-slate-800">
                      <span className="block text-xs text-emerald-700">
                        Now
                      </span>
                      {fc.after}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </Group>

      {comparison.questions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Question changes ({comparison.questions.length})
          </h4>
          <ul className="mt-2 space-y-1 text-slate-700">
            {comparison.questions.map((q) => (
              <li key={q.key}>
                <span className="text-slate-500">
                  {q.changeType === "added"
                    ? "New:"
                    : q.changeType === "removed"
                    ? "Removed:"
                    : "Changed:"}
                </span>{" "}
                {q.prompt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && comparison.metadataChanges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Other details
          </h4>
          <dl className="mt-2 space-y-2">
            {comparison.metadataChanges.map((mc) => (
              <div key={mc.field}>
                <dt className="text-slate-500">{mc.label}</dt>
                <dd className="text-slate-700">
                  {mc.before} → {mc.after}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {!compact && unchanged.length > 0 && (
        <details>
          <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
            {unchanged.length} unchanged
          </summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {unchanged.map((u) => (
              <li key={u.documentCode}>{u.title}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
