import { jsPDF } from "jspdf";
import type { ChecklistSessionRecord } from "./types";
import { calculateChecklistProgress } from "./checklist-engine";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function downloadChecklistPdf(session: ChecklistSessionRecord): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const progress = calculateChecklistProgress(session.itemsJson);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 58) {
      doc.addPage();
      y = 44;
    }
  };

  // --- Top Navy Header Banner ---
  doc.setFillColor(15, 23, 42); // #0F172A Deep Navy
  doc.rect(0, 0, pageWidth, 88, "F");

  // Teal accent bar under header
  doc.setFillColor(13, 148, 136); // #0D9488 Teal
  doc.rect(0, 88, pageWidth, 4, "F");

  // EZDocs Brand Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("EZDocs", margin, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text("Document checklist  |  Prepare before you visit", margin, 52);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${session.serviceName} — ${session.jurisdiction}`,
    margin,
    73
  );

  // Right-side version & session badge in header
  doc.setFont("courier", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(153, 246, 228);
  doc.text(`CODE: ${session.sessionCode}`, pageWidth - margin, 34, {
    align: "right",
  });
  doc.text(`VERSION ${session.versionNumber}`, pageWidth - margin, 50, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Created: ${formatDate(session.createdAt)}`,
    pageWidth - margin,
    66,
    { align: "right" }
  );

  y = 110;

  // --- Metadata & Readiness Summary Card ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 74, 5, 5, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("SUMMARY", margin + 12, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const col1X = margin + 12;
  const col2X = margin + contentWidth * 0.52;

  doc.text(
    `Effective Date: ${formatDate(session.versionSnapshotMeta.effectiveDate)}`,
    col1X,
    y + 34
  );
  doc.text(
    `Published Date: ${formatDate(session.versionSnapshotMeta.publishedAt)}`,
    col1X,
    y + 47
  );
  doc.text(
    `Last checked: ${formatDate(session.versionSnapshotMeta.lastVerifiedDate)}`,
    col1X,
    y + 60
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 148, 136);
  doc.text(
    `${progress.ready} of ${progress.total} documents ready (${progress.readinessPercent}%)`,
    col2X,
    y + 34
  );
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Missing: ${progress.missing}   |   Needs checking: ${progress.needsVerification}`,
    col2X,
    y + 47
  );
  doc.text(
    `Not needed for you: ${session.excludedItemsJson.length}`,
    col2X,
    y + 60
  );

  y += 90;

  if (session.applicantLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Name: ${session.applicantLabel}`, margin, y);
    y += 16;
  }

  // --- Illustrative Disclaimer Box ---
  const disclaimerLines = doc.splitTextToSize(
    session.versionSnapshotMeta.disclaimerText,
    contentWidth - 20
  );
  const disclaimerHeight = disclaimerLines.length * 11 + 18;
  ensureSpace(disclaimerHeight + 10);

  doc.setFillColor(255, 251, 235); // Warm amber tint
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, contentWidth, disclaimerHeight, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text("PLEASE NOTE", margin + 10, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.text(disclaimerLines, margin + 10, y + 24);
  y += disclaimerHeight + 14;

  // --- Helper to render a section of documents ---
  const renderSection = (
    heading: string,
    subtitle: string,
    items: ChecklistSessionRecord["itemsJson"]
  ) => {
    if (items.length === 0) return;
    ensureSpace(34);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, margin, y + 12);

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y + 17, pageWidth - margin, y + 17);
    y += 28;

    for (const item of items) {
      const instrLines = doc.splitTextToSize(
        item.instructions,
        contentWidth - 36
      );
      const tipLines = item.tips
        ? doc.splitTextToSize(`Tip: ${item.tips}`, contentWidth - 36)
        : [];
      const noteLines = item.citizenNote
        ? doc.splitTextToSize(`Note: ${item.citizenNote}`, contentWidth - 36)
        : [];
      const condLines =
        item.requirementType === "conditional"
          ? doc.splitTextToSize(
              `Based on your answers: ${item.conditionSummary}`,
              contentWidth - 36
            )
          : [];

      const cardHeight =
        36 +
        instrLines.length * 10.5 +
        (condLines.length > 0 ? condLines.length * 10 + 4 : 0) +
        (tipLines.length > 0 ? tipLines.length * 10 + 4 : 0) +
        (noteLines.length > 0 ? noteLines.length * 10 + 4 : 0) +
        14;

      ensureSpace(cardHeight + 8);

      // Card container
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, "FD");

      // Printable Checkbox
      const boxX = margin + 10;
      const boxY = y + 11;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1);
      doc.rect(boxX, boxY, 11, 11);
      if (item.status === "ready") {
        doc.setDrawColor(13, 148, 136);
        doc.setLineWidth(1.6);
        doc.line(boxX + 2, boxY + 6, boxX + 4.8, boxY + 8.8);
        doc.line(boxX + 4.8, boxY + 8.8, boxX + 9.2, boxY + 2.5);
        doc.setLineWidth(0.5);
      }

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.8);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(item.title, contentWidth - 135);
      doc.text(titleLines[0] ?? item.title, margin + 28, y + 19);

      // Status Pill text on right
      const statusLabel =
        item.status === "ready"
          ? "READY"
          : item.status === "needs_verification"
          ? "NEEDS CHECKING"
          : "MISSING";
      if (item.status === "ready") doc.setTextColor(5, 150, 105);
      else if (item.status === "needs_verification") doc.setTextColor(180, 83, 9);
      else doc.setTextColor(220, 38, 38);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.text(statusLabel, pageWidth - margin - 10, y + 18, { align: "right" });

      // Sub-meta row: Original/Copy + Illustrative tag
      let innerY = y + 32;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(13, 148, 136);
      doc.text(`Format: ${item.originalOrCopy}`, margin + 28, innerY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const verTag =
        item.verificationStatus === "verified"
          ? "Confirmed requirement"
          : "Sample requirement";
      doc.text(
        `${item.category}  |  ${verTag}`,
        pageWidth - margin - 10,
        innerY,
        { align: "right" }
      );
      innerY += 12;

      if (condLines.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(15, 118, 110);
        doc.text(condLines, margin + 28, innerY);
        innerY += condLines.length * 10 + 3;
      }

      // Instructions
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.3);
      doc.setTextColor(51, 65, 85);
      doc.text(instrLines, margin + 28, innerY);
      innerY += instrLines.length * 10.5 + 3;

      if (tipLines.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.8);
        doc.setTextColor(71, 85, 105);
        doc.text(tipLines, margin + 28, innerY);
        innerY += tipLines.length * 10 + 3;
      }

      if (noteLines.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(146, 64, 14);
        doc.text(noteLines, margin + 28, innerY);
      }

      y += cardHeight + 8;
    }

    y += 6;
  };

  const mandatoryItems = session.itemsJson.filter(
    (i) => i.requirementType === "mandatory"
  );
  const conditionalItems = session.itemsJson.filter(
    (i) => i.requirementType === "conditional"
  );

  renderSection(
    `Required for everyone (${mandatoryItems.length})`,
    "Everyone applying needs these.",
    mandatoryItems
  );

  renderSection(
    `Required for your situation (${conditionalItems.length})`,
    "Based on your answers to the questions.",
    conditionalItems
  );

  // --- Excluded Documents Note ---
  if (session.excludedItemsJson.length > 0) {
    ensureSpace(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Not needed for you (${session.excludedItemsJson.length})`,
      margin,
      y
    );
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const excludedText = session.excludedItemsJson
      .map((e) => `• ${e.title}`)
      .join("   ");
    const exclLines = doc.splitTextToSize(excludedText, contentWidth);
    doc.text(exclLines, margin, y);
    y += exclLines.length * 10 + 14;
  }

  // --- Source References Box ---
  const sourceLines = doc.splitTextToSize(
    `Source Reference: ${session.versionSnapshotMeta.sourceReference}`,
    contentWidth - 16
  );
  const sourceHeight = sourceLines.length * 10.5 + 24;
  ensureSpace(sourceHeight + 10);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, sourceHeight, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("SOURCE", margin + 8, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(sourceLines, margin + 8, y + 24);

  // --- Footer on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `EZDocs  |  Checklist ${session.sessionCode}  |  Version ${session.versionNumber}`,
      margin,
      pageHeight - 22
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 22, {
      align: "right",
    });
  }

  const safeSlug = session.serviceSlug.replace(/[^a-z0-9-]/gi, "_");
  doc.save(`EZDocs_${safeSlug}_v${session.versionNumber}_${session.sessionCode}.pdf`);
}
