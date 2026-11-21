import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const category = (searchParams.get("category") || "").trim();
    const includeInactive = searchParams.get("includeInactive") === "true";

    const allServices = await db
      .select()
      .from(services)
      .orderBy(services.id);

    const allVersions = await db
      .select()
      .from(checklistVersions)
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const versionsByService = new Map<number, typeof allVersions>();
    for (const v of allVersions) {
      const list = versionsByService.get(v.serviceId) ?? [];
      list.push(v);
      versionsByService.set(v.serviceId, list);
    }

    const enriched = allServices
      .filter((s) => (includeInactive ? true : s.isActive))
      .filter((s) => {
        if (category && category !== "all" && s.category !== category) {
          return false;
        }
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.jurisdiction.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q) ||
          s.officeName.toLowerCase().includes(q)
        );
      })
      .map((s) => {
        const sVersions = versionsByService.get(s.id) ?? [];
        const published = sVersions.filter((v) => v.status === "published");
        const drafts = sVersions.filter((v) => v.status === "draft");
        const latest = published[0] ?? null;

        return {
          ...s,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          publishedVersionCount: published.length,
          draftVersionCount: drafts.length,
          latestPublishedVersion: latest
            ? {
                id: latest.id,
                versionNumber: latest.versionNumber,
                effectiveDate: latest.effectiveDate,
                publishedAt: latest.publishedAt
                  ? latest.publishedAt.toISOString()
                  : null,
                lastVerifiedDate: latest.lastVerifiedDate,
                requirementCount: latest.requirementsJson.length,
                questionCount: latest.questionsJson.length,
              }
            : null,
        };
      });

    return NextResponse.json({ services: enriched });
  } catch (err) {
    console.error("GET /api/services error:", err);
    return NextResponse.json(
      { error: "Failed to load government services." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const jurisdiction = String(body.jurisdiction || "").trim();
    const officeName = String(body.officeName || "").trim();
    const category = String(body.category || "Identity & Residency").trim();
    const summary = String(body.summary || "").trim();
    const description = String(body.description || summary).trim();
    const estimatedTime = String(body.estimatedTime || "About 10 minutes").trim();
    const feeInfo = String(
      body.feeInfo || "Confirm the fee at the office."
    ).trim();

    if (!name || !jurisdiction || !officeName || !summary) {
      return NextResponse.json(
        { error: "Name, jurisdiction, office name, and summary are required." },
        { status: 400 }
      );
    }

    const rawSlug =
      String(body.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `${name}-${jurisdiction.split(",")[0]}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const existing = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.slug, rawSlug));

    const finalSlug = existing.length > 0 ? `${rawSlug}-${Date.now().toString().slice(-4)}` : rawSlug;

    const [created] = await db
      .insert(services)
      .values({
        slug: finalSlug,
        name,
        jurisdiction,
        officeName,
        category,
        summary,
        description,
        estimatedTime,
        feeInfo,
        isActive: body.isActive !== false,
      })
      .returning();

    return NextResponse.json(
      {
        service: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/services error:", err);
    return NextResponse.json(
      { error: "Failed to create service." },
      { status: 500 }
    );
  }
}
