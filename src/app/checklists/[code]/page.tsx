"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VersionDiffView } from "@/components/VersionDiffView";
import { calculateChecklistProgress } from "@/lib/checklist-engine";
import { downloadChecklistPdf } from "@/lib/pdf-generator";
import type {
  ChecklistItemStatus,
  ChecklistSessionItem,
  ChecklistSessionRecord,
  QuestionDefinition,
  VersionComparisonResult,
} from "@/lib/types";

interface UpdateInfo {
  latestVersionId: number;
  latestVersionNumber: string;
  latestEffectiveDate: string;
  latestPublishedAt: string | null;
  changelogSummary: string;
  diffSummary: VersionComparisonResult["summary"];
  comparison: VersionComparisonResult;
}

interface UpgradedChildRef {
  sessionCode: string;
  versionNumber: string;
  createdAt: string;
}

const STATUS_OPTIONS: {
  value: ChecklistItemStatus;
  label: string;
  active: string;
}[] = [
  { value: "ready", label: "Ready", active: "bg-emerald-600 text-white" },
  {
    value: "needs_verification",
    label: "Needs checking",
    active: "bg-amber-500 text-white",
  },
  { value: "missing", label: "Missing", active: "bg-rose-600 text-white" },
];

const DOT: Record<ChecklistItemStatus, string> = {
  ready: "bg-emerald-500",
  needs_verification: "bg-amber-400",
  missing: "bg-rose-500",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ChecklistPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const rawCode = decodeURIComponent(params.code || "");

  const [session, setSession] = useState<ChecklistSessionRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionDefinition[]>([]);
  const [isOutdated, setIsOutdated] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [upgradedSessions, setUpgradedSessions] = useState<UpgradedChildRef[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | ChecklistItemStatus>(
    "all"
  );
  const [showDiff, setShowDiff] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(rawCode)}`);
        const data = await res.json();
        if (res.status === 404) {
          if (active) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Could not load checklist.");
        if (active) {
          setSession(data.session);
          setQuestions(data.questions || []);
          setIsOutdated(Boolean(data.isOutdated));
          setUpdateInfo(data.updateInfo || null);
          setUpgradedSessions(data.upgradedSessions || []);

          const notes: Record<string, string> = {};
          for (const item of data.session.itemsJson as ChecklistSessionItem[]) {
            notes[item.requirementId] = item.citizenNote || "";
          }
          setNoteDrafts(notes);

          try {
            const stored = JSON.parse(
              localStorage.getItem("ezdocs_recent_sessions") || "[]"
            ) as string[];
            const next = [
              data.session.sessionCode,
              ...stored.filter((c) => c !== data.session.sessionCode),
            ].slice(0, 10);
            localStorage.setItem("ezdocs_recent_sessions", JSON.stringify(next));
          } catch {
            // storage not available
          }
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load checklist.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [rawCode]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 2500);
  };

  const progress = useMemo(
    () => calculateChecklistProgress(session?.itemsJson ?? []),
    [session]
  );

  const outstanding = useMemo(
    () => (session?.itemsJson ?? []).filter((i) => i.status !== "ready"),
    [session]
  );

  const filteredItems = useMemo(() => {
    if (!session) return [];
    if (statusFilter === "all") return session.itemsJson;
    return session.itemsJson.filter((i) => i.status === statusFilter);
  }, [session, statusFilter]);

  const mandatoryItems = filteredItems.filter(
    (i) => i.requirementType === "mandatory"
  );
  const conditionalItems = filteredItems.filter(
    (i) => i.requirementType === "conditional"
  );

  const updateItemStatus = async (
    requirementId: string,
    newStatus: ChecklistItemStatus
  ) => {
    if (!session) return;
    const prevItems = session.itemsJson;
    setSession({
      ...session,
      itemsJson: prevItems.map((i) =>
        i.requirementId === requirementId ? { ...i, status: newStatus } : i
      ),
    });
    setSavingId(requirementId);
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(session.sessionCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirementId, status: newStatus }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error();
      setSession(data.session);
      showToast("Saved");
    } catch {
      setSession({ ...session, itemsJson: prevItems });
      showToast("Couldn't save. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const saveItemNote = async (requirementId: string) => {
    if (!session) return;
    setSavingId(requirementId);
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(session.sessionCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirementId,
            citizenNote: noteDrafts[requirementId] ?? "",
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        showToast("Note saved");
      } else {
        showToast("Couldn't save the note.");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleUpgrade = async () => {
    if (!session) return;
    setUpgrading(true);
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(session.sessionCode)}/upgrade`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the update.");
      router.push(`/checklists/${encodeURIComponent(data.session.sessionCode)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't create the update.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.sessionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(`Your code is ${session.sessionCode}`);
    }
  };

  const renderItem = (item: ChecklistSessionItem) => {
    const isSaving = savingId === item.requirementId;
    const draft = noteDrafts[item.requirementId] ?? "";
    const noteChanged = draft !== (item.citizenNote ?? "");

    return (
      <li
        key={item.requirementId}
        id={`doc-${item.requirementId}`}
        className="scroll-mt-6 py-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${DOT[item.status]}`}
              aria-hidden="true"
            />
            <div>
              <h3 className="font-medium text-slate-900">{item.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {item.originalOrCopy}
                {item.verificationStatus === "illustrative" &&
                  " · Sample requirement"}
              </p>
            </div>
          </div>

          <div
            className="inline-flex shrink-0 self-start overflow-hidden rounded-md border border-slate-300 text-xs sm:ml-4"
            role="group"
            aria-label={`Status for ${item.title}`}
          >
            {STATUS_OPTIONS.map((opt, idx) => (
              <button
                key={opt.value}
                type="button"
                disabled={isSaving}
                aria-pressed={item.status === opt.value}
                onClick={() => updateItemStatus(item.requirementId, opt.value)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  idx > 0 ? "border-l border-slate-300" : ""
                } ${
                  item.status === opt.value
                    ? opt.active
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 pl-5 text-sm">
          {item.requirementType === "conditional" && (
            <p className="text-teal-800">
              Based on your answers: {item.conditionSummary}
            </p>
          )}
          <p className="mt-1 leading-relaxed text-slate-700">
            {item.instructions}
          </p>
          {item.tips && (
            <p className="mt-1.5 text-slate-500">Tip: {item.tips}</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <label htmlFor={`note-${item.requirementId}`} className="sr-only">
              Note for {item.title}
            </label>
            <input
              id={`note-${item.requirementId}`}
              type="text"
              value={draft}
              onChange={(e) =>
                setNoteDrafts((prev) => ({
                  ...prev,
                  [item.requirementId]: e.target.value,
                }))
              }
              onBlur={() => {
                if (noteChanged) saveItemNote(item.requirementId);
              }}
              placeholder="Add a note (optional)"
              className="input h-8 max-w-md text-xs"
            />
            {noteChanged && (
              <button
                type="button"
                onClick={() => saveItemNote(item.requirementId)}
                className="text-xs text-link"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const filters: { key: "all" | ChecklistItemStatus; label: string }[] = [
    { key: "all", label: `All (${progress.total})` },
    { key: "missing", label: `Missing (${progress.missing})` },
    {
      key: "needs_verification",
      label: `Needs checking (${progress.needsVerification})`,
    },
    { key: "ready", label: `Ready (${progress.ready})` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        {loading ? (
          <p className="py-16 text-sm text-slate-500">Loading your checklist…</p>
        ) : notFound ? (
          <div className="py-12">
            <h1 className="text-2xl font-semibold text-slate-900">
              We couldn&apos;t find that checklist
            </h1>
            <p className="mt-2 text-slate-600">
              There is no checklist with the code{" "}
              <span className="font-mono text-slate-900">{rawCode}</span>. Check
              the code and try again. Codes look like{" "}
              <span className="font-mono">EZD-HRP-1001</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/resume" className="btn btn-secondary">
                Enter a different code
              </Link>
              <Link href="/services" className="btn btn-primary">
                Start a new checklist
              </Link>
            </div>
          </div>
        ) : error || !session ? (
          <div className="py-12">
            <h1 className="text-2xl font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-slate-600">
              {error || "We couldn't load this checklist."} Please refresh the
              page.
            </p>
          </div>
        ) : (
          <>
            <Link href="/resume" className="text-sm text-link">
              ← My checklists
            </Link>

            {session.parentSessionCode && (
              <p className="mt-4 text-sm text-slate-600">
                This is an updated copy of checklist{" "}
                <Link
                  href={`/checklists/${encodeURIComponent(
                    session.parentSessionCode
                  )}`}
                  className="font-mono text-link"
                >
                  {session.parentSessionCode}
                </Link>
                , which has been kept as it was.
              </p>
            )}

            {isOutdated && updateInfo && (
              <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">
                  A newer version of this checklist is available
                </p>
                <p className="mt-1">
                  Your checklist uses version {session.versionNumber}. Version{" "}
                  {updateInfo.latestVersionNumber} took effect on{" "}
                  {formatDate(updateInfo.latestEffectiveDate)}.{" "}
                  {updateInfo.changelogSummary}
                </p>
                <p className="mt-1">
                  This checklist won&apos;t be changed. If you create an updated
                  copy, the documents you&apos;ve already marked will carry
                  over.
                </p>
                {upgradedSessions.length > 0 && (
                  <p className="mt-2">
                    You&apos;ve already made an updated copy:{" "}
                    {upgradedSessions.map((child, i) => (
                      <React.Fragment key={child.sessionCode}>
                        {i > 0 && ", "}
                        <Link
                          href={`/checklists/${encodeURIComponent(
                            child.sessionCode
                          )}`}
                          className="font-mono underline underline-offset-2"
                        >
                          {child.sessionCode}
                        </Link>
                      </React.Fragment>
                    ))}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={upgrading}
                    onClick={handleUpgrade}
                    className="btn btn-primary"
                  >
                    {upgrading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create updated checklist
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiff((prev) => !prev)}
                    className="btn btn-secondary"
                  >
                    {showDiff ? "Hide changes" : "See what changed"}
                  </button>
                </div>
                {showDiff && (
                  <div className="mt-4 rounded-md bg-white p-4 text-slate-900">
                    <VersionDiffView comparison={updateInfo.comparison} compact />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {session.serviceName}
                </h1>
                <p className="text-slate-600">{session.jurisdiction}</p>
                {session.applicantLabel && (
                  <p className="mt-1 text-slate-800">{session.applicantLabel}</p>
                )}
                <p className="mt-2 text-sm text-slate-500">
                  Code{" "}
                  <span className="font-mono text-slate-800">
                    {session.sessionCode}
                  </span>{" "}
                  · Version {session.versionNumber} · Created{" "}
                  {formatDate(session.createdAt)}
                </p>
                <p className="text-sm text-slate-500">
                  Keep this code to open your checklist again later.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="btn btn-secondary"
                >
                  {copied ? "Copied" : "Copy code"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadChecklistPdf(session)}
                  className="btn btn-primary"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            </div>

            <section className="mt-8 rounded-md border border-slate-200 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-semibold text-slate-900">
                  {progress.ready} of {progress.total} documents ready
                </p>
                <p className="text-sm text-slate-600">
                  {progress.missing} missing · {progress.needsVerification}{" "}
                  need checking
                </p>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-teal-600 transition-all"
                  style={{ width: `${progress.readinessPercent}%` }}
                />
              </div>

              {outstanding.length > 0 ? (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-900">
                    Still to sort out before your visit:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {outstanding.map((item) => (
                      <li key={item.requirementId}>
                        <a
                          href={`#doc-${item.requirementId}`}
                          className="text-slate-700 underline-offset-2 hover:text-teal-700 hover:underline"
                        >
                          {item.title}
                        </a>
                        <span className="text-slate-400">
                          {" "}
                          —{" "}
                          {item.status === "missing"
                            ? "missing"
                            : "needs checking"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                progress.total > 0 && (
                  <p className="mt-4 text-sm text-emerald-700">
                    Everything is ready. Download the PDF and take it with your
                    documents.
                  </p>
                )
              )}
            </section>

            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 text-sm">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`-mb-px border-b-2 pb-2 ${
                    statusFilter === f.key
                      ? "border-slate-900 font-medium text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {mandatoryItems.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900">
                  Required for everyone
                </h2>
                <ul className="mt-2 divide-y divide-slate-200 border-t border-slate-200">
                  {mandatoryItems.map(renderItem)}
                </ul>
              </section>
            )}

            {conditionalItems.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-slate-900">
                  Required for your situation
                </h2>
                <p className="text-sm text-slate-500">
                  Based on your answers to the questions.
                </p>
                <ul className="mt-2 divide-y divide-slate-200 border-t border-slate-200">
                  {conditionalItems.map(renderItem)}
                </ul>
              </section>
            )}

            {filteredItems.length === 0 && (
              <p className="mt-8 text-sm text-slate-600">
                Nothing here.{" "}
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="text-link"
                >
                  Show all documents
                </button>
              </p>
            )}

            <div className="mt-12 space-y-4 border-t border-slate-200 pt-6 text-sm">
              <details>
                <summary className="cursor-pointer font-medium text-slate-900">
                  Not needed for you ({session.excludedItemsJson.length})
                </summary>
                {session.excludedItemsJson.length === 0 ? (
                  <p className="mt-2 text-slate-600">
                    Every document in this checklist applies to you.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-slate-600">
                      Based on your answers, you don&apos;t need these.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {session.excludedItemsJson.map((ex) => (
                        <li key={ex.requirementId}>
                          <span className="text-slate-800">{ex.title}</span>
                          <span className="block text-slate-500">
                            Only needed when: {ex.conditionSummary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </details>

              <details>
                <summary className="cursor-pointer font-medium text-slate-900">
                  Your answers
                </summary>
                <dl className="mt-2 space-y-2">
                  {Object.entries(session.answersJson).map(([key, val]) => {
                    const q = questions.find((item) => item.key === key);
                    const label =
                      q?.options.find((o) => o.value === val)?.label ?? val;
                    return (
                      <div key={key}>
                        <dt className="text-slate-500">{q?.prompt ?? key}</dt>
                        <dd className="text-slate-800">{label}</dd>
                      </div>
                    );
                  })}
                </dl>
                <Link
                  href={`/services/${session.serviceSlug}/questionnaire`}
                  className="mt-3 inline-block text-link"
                >
                  Start again with different answers
                </Link>
              </details>

              <details>
                <summary className="cursor-pointer font-medium text-slate-900">
                  About this checklist
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Version</dt>
                    <dd className="text-slate-800">{session.versionNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Effective</dt>
                    <dd className="text-slate-800">
                      {formatDate(session.versionSnapshotMeta.effectiveDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Published</dt>
                    <dd className="text-slate-800">
                      {formatDate(session.versionSnapshotMeta.publishedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last checked</dt>
                    <dd className="text-slate-800">
                      {formatDate(session.versionSnapshotMeta.lastVerifiedDate)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-slate-600">
                  Source: {session.versionSnapshotMeta.sourceReference}
                </p>
              </details>

              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 leading-relaxed text-amber-900">
                {session.versionSnapshotMeta.disclaimerText}
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
