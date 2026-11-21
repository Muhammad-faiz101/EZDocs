"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FilePlus2,
  GitCompare,
  HelpCircle,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  Rocket,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { describeCondition } from "@/lib/checklist-engine";
import type {
  ChecklistVersionRecord,
  ConditionGroup,
  DocumentRecord,
  QuestionDefinition,
  RequirementType,
  ServiceRecord,
  VerificationStatus,
  VersionRequirement,
} from "@/lib/types";

interface AdminVersionsManagerProps {
  services: ServiceRecord[];
  documents: DocumentRecord[];
  selectedServiceId: number;
  onChangeServiceId: (id: number) => void;
  onRefreshAll: () => Promise<void>;
  onJumpToCompare: (serviceId: number) => void;
}

export function AdminVersionsManager({
  services,
  documents,
  selectedServiceId,
  onChangeServiceId,
  onRefreshAll,
  onJumpToCompare,
}: AdminVersionsManagerProps) {
  const [versions, setVersions] = useState<ChecklistVersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    null
  );
  const [draftState, setDraftState] = useState<ChecklistVersionRecord | null>(
    null
  );
  const [editorTab, setEditorTab] = useState<
    "metadata" | "questions" | "requirements"
  >("requirements");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add requirement picker
  const [selectedMasterDocId, setSelectedMasterDocId] = useState<string>("");

  const loadVersions = async (svcId: number, focusVersionId?: number) => {
    if (!svcId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/versions?serviceId=${svcId}`);
      const data = await res.json();
      if (res.ok) {
        const list = (data.versions || []) as ChecklistVersionRecord[];
        setVersions(list);
        const target =
          (focusVersionId && list.find((v) => v.id === focusVersionId)) ||
          list.find((v) => v.status === "draft") ||
          list[0] ||
          null;
        setSelectedVersionId(target ? target.id : null);
        setDraftState(target ? JSON.parse(JSON.stringify(target)) : null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedServiceId) {
      loadVersions(selectedServiceId);
    }
  }, [selectedServiceId]);

  const selectVersion = (ver: ChecklistVersionRecord) => {
    setSelectedVersionId(ver.id);
    setDraftState(JSON.parse(JSON.stringify(ver)));
    setError(null);
    setFeedback(null);
  };

  const handleCreateDraft = async (cloneFromVersionId?: number) => {
    if (!selectedServiceId) return;
    setCreatingDraft(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          cloneFromVersionId: cloneFromVersionId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create draft.");
      setFeedback(
        `Draft v${data.version.versionNumber} created.`
      );
      await loadVersions(selectedServiceId, data.version.id);
      await onRefreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create draft.");
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleSaveDraft = async (): Promise<boolean> => {
    if (!draftState || draftState.status === "published") return false;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/versions/${draftState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionNumber: draftState.versionNumber,
          changelogSummary: draftState.changelogSummary,
          effectiveDate: draftState.effectiveDate,
          lastVerifiedDate: draftState.lastVerifiedDate,
          sourceReference: draftState.sourceReference,
          disclaimerText: draftState.disclaimerText,
          questionsJson: draftState.questionsJson,
          requirementsJson: draftState.requirementsJson,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save draft.");
      setDraftState(JSON.parse(JSON.stringify(data.version)));
      setVersions((prev) =>
        prev.map((v) => (v.id === data.version.id ? data.version : v))
      );
      setFeedback(`Draft v${data.version.versionNumber} saved.`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!draftState || draftState.status === "published") return;
    const saved = await handleSaveDraft();
    if (!saved) return;

    if (
      !window.confirm(
        `Publish version ${draftState.versionNumber}? It goes live straight away and can't be edited afterwards. People with older checklists will see an update notice.`
      )
    ) {
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/versions/${draftState.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish version.");
      setFeedback(
        `Version ${data.version.versionNumber} is published.`
      );
      await loadVersions(selectedServiceId, data.version.id);
      await onRefreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!draftState || draftState.status === "published") return;
    if (!window.confirm(`Delete draft v${draftState.versionNumber}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/versions/${draftState.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback(`Draft v${draftState.versionNumber} deleted.`);
        await loadVersions(selectedServiceId);
        await onRefreshAll();
      }
    } catch {
      setError("Failed to delete draft.");
    }
  };

  // --- Questionnaire Editor helpers ---
  const addQuestion = () => {
    if (!draftState) return;
    const nextIdx = draftState.questionsJson.length + 1;
    const newQ: QuestionDefinition = {
      id: `q_custom_${Date.now()}`,
      key: `custom_question_${nextIdx}`,
      step: nextIdx,
      prompt: "New eligibility question?",
      helpText: "Explain how this question determines required documents.",
      required: true,
      type: "single_choice",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    };
    setDraftState({
      ...draftState,
      questionsJson: [...draftState.questionsJson, newQ],
    });
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionDefinition>) => {
    if (!draftState) return;
    const updated = draftState.questionsJson.map((q, i) =>
      i === idx ? { ...q, ...patch } : q
    );
    setDraftState({ ...draftState, questionsJson: updated });
  };

  const removeQuestion = (idx: number) => {
    if (!draftState) return;
    setDraftState({
      ...draftState,
      questionsJson: draftState.questionsJson.filter((_, i) => i !== idx),
    });
  };

  // --- Requirements & Conditional Rules helpers ---
  const addRequirementFromMaster = () => {
    if (!draftState) return;
    const masterDoc = documents.find(
      (d) => String(d.id) === selectedMasterDocId
    );
    const nextOrder = draftState.requirementsJson.length + 1;
    const newReq: VersionRequirement = masterDoc
      ? {
          id: `req-${Date.now()}`,
          documentId: masterDoc.id,
          documentCode: masterDoc.code,
          title: masterDoc.title,
          category: masterDoc.category,
          requirementType: "mandatory",
          conditionLogic: null,
          conditionSummary: "Mandatory for all applicants",
          instructions: masterDoc.defaultInstructions,
          originalOrCopy: masterDoc.originalOrCopy,
          tips: "",
          verificationStatus: masterDoc.verificationStatus,
          sourceNote: masterDoc.sourceNote,
          displayOrder: nextOrder,
        }
      : {
          id: `req-${Date.now()}`,
          documentId: null,
          documentCode: `DOC-CUSTOM-${nextOrder}`,
          title: "New Custom Document Requirement",
          category: "Identity",
          requirementType: "mandatory",
          conditionLogic: null,
          conditionSummary: "Mandatory for all applicants",
          instructions: "Specify preparation and attestation instructions.",
          originalOrCopy: "Original + 1 Photocopy",
          tips: "",
          verificationStatus: "illustrative",
          sourceNote: "Illustrative sample — verify locally.",
          displayOrder: nextOrder,
        };

    setDraftState({
      ...draftState,
      requirementsJson: [...draftState.requirementsJson, newReq],
    });
    setSelectedMasterDocId("");
  };

  const updateRequirement = (
    idx: number,
    patch: Partial<VersionRequirement>
  ) => {
    if (!draftState) return;
    const updated = draftState.requirementsJson.map((r, i) =>
      i === idx ? { ...r, ...patch } : r
    );
    setDraftState({ ...draftState, requirementsJson: updated });
  };

  const removeRequirement = (idx: number) => {
    if (!draftState) return;
    setDraftState({
      ...draftState,
      requirementsJson: draftState.requirementsJson.filter((_, i) => i !== idx),
    });
  };

  const setRequirementConditionGroup = (
    reqIdx: number,
    group: ConditionGroup | null
  ) => {
    if (!draftState) return;
    const summary =
      group && group.rules.length > 0
        ? describeCondition(group, draftState.questionsJson)
        : "Mandatory for all applicants";
    updateRequirement(reqIdx, {
      conditionLogic: group,
      conditionSummary: summary,
    });
  };

  const isReadOnly = !draftState || draftState.status === "published";

  return (
    <div className="space-y-6">
      {/* Header + Service Selector */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Checklist versions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Edit a draft, then publish it. Published versions can't be changed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedServiceId}
            onChange={(e) => onChangeServiceId(Number(e.target.value))}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.jurisdiction.split(",")[0]}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={creatingDraft}
            onClick={() => handleCreateDraft(versions[0]?.id)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {creatingDraft ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            {versions.length > 0
              ? `New draft from v${versions[0].versionNumber}`
              : "Create first draft"}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {feedback}
          </span>
          <button type="button" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Version History Selector */}
          <div className="space-y-3 lg:col-span-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Versions ({versions.length})
              </h2>
              {versions.length >= 2 && (
                <button
                  type="button"
                  onClick={() => onJumpToCompare(selectedServiceId)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  <GitCompare className="h-3.5 w-3.5" /> Compare
                </button>
              )}
            </div>

            {versions.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                No checklist versions yet for this service.
                <button
                  type="button"
                  onClick={() => handleCreateDraft()}
                  className="mt-3 block w-full rounded-lg bg-teal-600 px-3 py-2 font-semibold text-white hover:bg-teal-700"
                >
                  Create first draft
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {versions.map((ver) => {
                  const selected = ver.id === selectedVersionId;
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => selectVersion(ver)}
                      className={`w-full rounded-md border p-4 text-left transition ${
                        selected
                          ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-600"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          v{ver.versionNumber}
                        </span>
                        {ver.status === "published" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                            <Lock className="h-2.5 w-2.5" /> Published
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                        {ver.changelogSummary || "No description"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                        <span>Eff: {ver.effectiveDate}</span>
                        <span>{ver.questionsJson.length} Qs</span>
                        <span>{ver.requirementsJson.length} Reqs</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {versions.length > 0 && (
              <button
                type="button"
                disabled={creatingDraft}
                onClick={() => handleCreateDraft()}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                New blank draft
              </button>
            )}
          </div>

          {/* Right Column: Selected Version Inspector / Draft Editor */}
          <div className="lg:col-span-8">
            {!draftState ? (
              <div className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Select a version or create a new draft.
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-white p-6 space-y-5">
                {/* Version Status Banner + Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-900 px-2.5 py-0.5 font-mono text-sm font-semibold text-white">
                        v{draftState.versionNumber}
                      </span>
                      {isReadOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <Lock className="h-3 w-3" /> Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {isReadOnly
                        ? `Published on ${
                            draftState.publishedAt?.slice(0, 10) ?? "N/A"
                          }. To make changes, create a new draft from it.`
                        : "Save your changes, then publish once the requirements have been checked."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isReadOnly ? (
                      <button
                        type="button"
                        disabled={creatingDraft}
                        onClick={() => handleCreateDraft(draftState.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        New draft from v{draftState.versionNumber}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleDeleteDraft}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleSaveDraft}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save draft
                        </button>
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={handlePublishDraft}
                          className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          {publishing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Rocket className="h-3.5 w-3.5" />
                          )}
                          Publish
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inner Editor Tabs */}
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: "requirements",
                      label: `Documents (${draftState.requirementsJson.length})`,
                      icon: ListChecks,
                    },
                    {
                      key: "questions",
                      label: `Questions (${draftState.questionsJson.length})`,
                      icon: HelpCircle,
                    },
                    {
                      key: "metadata",
                      label: "Details",
                      icon: Settings2,
                    },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() =>
                          setEditorTab(
                            t.key as "metadata" | "questions" | "requirements"
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                          editorTab === t.key
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: METADATA */}
                {editorTab === "metadata" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Version number
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={draftState.versionNumber}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            versionNumber: e.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Effective date
                      </label>
                      <input
                        type="date"
                        disabled={isReadOnly}
                        value={draftState.effectiveDate}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            effectiveDate: e.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Last checked
                      </label>
                      <input
                        type="date"
                        disabled={isReadOnly}
                        value={draftState.lastVerifiedDate}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            lastVerifiedDate: e.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Source
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={draftState.sourceReference}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            sourceReference: e.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        What changed (shown to people with older checklists)
                      </label>
                      <textarea
                        rows={2}
                        disabled={isReadOnly}
                        value={draftState.changelogSummary}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            changelogSummary: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm disabled:bg-slate-50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Notice shown on the checklist and PDF
                      </label>
                      <textarea
                        rows={3}
                        disabled={isReadOnly}
                        value={draftState.disclaimerText}
                        onChange={(e) =>
                          setDraftState({
                            ...draftState,
                            disclaimerText: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-xs disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: QUESTIONNAIRE EDITOR */}
                {editorTab === "questions" && (
                  <div className="space-y-4">
                    {!isReadOnly && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add question
                        </button>
                      </div>
                    )}

                    {draftState.questionsJson.map((q, qIdx) => (
                      <div
                        key={q.id}
                        className="rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                              Step {q.step}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              key: {q.key}
                            </span>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIdx)}
                              className="text-xs font-semibold text-rose-600 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600">
                              Question
                            </label>
                            <input
                              type="text"
                              disabled={isReadOnly}
                              value={q.prompt}
                              onChange={(e) =>
                                updateQuestion(qIdx, { prompt: e.target.value })
                              }
                              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Key
                              </label>
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={q.key}
                                onChange={(e) =>
                                  updateQuestion(qIdx, {
                                    key: e.target.value.replace(/\s+/g, "_"),
                                  })
                                }
                                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs disabled:bg-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600">
                                Step #
                              </label>
                              <input
                                type="number"
                                min={1}
                                disabled={isReadOnly}
                                value={q.step}
                                onChange={(e) =>
                                  updateQuestion(qIdx, {
                                    step: Number(e.target.value) || 1,
                                  })
                                }
                                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Help text
                          </label>
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={q.helpText}
                            onChange={(e) =>
                              updateQuestion(qIdx, { helpText: e.target.value })
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                          />
                        </div>

                        {/* Answers */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600">
                              Answer Options
                            </span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuestion(qIdx, {
                                    options: [
                                      ...q.options,
                                      {
                                        value: `opt_${q.options.length + 1}`,
                                        label: "New Option",
                                      },
                                    ],
                                  })
                                }
                                className="text-[11px] font-semibold text-teal-700 hover:underline"
                              >
                                + Add answer
                              </button>
                            )}
                          </div>
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={`${q.id}-${optIdx}`}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={opt.value}
                                onChange={(e) => {
                                  const nextOpts = q.options.map((o, i) =>
                                    i === optIdx
                                      ? { ...o, value: e.target.value }
                                      : o
                                  );
                                  updateQuestion(qIdx, { options: nextOpts });
                                }}
                                placeholder="value"
                                className="h-8 w-36 rounded border border-slate-300 bg-white px-2 font-mono text-[11px] disabled:bg-slate-100"
                              />
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={opt.label}
                                onChange={(e) => {
                                  const nextOpts = q.options.map((o, i) =>
                                    i === optIdx
                                      ? { ...o, label: e.target.value }
                                      : o
                                  );
                                  updateQuestion(qIdx, { options: nextOpts });
                                }}
                                placeholder="Display label"
                                className="h-8 flex-1 rounded border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100"
                              />
                              {!isReadOnly && q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuestion(qIdx, {
                                      options: q.options.filter(
                                        (_, i) => i !== optIdx
                                      ),
                                    })
                                  }
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: CONDITIONAL REQUIREMENTS EDITOR */}
                {editorTab === "requirements" && (
                  <div className="space-y-4">
                    {!isReadOnly && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-teal-200 bg-teal-50/50 p-3.5">
                        <select
                          value={selectedMasterDocId}
                          onChange={(e) =>
                            setSelectedMasterDocId(e.target.value)
                          }
                          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                        >
                          <option value="">
                            Choose a document, or leave blank for a custom one
                          </option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              [{doc.code}] {doc.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={addRequirementFromMaster}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add document
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {draftState.requirementsJson.map((req, rIdx) => {
                        const isCond = req.requirementType === "conditional";
                        return (
                          <div
                            key={req.id}
                            className="rounded-md border border-slate-200 bg-slate-50/40 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[11px] font-semibold text-slate-500">
                                  #{rIdx + 1} • {req.documentCode}
                                </span>
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    isCond
                                      ? "bg-teal-100 text-teal-900"
                                      : "bg-slate-900 text-white"
                                  }`}
                                >
                                  {req.requirementType}
                                </span>
                              </div>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => removeRequirement(rIdx)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Remove
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Title
                                </label>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={req.title}
                                  onChange={(e) =>
                                    updateRequirement(rIdx, {
                                      title: e.target.value,
                                    })
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold disabled:bg-slate-100"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Originals / copies
                                </label>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={req.originalOrCopy}
                                  onChange={(e) =>
                                    updateRequirement(rIdx, {
                                      originalOrCopy: e.target.value,
                                    })
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Who needs it
                                </label>
                                <select
                                  disabled={isReadOnly}
                                  value={req.requirementType}
                                  onChange={(e) => {
                                    const nextType = e.target
                                      .value as RequirementType;
                                    if (nextType === "mandatory") {
                                      updateRequirement(rIdx, {
                                        requirementType: "mandatory",
                                        conditionLogic: null,
                                        conditionSummary:
                                          "Mandatory for all applicants",
                                      });
                                    } else {
                                      const firstQ = draftState.questionsJson[0];
                                      const defaultGroup: ConditionGroup = {
                                        operator: "ALL",
                                        rules: firstQ
                                          ? [
                                              {
                                                questionKey: firstQ.key,
                                                comparator: "equals",
                                                value:
                                                  firstQ.options[0]?.value ??
                                                  "",
                                              },
                                            ]
                                          : [],
                                      };
                                      updateRequirement(rIdx, {
                                        requirementType: "conditional",
                                        conditionLogic: defaultGroup,
                                        conditionSummary: describeCondition(
                                          defaultGroup,
                                          draftState.questionsJson
                                        ),
                                      });
                                    }
                                  }}
                                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                                >
                                  <option value="mandatory">
                                    Everyone
                                  </option>
                                  <option value="conditional">
                                    Depends on answers
                                  </option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Status
                                </label>
                                <select
                                  disabled={isReadOnly}
                                  value={req.verificationStatus}
                                  onChange={(e) =>
                                    updateRequirement(rIdx, {
                                      verificationStatus: e.target
                                        .value as VerificationStatus,
                                    })
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                                >
                                  <option value="illustrative">
                                    Sample (not confirmed)
                                  </option>
                                  <option value="verified">Verified</option>
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Instructions
                                </label>
                                <textarea
                                  rows={2}
                                  disabled={isReadOnly}
                                  value={req.instructions}
                                  onChange={(e) =>
                                    updateRequirement(rIdx, {
                                      instructions: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs disabled:bg-slate-100"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600">
                                  Tip (optional)
                                </label>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={req.tips}
                                  onChange={(e) =>
                                    updateRequirement(rIdx, {
                                      tips: e.target.value,
                                    })
                                  }
                                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs disabled:bg-slate-100"
                                />
                              </div>
                            </div>

                            {/* Visual Conditional Rule Builder */}
                            {isCond && (
                              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-950">
                                    <span>Include when</span>
                                    <select
                                      disabled={isReadOnly}
                                      value={
                                        req.conditionLogic?.operator ?? "ALL"
                                      }
                                      onChange={(e) => {
                                        const current = req.conditionLogic ?? {
                                          operator: "ALL",
                                          rules: [],
                                        };
                                        setRequirementConditionGroup(rIdx, {
                                          ...current,
                                          operator: e.target.value as
                                            | "ALL"
                                            | "ANY",
                                        });
                                      }}
                                      className="rounded border border-teal-300 bg-white px-2 py-0.5 text-xs font-semibold text-teal-900 disabled:bg-slate-100"
                                    >
                                      <option value="ALL">all of these match</option>
                                      <option value="ANY">any of these match</option>
                                    </select>
                                  </div>

                                  {!isReadOnly &&
                                    draftState.questionsJson.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const firstQ =
                                            draftState.questionsJson[0];
                                          const current = req.conditionLogic ?? {
                                            operator: "ALL",
                                            rules: [],
                                          };
                                          setRequirementConditionGroup(rIdx, {
                                            ...current,
                                            rules: [
                                              ...current.rules,
                                              {
                                                questionKey: firstQ.key,
                                                comparator: "equals",
                                                value:
                                                  firstQ.options[0]?.value ??
                                                  "",
                                              },
                                            ],
                                          });
                                        }}
                                        className="text-[11px] font-semibold text-teal-800 hover:underline"
                                      >
                                        + Add condition
                                      </button>
                                    )}
                                </div>

                                {(req.conditionLogic?.rules ?? []).map(
                                  (rule, ruleIdx) => {
                                    const matchedQ =
                                      draftState.questionsJson.find(
                                        (q) => q.key === rule.questionKey
                                      );
                                    return (
                                      <div
                                        key={`${req.id}-rule-${ruleIdx}`}
                                        className="flex flex-wrap items-center gap-2"
                                      >
                                        <select
                                          disabled={isReadOnly}
                                          value={rule.questionKey}
                                          onChange={(e) => {
                                            const newQ =
                                              draftState.questionsJson.find(
                                                (q) => q.key === e.target.value
                                              );
                                            const current =
                                              req.conditionLogic!;
                                            const nextRules =
                                              current.rules.map((rl, i) =>
                                                i === ruleIdx
                                                  ? {
                                                      ...rl,
                                                      questionKey:
                                                        e.target.value,
                                                      value:
                                                        newQ?.options[0]
                                                          ?.value ?? "",
                                                    }
                                                  : rl
                                              );
                                            setRequirementConditionGroup(rIdx, {
                                              ...current,
                                              rules: nextRules,
                                            });
                                          }}
                                          className="h-8 flex-1 rounded border border-teal-300 bg-white px-2 text-xs disabled:bg-slate-100"
                                        >
                                          {draftState.questionsJson.map((q) => (
                                            <option key={q.key} value={q.key}>
                                              {q.prompt}
                                            </option>
                                          ))}
                                        </select>

                                        <select
                                          disabled={isReadOnly}
                                          value={rule.comparator}
                                          onChange={(e) => {
                                            const current =
                                              req.conditionLogic!;
                                            const nextRules =
                                              current.rules.map((rl, i) =>
                                                i === ruleIdx
                                                  ? {
                                                      ...rl,
                                                      comparator: e.target
                                                        .value as
                                                        | "equals"
                                                        | "not_equals",
                                                    }
                                                  : rl
                                              );
                                            setRequirementConditionGroup(rIdx, {
                                              ...current,
                                              rules: nextRules,
                                            });
                                          }}
                                          className="h-8 rounded border border-teal-300 bg-white px-2 text-xs disabled:bg-slate-100"
                                        >
                                          <option value="equals">equals</option>
                                          <option value="not_equals">
                                            is not
                                          </option>
                                        </select>

                                        <select
                                          disabled={isReadOnly}
                                          value={String(rule.value)}
                                          onChange={(e) => {
                                            const current =
                                              req.conditionLogic!;
                                            const nextRules =
                                              current.rules.map((rl, i) =>
                                                i === ruleIdx
                                                  ? {
                                                      ...rl,
                                                      value: e.target.value,
                                                    }
                                                  : rl
                                              );
                                            setRequirementConditionGroup(rIdx, {
                                              ...current,
                                              rules: nextRules,
                                            });
                                          }}
                                          className="h-8 flex-1 rounded border border-teal-300 bg-white px-2 text-xs disabled:bg-slate-100"
                                        >
                                          {(matchedQ?.options ?? []).map(
                                            (opt) => (
                                              <option
                                                key={opt.value}
                                                value={opt.value}
                                              >
                                                {opt.label}
                                              </option>
                                            )
                                          )}
                                        </select>

                                        {!isReadOnly && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const current =
                                                req.conditionLogic!;
                                              setRequirementConditionGroup(
                                                rIdx,
                                                {
                                                  ...current,
                                                  rules: current.rules.filter(
                                                    (_, i) => i !== ruleIdx
                                                  ),
                                                }
                                              );
                                            }}
                                            className="text-rose-500 hover:text-rose-700"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }
                                )}

                                <p className="text-[11px] text-teal-800">
                                  <strong>Summary:</strong>{" "}
                                  {req.conditionSummary}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
