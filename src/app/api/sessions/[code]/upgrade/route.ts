import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistSessions, checklistVersions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  generatePersonalizedChecklist,
  generateSessionCode,
} from "@/lib/checklist-engine";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await ensureSeeded();
    const { code } = await context.params;
    const normalized = decodeURIComponent(code).trim().toUpperCase();

    const [original] = await db
      .select()
      .from(checklistSessions)
      .where(eq(checklistSessions.sessionCode, normalized));

    if (!original) {
      return NextResponse.json(
        { error: "Original checklist session not found." },
        { status: 404 }
      );
    }

    const publishedVersions = await db
      .select()
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.serviceId, original.serviceId),
          eq(checklistVersions.status, "published")
        )
      )
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const latestPublished = publishedVersions[0];
    if (!latestPublished) {
      return NextResponse.json(
        { error: "No newer published version available." },
        { status: 422 }
      );
    }

    // Optional supplemental answers for newly added questions in the new version
    let extraAnswers: Record<string, string> = {};
    try {
      const body = await request.json();
      if (body && typeof body.extraAnswers === "object" && body.extraAnswers) {
        extraAnswers = body.extraAnswers;
      }
    } catch {
      // No body provided is fine
    }

    const mergedAnswers: Record<string, string> = {
      ...original.answersJson,
      ...extraAnswers,
    };

    // For any brand new question in the newer version that has no answer yet, default safely to its first option
    for (const q of latestPublished.questionsJson) {
      if (!mergedAnswers[q.key] && q.options.length > 0) {
        mergedAnswers[q.key] = q.options[0].value;
      }
    }

    const { items, excludedItems } = generatePersonalizedChecklist(
      latestPublished.requirementsJson,
      latestPublished.questionsJson,
      mergedAnswers,
      original.itemsJson // carry over matching document readiness statuses!
    );

    const newSessionCode = generateSessionCode(original.serviceSlug);
    const updatedLabel = original.applicantLabel
      ? `${original.applicantLabel.replace(/\s*\(v[\d.]+\s*->.*\)$/, "")} (Updated to v${latestPublished.versionNumber})`
      : `Updated from ${original.sessionCode} (v${latestPublished.versionNumber})`;

    const [created] = await db
      .insert(checklistSessions)
      .values({
        sessionCode: newSessionCode,
        serviceId: original.serviceId,
        serviceSlug: original.serviceSlug,
        serviceName: original.serviceName,
        jurisdiction: original.jurisdiction,
        checklistVersionId: latestPublished.id,
        versionNumber: latestPublished.versionNumber,
        applicantLabel: updatedLabel.slice(0, 120),
        answersJson: mergedAnswers,
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
        parentSessionCode: original.sessionCode,
      })
      .returning();

    return NextResponse.json(
      {
        session: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
        preservedOriginalCode: original.sessionCode,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/sessions/[code]/upgrade error:", err);
    return NextResponse.json(
      { error: "Failed to generate updated checklist." },
      { status: 500 }
    );
  }
}
