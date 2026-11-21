import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await ensureSeeded();
    const { slug } = await context.params;

    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.slug, slug));

    if (!service) {
      return NextResponse.json(
        { error: "Government service not found." },
        { status: 404 }
      );
    }

    const versions = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.serviceId, service.id))
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const publishedVersions = versions
      .filter((v) => v.status === "published")
      .map((v) => ({
        ...v,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      }));

    const latestPublishedVersion = publishedVersions[0] ?? null;

    return NextResponse.json({
      service: {
        ...service,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
      },
      latestPublishedVersion,
      publishedVersions,
      draftCount: versions.filter((v) => v.status === "draft").length,
    });
  } catch (err) {
    console.error("GET /api/services/[slug] error:", err);
    return NextResponse.json(
      { error: "Failed to load service details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    await ensureSeeded();
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
    }

    const { slug } = await context.params;
    const [existing] = await db
      .select()
      .from(services)
      .where(eq(services.slug, slug));

    if (!existing) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const body = await request.json();
    const [updated] = await db
      .update(services)
      .set({
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        jurisdiction:
          body.jurisdiction !== undefined
            ? String(body.jurisdiction).trim()
            : existing.jurisdiction,
        officeName:
          body.officeName !== undefined
            ? String(body.officeName).trim()
            : existing.officeName,
        category:
          body.category !== undefined
            ? String(body.category).trim()
            : existing.category,
        summary:
          body.summary !== undefined
            ? String(body.summary).trim()
            : existing.summary,
        description:
          body.description !== undefined
            ? String(body.description).trim()
            : existing.description,
        estimatedTime:
          body.estimatedTime !== undefined
            ? String(body.estimatedTime).trim()
            : existing.estimatedTime,
        feeInfo:
          body.feeInfo !== undefined
            ? String(body.feeInfo).trim()
            : existing.feeInfo,
        isActive:
          typeof body.isActive === "boolean" ? body.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(services.id, existing.id))
      .returning();

    return NextResponse.json({
      service: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/services/[slug] error:", err);
    return NextResponse.json(
      { error: "Failed to update service." },
      { status: 500 }
    );
  }
}
