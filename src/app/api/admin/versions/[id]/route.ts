import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await context.params;
    const versionId = Number(id);
    if (!Number.isInteger(versionId)) {
      return NextResponse.json({ error: "Invalid version ID." }, { status: 400 });
    }

    const [version] = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.id, versionId));

    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    return NextResponse.json({
      version: {
        ...version,
        publishedAt: version.publishedAt
          ? version.publishedAt.toISOString()
          : null,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/versions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch checklist version." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
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

    // Strict Immutability Guard
    if (existing.status === "published") {
      return NextResponse.json(
        {
          error:
            "Published checklist versions are immutable and cannot be modified. Clone this version into a new draft to make changes.",
          errorCode: "VERSION_IMMUTABLE",
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    const [updated] = await db
      .update(checklistVersions)
      .set({
        versionNumber:
          body.versionNumber !== undefined
            ? String(body.versionNumber).trim()
            : existing.versionNumber,
        changelogSummary:
          body.changelogSummary !== undefined
            ? String(body.changelogSummary).trim()
            : existing.changelogSummary,
        effectiveDate:
          body.effectiveDate !== undefined
            ? String(body.effectiveDate).trim()
            : existing.effectiveDate,
        lastVerifiedDate:
          body.lastVerifiedDate !== undefined
            ? String(body.lastVerifiedDate).trim()
            : existing.lastVerifiedDate,
        sourceReference:
          body.sourceReference !== undefined
            ? String(body.sourceReference).trim()
            : existing.sourceReference,
        disclaimerText:
          body.disclaimerText !== undefined
            ? String(body.disclaimerText).trim()
            : existing.disclaimerText,
        questionsJson: Array.isArray(body.questionsJson)
          ? body.questionsJson
          : existing.questionsJson,
        requirementsJson: Array.isArray(body.requirementsJson)
          ? body.requirementsJson
          : existing.requirementsJson,
        updatedAt: new Date(),
      })
      .where(eq(checklistVersions.id, versionId))
      .returning();

    return NextResponse.json({
      version: {
        ...updated,
        publishedAt: updated.publishedAt
          ? updated.publishedAt.toISOString()
          : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/versions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to save draft changes." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
        {
          error: "Published checklist versions are immutable and cannot be deleted.",
          errorCode: "VERSION_IMMUTABLE",
        },
        { status: 409 }
      );
    }

    await db.delete(checklistVersions).where(eq(checklistVersions.id, versionId));
    return NextResponse.json({ deletedId: versionId });
  } catch (err) {
    console.error("DELETE /api/admin/versions/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete draft version." },
      { status: 500 }
    );
  }
}
