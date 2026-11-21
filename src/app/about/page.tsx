import React from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistSessions, checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  calculateChecklistProgress,
  generatePersonalizedChecklist,
} from "@/lib/checklist-engine";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const dynamic = "force-dynamic";

const MANDATORY = [
  "DOC-APP-FORM",
  "DOC-PHOTOS",
  "DOC-RESIDENCE-PROOF",
  "DOC-FEE-CHALLAN",
  "DOC-UC-VERIFICATION",
];

const RULE_CHECKS = [
  {
    name: "Adult with a CNIC, lives in Haripur, first application",
    answers: {
      age_group: "adult_18_plus",
      id_document: "has_cnic",
      application_type: "first_time",
      haripur_residence: "permanent_haripur",
      other_district_domicile: "no",
      spouse_domicile_basis: "no",
    },
    expected: [...MANDATORY, "DOC-CNIC"],
  },
  {
    name: "Under 18 with a B-Form, lives in Haripur",
    answers: {
      age_group: "minor_under_18",
      id_document: "has_bform",
      application_type: "first_time",
      haripur_residence: "permanent_haripur",
      other_district_domicile: "no",
      spouse_domicile_basis: "no",
    },
    expected: [...MANDATORY, "DOC-BFORM-PARENT", "DOC-FRC"],
  },
  {
    name: "Adult who moved from another district and had a domicile there",
    answers: {
      age_group: "adult_18_plus",
      id_document: "has_cnic",
      application_type: "first_time",
      haripur_residence: "temporary_resident",
      other_district_domicile: "yes",
      spouse_domicile_basis: "no",
    },
    expected: [
      ...MANDATORY,
      "DOC-CNIC",
      "DOC-FRC",
      "DOC-NOC-CANCELLATION",
      "DOC-TEMP-RESIDENCE",
    ],
  },
  {
    name: "Adult with no CNIC or B-Form yet",
    answers: {
      age_group: "adult_18_plus",
      id_document: "neither",
      application_type: "first_time",
      haripur_residence: "permanent_haripur",
      other_district_domicile: "no",
      spouse_domicile_basis: "no",
    },
    expected: [...MANDATORY, "DOC-NADRA-PREREQ"],
  },
  {
    name: "Replacing a lost domicile, applying through a spouse",
    answers: {
      age_group: "adult_18_plus",
      id_document: "has_cnic",
      application_type: "renewal_duplicate",
      haripur_residence: "permanent_haripur",
      other_district_domicile: "no",
      spouse_domicile_basis: "yes",
    },
    expected: [
      ...MANDATORY,
      "DOC-CNIC",
      "DOC-DUPLICATE-AFFIDAVIT",
      "DOC-NIKAH-SPOUSE",
    ],
  },
];

async function getData() {
  await ensureSeeded();
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.slug, "domicile-certificate-haripur"));

  let checks: {
    name: string;
    expected: number;
    listed: number;
    excluded: number;
    match: boolean;
  }[] = [];

  if (service) {
    const [v2] = await db
      .select()
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.serviceId, service.id),
          eq(checklistVersions.versionNumber, "2.0"),
          eq(checklistVersions.status, "published")
        )
      );
    if (v2) {
      checks = RULE_CHECKS.map((tc) => {
        const out = generatePersonalizedChecklist(
          v2.requirementsJson,
          v2.questionsJson,
          tc.answers
        );
        const got = new Set(out.items.map((i) => i.documentCode));
        const match =
          got.size === tc.expected.length &&
          tc.expected.every((c) => got.has(c));
        return {
          name: tc.name,
          expected: tc.expected.length,
          listed: got.size,
          excluded: out.excludedItems.length,
          match,
        };
      });
    }
  }

  const sessions = await db.select().from(checklistSessions);
  let readySum = 0;
  let missing = 0;
  let fullyReady = 0;
  for (const s of sessions) {
    const p = calculateChecklistProgress(s.itemsJson);
    readySum += p.readinessPercent;
    missing += p.missing;
    if (p.isFullyReady) fullyReady++;
  }

  return {
    checks,
    usage: {
      total: sessions.length,
      avgReady: sessions.length ? Math.round(readySum / sessions.length) : 0,
      missing,
      fullyReady,
    },
  };
}

export default async function AboutPage() {
  const { checks, usage } = await getData();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">About EZDocs</h1>
        <p className="mt-3 leading-relaxed text-slate-700">
          EZDocs helps you find out which documents to bring before you go to a
          government office. You answer a few questions and get a list of the
          documents that apply to you. You can mark what you have, save the
          list, and print it.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            About the requirements
          </h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            Right now, the Domicile Certificate for District Haripur is the only
            service with a checklist. Its requirements are sample information
            put together to show how the checklist works. They have not been
            confirmed with the Deputy Commissioner Office. Each checklist and
            PDF marks these as sample requirements. Please confirm with the
            office before you visit.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            When requirements change
          </h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            When the requirements change, a new version of the checklist is
            published. Published versions can&apos;t be edited. Your checklist
            keeps the version it was made with, so it never changes without you
            knowing. If a newer version comes out, your checklist shows what
            changed and lets you create an updated copy. The original stays as
            it was.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            Examples you can open
          </h2>
          <ul className="mt-3 space-y-3 text-slate-700">
            <li>
              <Link href="/checklists/EZD-HRP-1001" className="text-link">
                A checklist made with an older version
              </Link>
              <span className="block text-sm text-slate-500">
                Shows the update notice and what changed in version 2.0.
              </span>
            </li>
            <li>
              <Link href="/checklists/EZD-HRP-2088" className="text-link">
                A checklist for someone under 18
              </Link>
              <span className="block text-sm text-slate-500">
                Documents that don&apos;t apply, like the adult CNIC, are listed
                under &ldquo;Not needed for you&rdquo;.
              </span>
            </li>
            <li>
              <Link
                href="/services/domicile-certificate-haripur/questionnaire"
                className="text-link"
              >
                Skipping a question
              </Link>
              <span className="block text-sm text-slate-500">
                You&apos;ll be asked to answer it before you can continue.
              </span>
            </li>
            <li>
              <Link
                href="/services/police-character-certificate-haripur"
                className="text-link"
              >
                A service without a checklist yet
              </Link>
              <span className="block text-sm text-slate-500">
                Its checklist is still a draft, so it can&apos;t be used yet.
              </span>
            </li>
            <li>
              <Link href="/checklists/EZD-XXX-0000" className="text-link">
                A checklist code that doesn&apos;t exist
              </Link>
              <span className="block text-sm text-slate-500">
                Shows what happens when a code is mistyped.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Rule checks</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Each time this page loads, these example cases are run against
            version 2.0 of the Domicile Certificate checklist and compared with
            the documents we expect. These are automatic checks of the rules,
            not results from testing with real people. No user testing has been
            done yet.
          </p>
          {checks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Version 2.0 wasn&apos;t found, so the checks couldn&apos;t run.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-300 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Case</th>
                    <th className="py-2 pr-4 font-medium">Expected</th>
                    <th className="py-2 pr-4 font-medium">Listed</th>
                    <th className="py-2 pr-4 font-medium">Left out</th>
                    <th className="py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {checks.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2.5 pr-4 text-slate-800">{c.name}</td>
                      <td className="py-2.5 pr-4">{c.expected}</td>
                      <td className="py-2.5 pr-4">{c.listed}</td>
                      <td className="py-2.5 pr-4">{c.excluded}</td>
                      <td
                        className={`py-2.5 ${
                          c.match ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {c.match ? "Matches" : "Doesn't match"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-6 text-sm text-slate-600">
            So far, {usage.total} checklists have been saved on this site.{" "}
            {usage.fullyReady} are fully ready, the average checklist is{" "}
            {usage.avgReady}% ready, and {usage.missing} documents are still
            marked as missing. These numbers include the sample checklists.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Limitations</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
            <li>Only one service has a published checklist.</li>
            <li>The requirements are sample information, not official rules.</li>
            <li>
              EZDocs doesn&apos;t connect to any government system. Nothing is
              submitted on your behalf.
            </li>
            <li>
              Anyone with your checklist code can open it, so don&apos;t put
              personal details in notes.
            </li>
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
}
