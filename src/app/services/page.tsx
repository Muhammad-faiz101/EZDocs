"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type { ServiceRecord } from "@/lib/types";

const CATEGORIES = [
  "Identity & Residency",
  "Police & Clearance",
  "Civil Registration",
];

function ServicesList() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("all");
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (category !== "all") params.set("category", category);
        const res = await fetch(`/api/services?${params.toString()}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (active) setServices(data.services || []);
      } catch {
        if (active) {
          setError("We couldn't load the services. Please refresh the page.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [query, category]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
      <p className="mt-1 text-slate-600">
        Choose the service you are applying for.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="filter" className="sr-only">
          Search services
        </label>
        <input
          id="filter"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by service, district or office"
          className="input sm:max-w-sm"
        />
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input sm:w-56"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {loading ? (
          <p className="py-10 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : services.length === 0 ? (
          <div className="py-10">
            <p className="text-slate-700">No services match your search.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              className="mt-2 text-sm text-link"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {services.map((svc) => {
              const latest = svc.latestPublishedVersion;
              return (
                <li
                  key={svc.id}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="max-w-2xl">
                    <Link
                      href={`/services/${svc.slug}`}
                      className="text-lg font-medium text-slate-900 hover:text-teal-700"
                    >
                      {svc.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {svc.jurisdiction} · {svc.officeName}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {svc.summary}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {latest ? (
                      <Link
                        href={`/services/${svc.slug}/questionnaire`}
                        className="btn btn-primary"
                      >
                        Start checklist
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-500">
                        Not available yet
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Suspense
        fallback={
          <p className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 text-sm text-slate-500 sm:px-6">
            Loading…
          </p>
        }
      >
        <ServicesList />
      </Suspense>
      <Footer />
    </div>
  );
}
