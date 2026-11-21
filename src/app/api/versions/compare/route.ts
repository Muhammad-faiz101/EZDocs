import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { compareChecklistVersions } from "@/lib/version-diff";
import type { ChecklistVersionRecord } from "@/lib/types";

function toVersionRecord(
  v: typeof checklistVersions.$inferSelect
): ChecklistVersionRecord {
  return {
    ...v,
    status: v.status as "draft" | "published",
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const baseId = Number(searchParams.get("baseId"));
    const targetId = Number(searchParams.get("targetId"));

    if (!Number.isInteger(baseId) || !Number.isInteger(targetId)) {
      return NextResponse.json(
        { error: "Both baseId and targetId integer parameters are required." },
        { status: 400 }
      );
    }

    const [base] = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.id, baseId));
    const [target] = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.id, targetId));

    if (!base || !target) {
      return NextResponse.json(
        { error: "One or both checklist versions could not be found." },
        { status: 404 }
      );
    }

    if (base.serviceId !== target.serviceId) {
      return NextResponse.json(
        { error: "Cannot compare checklist versions from different services." },
        { status: 400 }
      );
    }

    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, base.serviceId));

    const comparison = compareChecklistVersions(
      service?.name ?? "Government Service",
      toVersionRecord(base),
      toVersionRecord(target)
    );

    return NextResponse.json({ comparison });
  } catch (err) {
    console.error("GET /api/versions/compare error:", err);
    return NextResponse.json(
      { error: "Failed to compare checklist versions." },
      { status: 500 }
    );
  }
}
