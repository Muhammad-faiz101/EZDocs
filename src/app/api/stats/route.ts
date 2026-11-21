import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistSessions,
  checklistVersions,
  documents,
  services,
} from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { calculateChecklistProgress } from "@/lib/checklist-engine";

export async function GET() {
  try {
    await ensureSeeded();

    const [allServices, allDocs, allVersions, allSessions] = await Promise.all([
      db.select().from(services),
      db.select().from(documents),
      db
        .select()
        .from(checklistVersions)
        .orderBy(desc(checklistVersions.publishedAt), desc(checklistVersions.id)),
      db
        .select()
        .from(checklistSessions)
        .orderBy(desc(checklistSessions.updatedAt)),
    ]);

    const publishedVersions = allVersions.filter((v) => v.status === "published");
    const draftVersions = allVersions.filter((v) => v.status === "draft");

    const latestPublishedByService = new Map<number, number>();
    for (const v of publishedVersions) {
      if (!latestPublishedByService.has(v.serviceId)) {
        latestPublishedByService.set(v.serviceId, v.id);
      }
    }

    let totalReadinessPct = 0;
    let totalMissingDetected = 0;
    let totalNeedsVerification = 0;
    let totalExcludedConditional = 0;
    let fullyReadySessions = 0;
    let outdatedSessions = 0;
    let upgradedSessionsCount = 0;

    const recentSessions = allSessions.slice(0, 10).map((s) => {
      const progress = calculateChecklistProgress(s.itemsJson);
      const latestId = latestPublishedByService.get(s.serviceId);
      const isOutdated = Boolean(latestId && latestId !== s.checklistVersionId);
      return {
        sessionCode: s.sessionCode,
        serviceName: s.serviceName,
        serviceSlug: s.serviceSlug,
        jurisdiction: s.jurisdiction,
        versionNumber: s.versionNumber,
        applicantLabel: s.applicantLabel,
        progress,
        isOutdated,
        parentSessionCode: s.parentSessionCode,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    });

    for (const s of allSessions) {
      const progress = calculateChecklistProgress(s.itemsJson);
      totalReadinessPct += progress.readinessPercent;
      totalMissingDetected += progress.missing;
      totalNeedsVerification += progress.needsVerification;
      totalExcludedConditional += s.excludedItemsJson.length;
      if (progress.isFullyReady) fullyReadySessions++;
      const latestId = latestPublishedByService.get(s.serviceId);
      if (latestId && latestId !== s.checklistVersionId) outdatedSessions++;
      if (s.parentSessionCode) upgradedSessionsCount++;
    }

    const avgReadinessPercent =
      allSessions.length > 0
        ? Math.round(totalReadinessPct / allSessions.length)
        : 0;

    return NextResponse.json({
      stats: {
        totalServices: allServices.length,
        activeServices: allServices.filter((s) => s.isActive).length,
        servicesWithPublishedChecklist: latestPublishedByService.size,
        totalDocuments: allDocs.length,
        publishedVersionsCount: publishedVersions.length,
        draftVersionsCount: draftVersions.length,
        totalSessions: allSessions.length,
        fullyReadySessions,
        avgReadinessPercent,
        totalMissingDetected,
        totalNeedsVerification,
        totalExcludedConditional,
        outdatedSessions,
        upgradedSessionsCount,
      },
      recentSessions,
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
    return NextResponse.json(
      { error: "Failed to load platform statistics." },
      { status: 500 }
    );
  }
}
