"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { DocumentRecord, VerificationStatus } from "@/lib/types";

interface AdminDocumentsManagerProps {
  documents: DocumentRecord[];
  onRefresh: () => Promise<void>;
}

const EMPTY_DOC = {
  code: "",
  title: "",
  category: "Identity",
  defaultInstructions: "",
  originalOrCopy: "Original + 2 Photocopies",
  verificationStatus: "illustrative" as VerificationStatus,
  sourceNote: "Illustrative sample — verify with relevant district office.",
};

export function AdminDocumentsManager({
  documents,
  onRefresh,
}: AdminDocumentsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_DOC);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_DOC);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (doc: DocumentRecord) => {
    setEditingId(doc.id);
    setForm({
      code: doc.code,
      title: doc.title,
      category: doc.category,
      defaultInstructions: doc.defaultInstructions,
      originalOrCopy: doc.originalOrCopy,
      verificationStatus: doc.verificationStatus,
      sourceNote: doc.sourceNote,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/admin/documents/${editingId}`
        : "/api/admin/documents";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save document.");

      setShowForm(false);
      setFeedback(
        editingId
          ? `Updated document "${data.document.title}"`
          : `Added document "${data.document.title}" (${data.document.code})`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (
      !window.confirm(
        `Delete "${doc.title}"? Published checklist versions are not affected.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback(`Deleted "${doc.title}".`);
        await onRefresh();
      }
    } catch {
      setError("Failed to delete document.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Documents
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Document templates you can add to a draft checklist. Editing a template doesn't change published versions.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Add document
        </button>
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

      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-md border border-teal-300 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId ? "Edit document" : "New document"}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Gazette Attested Affidavit"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Code (optional)
              </label>
              <input
                type="text"
                disabled={Boolean(editingId)}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g., DOC-GAZETTE-AFFIDAVIT"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm uppercase disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="Identity">Identity</option>
                <option value="Residency Proof">Residency Proof</option>
                <option value="Application Forms">Application Forms</option>
                <option value="Photographs & Fees">Photographs & Fees</option>
                <option value="Clearance & NOC">Clearance & NOC</option>
                <option value="Affidavits">Affidavits</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Originals / copies *
              </label>
              <input
                type="text"
                required
                value={form.originalOrCopy}
                onChange={(e) =>
                  setForm({ ...form, originalOrCopy: e.target.value })
                }
                placeholder="e.g., Original + 2 Attested Photocopies"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Instructions *
              </label>
              <textarea
                rows={3}
                required
                value={form.defaultInstructions}
                onChange={(e) =>
                  setForm({ ...form, defaultInstructions: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Status
              </label>
              <select
                value={form.verificationStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    verificationStatus: e.target.value as VerificationStatus,
                  })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="illustrative">
                  Sample (not confirmed)
                </option>
                <option value="verified">Confirmed with office</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Source Note
              </label>
              <input
                type="text"
                value={form.sourceNote}
                onChange={(e) =>
                  setForm({ ...form, sourceNote: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? "Save changes" : "Add document"}
            </button>
          </div>
        </form>
      )}

      {/* Documents Table */}
      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 font-mono text-[11px] font-semibold text-slate-600">
                    {doc.code}
                  </td>
                  <td className="px-4 py-3.5 max-w-md">
                    <p className="font-semibold text-slate-900">{doc.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                      {doc.defaultInstructions}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium">
                      {doc.originalOrCopy}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {doc.verificationStatus === "verified" ? (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Sample</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(doc)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Edit document"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
