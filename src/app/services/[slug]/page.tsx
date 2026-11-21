"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VersionDiffView } from "@/components/VersionDiffView";
import type {
  ChecklistVersionRecord,
  ServiceRecord,
  VersionComparisonResult,
} from "@/lib/types";

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

export default function ServiceDetailsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [service, setService] = useState<ServiceRecord | null>(null);
  const [latestVersion, setLatestVersion] =
    useState<ChecklistVersionRecord | null>(null);
  const [publishedVersions, setPublishedVersions] = useState<
    ChecklistVersionRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCompare, setShowCompare] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const [targetVersionId, setTargetVersionId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<VersionComparisonResult | null>(
    null
  );
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/services/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Service not found.");
        if (active) {
          setService(data.service);
          setLatestVersion(data.latestPublishedVersion);
          setPublishedVersions(data.publishedVersions || []);
          if (data.publishedVersions?.length >= 2) {
            setTargetVersionId(data.publishedVersions[0].id);
            setBaseVersionId(data.publishedVersions[1].id);
          }
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Service not found.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!showCompare || !baseVersionId || !targetVersionId) return;
    let active = true;
    async function runCompare() {
      setComparing(true);
      try {
        const res = await fetch(
          `/api/versions/compare?baseId=${baseVersionId}&targetId=${targetVersionId}`
        );
        const data = await res.json();
        if (active && res.ok) setComparison(data.comparison);
      } finally {
        if (active) setComparing(false);
      }
    }
    runCompare();
    return () => {
      active = false;
    };
  }, [showCompare, baseVersionId, targetVersionId]);

  const mandatoryCount =
    latestVersion?.requirementsJson.filter(
      (r) => r.requirementType === "mandatory"
    ).length ?? 0;
  const conditionalCount =
    latestVersion?.requirementsJson.filter(
      (r) => r.requirementType === "conditional"
    ).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/services" className="text-sm text-link">
          ← All services
        </Link>

        {loading ? (
          <p className="py-16 text-sm text-slate-500">Loading…</p>
        ) : error || !service ? (
          <div className="py-12">
            <h1 className="text-2xl font-semibold text-slate-900">
              Service not found
            </h1>
            <p className="mt-2 text-slate-600">
              This service doesn&apos;t exist or has been removed.
            </p>
            <Link href="/services" className="btn btn-primary mt-6">
              See all services
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {service.name}
            </h1>
            <p className="mt-1 text-slate-600">{service.jurisdiction}</p>

            <p className="mt-5 leading-relaxed text-slate-700">
              {service.description}
            </p>

            <dl className="mt-6 grid gap-4 border-y border-slate-200 py-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Where to apply</dt>
                <dd className="mt-0.5 text-slate-900">{service.officeName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Fee</dt>
                <dd className="mt-0.5 text-slate-900">{service.feeInfo}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Time to prepare</dt>
                <dd className="mt-0.5 text-slate-900">
                  {service.estimatedTime}
                </dd>
              </div>
            </dl>

            {latestVersion ? (
              <div className="mt-6">
                <p className="text-slate-700">
                  You&apos;ll answer {latestVersion.questionsJson.length} short
                  questions. {mandatoryCount} documents are needed by everyone,
                  and up to {conditionalCount} more depending on your answers.
                </p>
                <Link
                  href={`/services/${service.slug}/questionnaire`}
                  className="btn btn-primary mt-4 px-5 py-2.5"
                >
                  Start checklist
                </Link>

                <p className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                  {latestVersion.disclaimerText}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-medium text-slate-900">
                  This checklist isn&apos;t available yet
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  The document list for this service is still being prepared.
                  Please check back later.
                </p>
                <Link
                  href="/services"
                  className="mt-3 inline-block text-sm text-link"
                >
                  See other services
                </Link>
              </div>
            )}

            {publishedVersions.length > 0 && (
              <section className="mt-12">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Checklist versions
                  </h2>
                  {publishedVersions.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => setShowCompare((prev) => !prev)}
                      className="text-sm text-link"
                    >
                      {showCompare ? "Hide comparison" : "Compare versions"}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  A new version is published when the requirements change.
                  Checklists you already made keep the version they were made
                  with.
                </p>

                <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                  {publishedVersions.map((ver, index) => (
                    <li key={ver.id} className="py-4 text-sm">
                      <p className="font-medium text-slate-900">
                        Version {ver.versionNumber}
                        {index === 0 && (
                          <span className="ml-2 font-normal text-teal-700">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        Effective {formatDate(ver.effectiveDate)} · Published{" "}
                        {formatDate(ver.publishedAt)} · Last checked{" "}
                        {formatDate(ver.lastVerifiedDate)}
                      </p>
                      {ver.changelogSummary && (
                        <p className="mt-2 text-slate-700">
                          {ver.changelogSummary}
                        </p>
                      )}
                      <p className="mt-1 text-slate-500">
                        Source: {ver.sourceReference}
                      </p>
                    </li>
                  ))}
                </ul>

                {showCompare && publishedVersions.length >= 2 && (
                  <div className="mt-6">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-2 text-slate-600">
                        From
                        <select
                          value={baseVersionId ?? ""}
                          onChange={(e) =>
                            setBaseVersionId(Number(e.target.value))
                          }
                          className="input h-9 w-auto"
                        >
                          {publishedVersions.map((v) => (
                            <option key={v.id} value={v.id}>
                              Version {v.versionNumber}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-slate-600">
                        to
                        <select
                          value={targetVersionId ?? ""}
                          onChange={(e) =>
                            setTargetVersionId(Number(e.target.value))
                          }
                          className="input h-9 w-auto"
                        >
                          {publishedVersions.map((v) => (
                            <option key={v.id} value={v.id}>
                              Version {v.versionNumber}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-5">
                      {comparing ? (
                        <p className="text-sm text-slate-500">Loading…</p>
                      ) : comparison ? (
                        <VersionDiffView comparison={comparison} />
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
