import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistSessions, checklistVersions, services } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  calculateChecklistProgress,
  generatePersonalizedChecklist,
  generateSessionCode,
  validateQuestionnaireAnswers,
} from "@/lib/checklist-engine";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(request.url);
    const code = (searchParams.get("code") || "").trim().toUpperCase();

    if (code) {
      const [session] = await db
        .select()
        .from(checklistSessions)
        .where(eq(checklistSessions.sessionCode, code));

      if (!session) {
        return NextResponse.json(
          {
            error: `No checklist session found for code "${code}".`,
            errorCode: "SESSION_NOT_FOUND",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        session: {
          ...session,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
      });
    }

    const recent = await db
      .select()
      .from(checklistSessions)
      .orderBy(desc(checklistSessions.updatedAt))
      .limit(20);

    // Get latest published version per service for outdated badge
    const published = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.status, "published"))
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const latestByService = new Map<number, (typeof published)[number]>();
    for (const v of published) {
      if (!latestByService.has(v.serviceId)) {
        latestByService.set(v.serviceId, v);
      }
    }

    const formatted = recent.map((s) => {
      const latest = latestByService.get(s.serviceId);
      const isOutdated = Boolean(latest && latest.id !== s.checklistVersionId);
      const progress = calculateChecklistProgress(s.itemsJson);
      return {
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        progress,
        isOutdated,
        latestVersionNumber: latest?.versionNumber ?? s.versionNumber,
      };
    });

    return NextResponse.json({ sessions: formatted });
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json(
      { error: "Failed to load checklist sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const serviceSlug = String(body.serviceSlug || "").trim();
    const answers = (body.answers || {}) as Record<string, string>;
    const applicantLabel = String(body.applicantLabel || "").trim().slice(0, 120);

    if (!serviceSlug) {
      return NextResponse.json(
        { error: "serviceSlug is required." },
        { status: 400 }
      );
    }

    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.slug, serviceSlug));

    if (!service) {
      return NextResponse.json(
        { error: "Government service not found.", errorCode: "SERVICE_NOT_FOUND" },
        { status: 404 }
      );
    }

    const publishedVersions = await db
      .select()
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.serviceId, service.id),
          eq(checklistVersions.status, "published")
        )
      )
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const latestPublished = publishedVersions[0];
    if (!latestPublished) {
      return NextResponse.json(
        {
          error:
            "This service doesn't have a published checklist yet.",
          errorCode: "NO_PUBLISHED_CHECKLIST",
        },
        { status: 422 }
      );
    }

    const validationErrors = validateQuestionnaireAnswers(
      latestPublished.questionsJson,
      answers
    );
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Please answer all the questions before creating your checklist.",
          errorCode: "MISSING_MANDATORY_ANSWERS",
          validationErrors,
        },
        { status: 400 }
      );
    }

    const { items, excludedItems } = generatePersonalizedChecklist(
      latestPublished.requirementsJson,
      latestPublished.questionsJson,
      answers
    );

    const sessionCode = generateSessionCode(service.slug);

    const [created] = await db
      .insert(checklistSessions)
      .values({
        sessionCode,
        serviceId: service.id,
        serviceSlug: service.slug,
        serviceName: service.name,
        jurisdiction: service.jurisdiction,
        checklistVersionId: latestPublished.id,
        versionNumber: latestPublished.versionNumber,
        applicantLabel,
        answersJson: answers,
        itemsJson: items,
        excludedItemsJson: excludedItems,
        versionSnapshotMeta: {
          effectiveDate: latestPublished.effectiveDate,
          publishedAt: latestPublished.publishedAt
            ? latestPublished.publishedAt.toISOString()
            : null,
          lastVerifiedDate: latestPublished.lastVerifiedDate,
          sourceReference: latestPublished.sourceReference,
          disclaimerText: latestPublished.disclaimerText,
        },
        parentSessionCode: null,
      })
      .returning();

    return NextResponse.json(
      {
        session: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json(
      { error: "Failed to generate personalized checklist." },
      { status: 500 }
    );
  }
}
