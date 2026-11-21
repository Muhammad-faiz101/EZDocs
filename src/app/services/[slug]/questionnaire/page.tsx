"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type {
  ChecklistVersionRecord,
  QuestionDefinition,
  ServiceRecord,
} from "@/lib/types";

const REQUIRED_MSG = "Please choose an answer.";

export default function QuestionnairePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [service, setService] = useState<ServiceRecord | null>(null);
  const [version, setVersion] = useState<ChecklistVersionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [applicantLabel, setApplicantLabel] = useState("");
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/services/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Service not found.");
        if (active) {
          setService(data.service);
          setVersion(data.latestPublishedVersion);
        }
      } catch (e) {
        if (active) {
          setLoadError(e instanceof Error ? e.message : "Service not found.");
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

  const steps = useMemo(() => {
    if (!version) return [];
    const grouped = new Map<number, QuestionDefinition[]>();
    for (const q of version.questionsJson) {
      const list = grouped.get(q.step) ?? [];
      list.push(q);
      grouped.set(q.step, list);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([stepNumber, questions]) => ({ stepNumber, questions }));
  }, [version]);

  const currentStep = steps[currentStepIdx];
  const isLastStep = currentStepIdx === steps.length - 1;
  const progressPct =
    steps.length > 0 ? ((currentStepIdx + 1) / steps.length) * 100 : 0;

  const selectAnswer = (questionKey: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionKey]: value }));
    setStepErrors((prev) => {
      if (!prev[questionKey]) return prev;
      const next = { ...prev };
      delete next[questionKey];
      return next;
    });
    setSubmitError(null);
  };

  const validateCurrentStep = (): boolean => {
    if (!currentStep) return false;
    const errs: Record<string, string> = {};
    for (const q of currentStep.questions) {
      if (q.required && !answers[q.key]) errs[q.key] = REQUIRED_MSG;
    }
    setStepErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goTo = (idx: number) => {
    setCurrentStepIdx(idx);
    window.scrollTo({ top: 0 });
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStepIdx < steps.length - 1) goTo(currentStepIdx + 1);
  };

  const handleBack = () => {
    setStepErrors({});
    setSubmitError(null);
    if (currentStepIdx > 0) goTo(currentStepIdx - 1);
  };

  const handleGenerate = async () => {
    if (!validateCurrentStep() || !version || !service) return;

    const allErrs: Record<string, string> = {};
    let firstMissingStep = -1;
    steps.forEach((s, idx) => {
      for (const q of s.questions) {
        if (q.required && !answers[q.key]) {
          allErrs[q.key] = REQUIRED_MSG;
          if (firstMissingStep === -1) firstMissingStep = idx;
        }
      }
    });

    if (Object.keys(allErrs).length > 0) {
      setStepErrors(allErrs);
      setSubmitError("Some questions haven't been answered yet.");
      if (firstMissingStep !== -1) goTo(firstMissingStep);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSlug: service.slug,
          answers,
          applicantLabel: applicantLabel.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.validationErrors)) {
          const serverErrs: Record<string, string> = {};
          for (const ve of data.validationErrors) {
            serverErrs[ve.questionKey] = REQUIRED_MSG;
          }
          setStepErrors(serverErrs);
        }
        throw new Error(
          data.error || "Something went wrong. Please try again."
        );
      }

      try {
        const stored = JSON.parse(
          localStorage.getItem("ezdocs_recent_sessions") || "[]"
        ) as string[];
        const updated = [
          data.session.sessionCode,
          ...stored.filter((c) => c !== data.session.sessionCode),
        ].slice(0, 10);
        localStorage.setItem("ezdocs_recent_sessions", JSON.stringify(updated));
      } catch {
        // storage not available
      }

      router.push(`/checklists/${encodeURIComponent(data.session.sessionCode)}`);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasErrors = Object.keys(stepErrors).length > 0 || Boolean(submitError);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href={`/services/${slug}`} className="text-sm text-link">
          ← Back
        </Link>

        {loading ? (
          <p className="py-16 text-sm text-slate-500">Loading…</p>
        ) : loadError || !service ? (
          <div className="py-12">
            <h1 className="text-2xl font-semibold text-slate-900">
              Service not found
            </h1>
            <p className="mt-2 text-slate-600">
              We couldn&apos;t find this service.
            </p>
            <Link href="/services" className="btn btn-primary mt-6">
              See all services
            </Link>
          </div>
        ) : !version ? (
          <div className="py-12">
            <h1 className="text-2xl font-semibold text-slate-900">
              This checklist isn&apos;t available yet
            </h1>
            <p className="mt-2 text-slate-600">
              The document list for {service.name} is still being prepared, so
              you can&apos;t create a checklist for it yet.
            </p>
            <Link href="/services" className="btn btn-secondary mt-6">
              See other services
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-slate-500">
              {service.name}, {service.jurisdiction.split(",")[0]}
            </p>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>
                Question {currentStepIdx + 1} of {steps.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-teal-600 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {hasErrors && (
              <p
                role="alert"
                className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {submitError || "Please answer the question to continue."}
              </p>
            )}

            {currentStep && (
              <div className="mt-8 space-y-10">
                {currentStep.questions.map((q) => {
                  const selected = answers[q.key];
                  const error = stepErrors[q.key];
                  return (
                    <fieldset key={q.id}>
                      <legend className="text-xl font-semibold text-slate-900">
                        {q.prompt}
                        {!q.required && (
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            (optional)
                          </span>
                        )}
                      </legend>
                      {q.helpText && (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {q.helpText}
                        </p>
                      )}

                      <div className="mt-5 space-y-2">
                        {q.options.map((opt) => {
                          const isSelected = selected === opt.value;
                          return (
                            <label
                              key={opt.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                                isSelected
                                  ? "border-teal-600 bg-teal-50/50"
                                  : error
                                  ? "border-rose-300 hover:bg-slate-50"
                                  : "border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.key}
                                value={opt.value}
                                checked={isSelected}
                                onChange={() => selectAnswer(q.key, opt.value)}
                                className="mt-1 h-4 w-4 accent-teal-700"
                              />
                              <span>
                                <span className="block text-slate-900">
                                  {opt.label}
                                </span>
                                {opt.description && (
                                  <span className="mt-0.5 block text-sm text-slate-500">
                                    {opt.description}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {error && (
                        <p className="mt-2 text-sm text-rose-700">{error}</p>
                      )}
                    </fieldset>
                  );
                })}

                {isLastStep && (
                  <div>
                    <label htmlFor="applicant-label" className="field-label">
                      Name this checklist{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <p className="mt-1 text-sm text-slate-500">
                      Helps you find it later, e.g. &ldquo;Ali&apos;s
                      domicile&rdquo;.
                    </p>
                    <input
                      id="applicant-label"
                      type="text"
                      value={applicantLabel}
                      onChange={(e) => setApplicantLabel(e.target.value)}
                      className="input mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStepIdx === 0}
                className="btn btn-secondary"
              >
                Back
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn btn-primary px-6"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="btn btn-primary px-6"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Creating…" : "Create my checklist"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
