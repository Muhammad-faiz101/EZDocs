import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin authentication required." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const versionId = Number(id);
    if (!Number.isInteger(versionId)) {
      return NextResponse.json({ error: "Invalid version ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.id, versionId));

    if (!existing) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    if (existing.status === "published") {
      return NextResponse.json(
        { error: "This checklist version is already published." },
        { status: 409 }
      );
    }

    if (existing.requirementsJson.length === 0) {
      return NextResponse.json(
        { error: "Cannot publish a checklist with zero document requirements." },
        { status: 400 }
      );
    }

    if (!existing.effectiveDate || !existing.sourceReference) {
      return NextResponse.json(
        {
          error:
            "Effective date and source reference must be filled before publishing.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const [published] = await db
      .update(checklistVersions)
      .set({
        status: "published",
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(checklistVersions.id, versionId))
      .returning();

    return NextResponse.json({
      version: {
        ...published,
        publishedAt: published.publishedAt
          ? published.publishedAt.toISOString()
          : null,
        createdAt: published.createdAt.toISOString(),
        updatedAt: published.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST /api/admin/versions/[id]/publish error:", err);
    return NextResponse.json(
      { error: "Failed to publish checklist version." },
      { status: 500 }
    );
  }
}
