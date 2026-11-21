import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

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
    const docId = Number(id);
    if (!Number.isInteger(docId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId));

    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const body = await request.json();
    const [updated] = await db
      .update(documents)
      .set({
        title: body.title !== undefined ? String(body.title).trim() : existing.title,
        category:
          body.category !== undefined
            ? String(body.category).trim()
            : existing.category,
        defaultInstructions:
          body.defaultInstructions !== undefined
            ? String(body.defaultInstructions).trim()
            : existing.defaultInstructions,
        originalOrCopy:
          body.originalOrCopy !== undefined
            ? String(body.originalOrCopy).trim()
            : existing.originalOrCopy,
        verificationStatus:
          body.verificationStatus === "verified" ||
          body.verificationStatus === "illustrative"
            ? body.verificationStatus
            : existing.verificationStatus,
        sourceNote:
          body.sourceNote !== undefined
            ? String(body.sourceNote).trim()
            : existing.sourceNote,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docId))
      .returning();

    return NextResponse.json({
      document: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/documents/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update document." },
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
    const docId = Number(id);
    if (!Number.isInteger(docId)) {
      return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(documents)
      .where(eq(documents.id, docId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ deletedId: deleted.id });
  } catch (err) {
    console.error("DELETE /api/admin/documents/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}
