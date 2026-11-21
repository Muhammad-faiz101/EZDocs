"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  PenLine,
  Plus,
  X,
} from "lucide-react";
import type { ServiceRecord } from "@/lib/types";

interface AdminServicesManagerProps {
  services: ServiceRecord[];
  onRefresh: () => Promise<void>;
  onSelectServiceForVersions: (serviceId: number) => void;
}

const EMPTY_FORM = {
  name: "",
  jurisdiction: "Haripur, Khyber Pakhtunkhwa, Pakistan",
  officeName: "",
  category: "Identity & Residency",
  summary: "",
  description: "",
  estimatedTime: "About 10 minutes",
  feeInfo: "Confirm the fee at the office.",
  isActive: true,
};

export function AdminServicesManager({
  services,
  onRefresh,
  onSelectServiceForVersions,
}: AdminServicesManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingSlug(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (svc: ServiceRecord) => {
    setEditingSlug(svc.slug);
    setForm({
      name: svc.name,
      jurisdiction: svc.jurisdiction,
      officeName: svc.officeName,
      category: svc.category,
      summary: svc.summary,
      description: svc.description,
      estimatedTime: svc.estimatedTime,
      feeInfo: svc.feeInfo,
      isActive: svc.isActive,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingSlug
        ? `/api/services/${encodeURIComponent(editingSlug)}`
        : "/api/services";
      const method = editingSlug ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save service.");

      setShowForm(false);
      setFeedback(
        editingSlug
          ? `Updated "${data.service.name}"`
          : `Created new service "${data.service.name}"`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Services
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Each service has its own questions, documents and checklist versions.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Add service
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
              {editingSlug ? "Edit service" : "New service"}
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
                Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Domicile Certificate"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Jurisdiction *
              </label>
              <input
                type="text"
                required
                value={form.jurisdiction}
                onChange={(e) =>
                  setForm({ ...form, jurisdiction: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Office *
              </label>
              <input
                type="text"
                required
                value={form.officeName}
                onChange={(e) =>
                  setForm({ ...form, officeName: e.target.value })
                }
                placeholder="e.g., Deputy Commissioner Office, Haripur"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
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
                <option value="Identity & Residency">
                  Identity & Residency
                </option>
                <option value="Police & Clearance">Police & Clearance</option>
                <option value="Civil Registration">Civil Registration</option>
                <option value="Land & Revenue">Land & Revenue</option>
                <option value="Licensing & Permits">Licensing & Permits</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Summary *
              </label>
              <input
                type="text"
                required
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Time to prepare
              </label>
              <input
                type="text"
                value={form.estimatedTime}
                onChange={(e) =>
                  setForm({ ...form, estimatedTime: e.target.value })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Fee information
              </label>
              <input
                type="text"
                value={form.feeInfo}
                onChange={(e) => setForm({ ...form, feeInfo: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-teal-600"
            />
            Show on the public services page
          </label>

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
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingSlug ? "Save changes" : "Create service"}
            </button>
          </div>
        </form>
      )}

      {/* Services Table */}
      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Service</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Versions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((svc) => (
                <tr key={svc.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{svc.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {svc.jurisdiction} • {svc.officeName}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{svc.category}</td>
                  <td className="px-4 py-4">
                    {svc.latestPublishedVersion ? (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                        v{svc.latestPublishedVersion.versionNumber} (
                        {svc.publishedVersionCount} pub)
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                        Not published
                      </span>
                    )}
                    {(svc.draftVersionCount ?? 0) > 0 && (
                      <span className="ml-1.5 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {svc.draftVersionCount} draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        svc.isActive
                          ? "bg-teal-50 text-teal-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {svc.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectServiceForVersions(svc.id)}
                        className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                      >
                        Versions
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(svc)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Edit service"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href={`/services/${svc.slug}`}
                        target="_blank"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        title="View public service page"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
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
