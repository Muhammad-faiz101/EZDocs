import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";
import type { QuestionDefinition, VersionRequirement } from "@/lib/types";

function computeNextVersionNumber(existingVersions: string[]): string {
  if (existingVersions.length === 0) return "1.0";
  let maxMajor = 0;
  let maxMinor = 0;
  for (const v of existingVersions) {
    const parts = v.split(".").map((p) => Number.parseInt(p, 10));
    const major = Number.isFinite(parts[0]) ? parts[0] : 0;
    const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
    if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
      maxMajor = major;
      maxMinor = minor;
    }
  }
  return `${maxMajor}.${maxMinor + 1}`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const serviceIdParam = searchParams.get("serviceId");

    let rows;
    if (serviceIdParam) {
      const serviceId = Number(serviceIdParam);
      if (!Number.isInteger(serviceId)) {
        return NextResponse.json(
          { error: "Invalid serviceId parameter." },
          { status: 400 }
        );
      }
      rows = await db
        .select()
        .from(checklistVersions)
        .where(eq(checklistVersions.serviceId, serviceId))
        .orderBy(desc(checklistVersions.id));
    } else {
      rows = await db
        .select()
        .from(checklistVersions)
        .orderBy(desc(checklistVersions.id));
    }

    return NextResponse.json({
      versions: rows.map((v) => ({
        ...v,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/versions error:", err);
    return NextResponse.json(
      { error: "Failed to load checklist versions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const serviceId = Number(body.serviceId);
    if (!Number.isInteger(serviceId)) {
      return NextResponse.json(
        { error: "Valid serviceId is required." },
        { status: 400 }
      );
    }

    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, serviceId));

    if (!service) {
      return NextResponse.json(
        { error: "Service not found." },
        { status: 404 }
      );
    }

    const existingVersions = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.serviceId, serviceId));

    let versionNumber = String(body.versionNumber || "").trim();
    if (!versionNumber) {
      versionNumber = computeNextVersionNumber(
        existingVersions.map((v) => v.versionNumber)
      );
    }

    const duplicate = await db
      .select({ id: checklistVersions.id })
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.serviceId, serviceId),
          eq(checklistVersions.versionNumber, versionNumber)
        )
      );

    if (duplicate.length > 0) {
      return NextResponse.json(
        {
          error: `Version ${versionNumber} already exists for this service. Please choose a new version number.`,
        },
        { status: 409 }
      );
    }

    let questionsJson: QuestionDefinition[] = [];
    let requirementsJson: VersionRequirement[] = [];
    let sourceReference =
      String(body.sourceReference || "").trim() ||
      `Not yet confirmed with ${service.officeName}.`;
    let disclaimerText =
      String(body.disclaimerText || "").trim() ||
      `These requirements are sample information and have not been confirmed with ${service.officeName}. Please confirm with the office before you visit.`;

    if (body.cloneFromVersionId) {
      const cloneId = Number(body.cloneFromVersionId);
      const [sourceVer] = await db
        .select()
        .from(checklistVersions)
        .where(eq(checklistVersions.id, cloneId));
      if (sourceVer) {
        questionsJson = JSON.parse(JSON.stringify(sourceVer.questionsJson));
        requirementsJson = JSON.parse(
          JSON.stringify(sourceVer.requirementsJson)
        ).map((r: VersionRequirement, idx: number) => ({
          ...r,
          id: `req-${versionNumber.replace(/\./g, "_")}-${idx + 1}-${Date.now().toString().slice(-4)}`,
        }));
        sourceReference = sourceVer.sourceReference;
        disclaimerText = sourceVer.disclaimerText;
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const [created] = await db
      .insert(checklistVersions)
      .values({
        serviceId,
        versionNumber,
        status: "draft",
        changelogSummary:
          String(body.changelogSummary || "").trim() ||
          (body.cloneFromVersionId
            ? "Requirements updated."
            : "First version."),
        effectiveDate: String(body.effectiveDate || today),
        publishedAt: null,
        lastVerifiedDate: String(body.lastVerifiedDate || today),
        sourceReference,
        disclaimerText,
        questionsJson,
        requirementsJson,
        createdBy: admin.email,
      })
      .returning();

    return NextResponse.json(
      {
        version: {
          ...created,
          publishedAt: null,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/versions error:", err);
    return NextResponse.json(
      { error: "Failed to create draft checklist version." },
      { status: 500 }
    );
  }
}
