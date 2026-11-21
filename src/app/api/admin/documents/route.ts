import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  try {
    await ensureSeeded();
    const allDocs = await db.select().from(documents).orderBy(documents.id);
    return NextResponse.json({
      documents: allDocs.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/documents error:", err);
    return NextResponse.json(
      { error: "Failed to load documents." },
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
    const title = String(body.title || "").trim();
    const category = String(body.category || "Identity").trim();
    const defaultInstructions = String(body.defaultInstructions || "").trim();
    const originalOrCopy = String(
      body.originalOrCopy || "Original + 1 Photocopy"
    ).trim();
    const verificationStatus =
      body.verificationStatus === "verified" ? "verified" : "illustrative";
    const sourceNote = String(
      body.sourceNote || "Illustrative sample — verify with relevant office."
    ).trim();

    if (!title || !defaultInstructions) {
      return NextResponse.json(
        { error: "Title and default instructions are required." },
        { status: 400 }
      );
    }

    const rawCode =
      String(body.code || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, "-") ||
      `DOC-${title
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .slice(0, 14)}-${Date.now().toString().slice(-3)}`;

    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.code, rawCode));
    const finalCode =
      existing.length > 0 ? `${rawCode}-${Date.now().toString().slice(-3)}` : rawCode;

    const [created] = await db
      .insert(documents)
      .values({
        code: finalCode,
        title,
        category,
        defaultInstructions,
        originalOrCopy,
        verificationStatus,
        sourceNote,
      })
      .returning();

    return NextResponse.json(
      {
        document: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/documents error:", err);
    return NextResponse.json(
      { error: "Failed to create document." },
      { status: 500 }
    );
  }
}
