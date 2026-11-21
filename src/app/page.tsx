import React from "react";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LandingSearch } from "@/components/LandingSearch";

export const dynamic = "force-dynamic";

async function getServices() {
  await ensureSeeded();
  const allServices = await db.select().from(services).orderBy(services.id);
  const allVersions = await db
    .select()
    .from(checklistVersions)
    .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

  const published = new Set<number>();
  for (const v of allVersions) {
    if (v.status === "published") published.add(v.serviceId);
  }

  return allServices
    .filter((s) => s.isActive)
    .map((s) => ({ ...s, hasPublished: published.has(s.id) }));
}

const STEPS = [
  {
    title: "Choose a service",
    body: "Find the service you are applying for.",
  },
  {
    title: "Answer a few questions",
    body: "About your age, your ID and where you live. It takes about two minutes.",
  },
  {
    title: "Get your checklist",
    body: "Mark what you already have, see what's missing, and print the list to take with you.",
  },
];

const NOTES = [
  {
    title: "Only what applies to you",
    body: "Documents that don't apply to your situation are left off the list, not marked as missing.",
  },
  {
    title: "Come back any time",
    body: "Each checklist gets a code. Use it to open your checklist later and pick up where you left off.",
  },
  {
    title: "Changes are flagged",
    body: "If the requirements change after you make your checklist, you'll see what changed and can create an updated copy.",
  },
];

export default async function HomePage() {
  const serviceList = await getServices();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-5xl gap-12 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[1.5fr_1fr]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Get your documents ready before you visit.
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
                Know exactly what to prepare for your government application.
                Get a personalized checklist, track what&apos;s ready, and avoid
                unnecessary trips.
              </p>
              <LandingSearch />
              <p className="mt-4 text-sm text-slate-600">
                Already started?{" "}
                <Link href="/resume" className="text-link">
                  Open a saved checklist
                </Link>
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                How it works
              </h2>
              <ol className="mt-4 space-y-5">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{step.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Services</h2>
            <Link href="/services" className="text-sm text-link">
              See all
            </Link>
          </div>

          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {serviceList.map((svc) => (
              <li
                key={svc.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/services/${svc.slug}`}
                    className="font-medium text-slate-900 hover:text-teal-700"
                  >
                    {svc.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {svc.jurisdiction} · {svc.officeName}
                  </p>
                </div>
                {svc.hasPublished ? (
                  <Link
                    href={`/services/${svc.slug}/questionnaire`}
                    className="btn btn-primary self-start sm:self-auto"
                  >
                    Start checklist
                  </Link>
                ) : (
                  <span className="text-sm text-slate-500">
                    Not available yet
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <h2 className="text-xl font-semibold text-slate-900">Good to know</h2>
          <dl className="mt-5 grid gap-8 sm:grid-cols-3">
            {NOTES.map((note) => (
              <div key={note.title}>
                <dt className="font-medium text-slate-900">{note.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                  {note.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <Footer />
    </div>
  );
}
