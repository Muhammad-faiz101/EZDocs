import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { checklistSessions, checklistVersions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { compareChecklistVersions } from "@/lib/version-diff";
import type { ChecklistItemStatus, ChecklistVersionRecord } from "@/lib/types";

const VALID_STATUSES = new Set<ChecklistItemStatus>([
  "ready",
  "missing",
  "needs_verification",
]);

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await ensureSeeded();
    const { code } = await context.params;
    const normalized = decodeURIComponent(code).trim().toUpperCase();

    const [session] = await db
      .select()
      .from(checklistSessions)
      .where(eq(checklistSessions.sessionCode, normalized));

    if (!session) {
      return NextResponse.json(
        {
          error: `Checklist session "${normalized}" could not be found.`,
          errorCode: "SESSION_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Fetch session's original version & latest published version for outdated detection
    const [sessionVersion] = await db
      .select()
      .from(checklistVersions)
      .where(eq(checklistVersions.id, session.checklistVersionId));

    const publishedVersions = await db
      .select()
      .from(checklistVersions)
      .where(
        and(
          eq(checklistVersions.serviceId, session.serviceId),
          eq(checklistVersions.status, "published")
        )
      )
      .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id));

    const latestPublished = publishedVersions[0] ?? null;
    const isOutdated = Boolean(
      latestPublished && latestPublished.id !== session.checklistVersionId
    );

    let updateInfo = null;
    if (isOutdated && sessionVersion && latestPublished) {
      const comparison = compareChecklistVersions(
        session.serviceName,
        toVersionRecord(sessionVersion),
        toVersionRecord(latestPublished)
      );
      updateInfo = {
        latestVersionId: latestPublished.id,
        latestVersionNumber: latestPublished.versionNumber,
        latestEffectiveDate: latestPublished.effectiveDate,
        latestPublishedAt: latestPublished.publishedAt
          ? latestPublished.publishedAt.toISOString()
          : null,
        changelogSummary: latestPublished.changelogSummary,
        diffSummary: comparison.summary,
        comparison,
      };
    }

    // Check if an upgraded child session already exists for this session
    const childSessions = await db
      .select({
        sessionCode: checklistSessions.sessionCode,
        versionNumber: checklistSessions.versionNumber,
        createdAt: checklistSessions.createdAt,
      })
      .from(checklistSessions)
      .where(eq(checklistSessions.parentSessionCode, session.sessionCode))
      .orderBy(desc(checklistSessions.createdAt));

    return NextResponse.json({
      session: {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      questions: sessionVersion?.questionsJson ?? [],
      isOutdated,
      updateInfo,
      upgradedSessions: childSessions.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/sessions/[code] error:", err);
    return NextResponse.json(
      { error: "Failed to load checklist session." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    await ensureSeeded();
    const { code } = await context.params;
    const normalized = decodeURIComponent(code).trim().toUpperCase();

    const [session] = await db
      .select()
      .from(checklistSessions)
      .where(eq(checklistSessions.sessionCode, normalized));

    if (!session) {
      return NextResponse.json(
        { error: "Checklist session not found.", errorCode: "SESSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();
    let updatedItems = [...session.itemsJson];

    if (body.requirementId && body.status) {
      if (!VALID_STATUSES.has(body.status)) {
        return NextResponse.json(
          { error: "Invalid document status value." },
          { status: 400 }
        );
      }
      updatedItems = updatedItems.map((item) =>
        item.requirementId === body.requirementId
          ? {
              ...item,
              status: body.status,
              citizenNote:
                typeof body.citizenNote === "string"
                  ? body.citizenNote.slice(0, 500)
                  : item.citizenNote,
            }
          : item
      );
    } else if (body.requirementId && typeof body.citizenNote === "string") {
      updatedItems = updatedItems.map((item) =>
        item.requirementId === body.requirementId
          ? { ...item, citizenNote: body.citizenNote.slice(0, 500) }
          : item
      );
    } else if (Array.isArray(body.items)) {
      const incomingMap = new Map<
        string,
        { status?: ChecklistItemStatus; citizenNote?: string }
      >(
        body.items.map(
          (i: {
            requirementId: string;
            status?: ChecklistItemStatus;
            citizenNote?: string;
          }) => [i.requirementId, i]
        )
      );
      updatedItems = updatedItems.map((item) => {
        const patch = incomingMap.get(item.requirementId);
        if (!patch) return item;
        return {
          ...item,
          status:
            patch.status && VALID_STATUSES.has(patch.status)
              ? patch.status
              : item.status,
          citizenNote:
            typeof patch.citizenNote === "string"
              ? patch.citizenNote.slice(0, 500)
              : item.citizenNote,
        };
      });
    }

    const applicantLabel =
      typeof body.applicantLabel === "string"
        ? body.applicantLabel.trim().slice(0, 120)
        : session.applicantLabel;

    const [updated] = await db
      .update(checklistSessions)
      .set({
        itemsJson: updatedItems,
        applicantLabel,
        updatedAt: new Date(),
      })
      .where(eq(checklistSessions.id, session.id))
      .returning();

    return NextResponse.json({
      session: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/sessions/[code] error:", err);
    return NextResponse.json(
      { error: "Failed to save checklist updates." },
      { status: 500 }
    );
  }
}
