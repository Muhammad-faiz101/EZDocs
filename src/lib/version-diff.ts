import type {
  ChecklistVersionRecord,
  FieldChange,
  QuestionDiffItem,
  RequirementDiffItem,
  VersionComparisonResult,
  VersionRequirement,
} from "./types";

function compareRequirementFields(
  before: VersionRequirement,
  after: VersionRequirement
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (before.title !== after.title) {
    changes.push({
      field: "title",
      label: "Document Title",
      before: before.title,
      after: after.title,
    });
  }
  if (before.requirementType !== after.requirementType) {
    changes.push({
      field: "requirementType",
      label: "Requirement Type",
      before: before.requirementType,
      after: after.requirementType,
    });
  }
  if (before.instructions !== after.instructions) {
    changes.push({
      field: "instructions",
      label: "Preparation Instructions",
      before: before.instructions,
      after: after.instructions,
    });
  }
  if (before.originalOrCopy !== after.originalOrCopy) {
    changes.push({
      field: "originalOrCopy",
      label: "Original / Photocopy Guidance",
      before: before.originalOrCopy,
      after: after.originalOrCopy,
    });
  }
  if (before.tips !== after.tips) {
    changes.push({
      field: "tips",
      label: "Preparation Tips",
      before: before.tips,
      after: after.tips,
    });
  }
  if (
    JSON.stringify(before.conditionLogic ?? null) !==
    JSON.stringify(after.conditionLogic ?? null)
  ) {
    changes.push({
      field: "conditionLogic",
      label: "Conditional Rule",
      before: before.conditionSummary || "Always mandatory",
      after: after.conditionSummary || "Always mandatory",
    });
  }
  if (before.verificationStatus !== after.verificationStatus) {
    changes.push({
      field: "verificationStatus",
      label: "Verification Status",
      before: before.verificationStatus,
      after: after.verificationStatus,
    });
  }
  if (before.sourceNote !== after.sourceNote) {
    changes.push({
      field: "sourceNote",
      label: "Source Note",
      before: before.sourceNote,
      after: after.sourceNote,
    });
  }

  return changes;
}

export function compareChecklistVersions(
  serviceName: string,
  base: ChecklistVersionRecord,
  target: ChecklistVersionRecord
): VersionComparisonResult {
  const baseReqMap = new Map(
    base.requirementsJson.map((r) => [r.documentCode, r])
  );
  const targetReqMap = new Map(
    target.requirementsJson.map((r) => [r.documentCode, r])
  );

  const requirements: RequirementDiffItem[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  // Check target requirements (added, modified, unchanged)
  for (const targetReq of target.requirementsJson) {
    const baseReq = baseReqMap.get(targetReq.documentCode);
    if (!baseReq) {
      addedCount++;
      requirements.push({
        documentCode: targetReq.documentCode,
        title: targetReq.title,
        category: targetReq.category,
        changeType: "added",
        after: targetReq,
        fieldChanges: [],
      });
    } else {
      const fieldChanges = compareRequirementFields(baseReq, targetReq);
      if (fieldChanges.length > 0) {
        modifiedCount++;
        requirements.push({
          documentCode: targetReq.documentCode,
          title: targetReq.title,
          category: targetReq.category,
          changeType: "modified",
          before: baseReq,
          after: targetReq,
          fieldChanges,
        });
      } else {
        unchangedCount++;
        requirements.push({
          documentCode: targetReq.documentCode,
          title: targetReq.title,
          category: targetReq.category,
          changeType: "unchanged",
          before: baseReq,
          after: targetReq,
          fieldChanges: [],
        });
      }
    }
  }

  // Check removed requirements
  for (const baseReq of base.requirementsJson) {
    if (!targetReqMap.has(baseReq.documentCode)) {
      removedCount++;
      requirements.push({
        documentCode: baseReq.documentCode,
        title: baseReq.title,
        category: baseReq.category,
        changeType: "removed",
        before: baseReq,
        fieldChanges: [],
      });
    }
  }

  // Sort: added, removed, modified, unchanged
  const order = { added: 0, removed: 1, modified: 2, unchanged: 3 };
  requirements.sort((a, b) => order[a.changeType] - order[b.changeType]);

  // Compare questions
  const baseQMap = new Map(base.questionsJson.map((q) => [q.key, q]));
  const targetQMap = new Map(target.questionsJson.map((q) => [q.key, q]));
  const questions: QuestionDiffItem[] = [];

  for (const tq of target.questionsJson) {
    const bq = baseQMap.get(tq.key);
    if (!bq) {
      questions.push({
        key: tq.key,
        prompt: tq.prompt,
        changeType: "added",
        after: tq,
      });
    } else if (JSON.stringify(bq) !== JSON.stringify(tq)) {
      questions.push({
        key: tq.key,
        prompt: tq.prompt,
        changeType: "modified",
        before: bq,
        after: tq,
      });
    }
  }

  for (const bq of base.questionsJson) {
    if (!targetQMap.has(bq.key)) {
      questions.push({
        key: bq.key,
        prompt: bq.prompt,
        changeType: "removed",
        before: bq,
      });
    }
  }

  // Metadata changes
  const metadataChanges: FieldChange[] = [];
  if (base.effectiveDate !== target.effectiveDate) {
    metadataChanges.push({
      field: "effectiveDate",
      label: "Effective Date",
      before: base.effectiveDate,
      after: target.effectiveDate,
    });
  }
  if (base.lastVerifiedDate !== target.lastVerifiedDate) {
    metadataChanges.push({
      field: "lastVerifiedDate",
      label: "Last Verified Date",
      before: base.lastVerifiedDate,
      after: target.lastVerifiedDate,
    });
  }
  if (base.sourceReference !== target.sourceReference) {
    metadataChanges.push({
      field: "sourceReference",
      label: "Source Reference",
      before: base.sourceReference,
      after: target.sourceReference,
    });
  }
  if (base.disclaimerText !== target.disclaimerText) {
    metadataChanges.push({
      field: "disclaimerText",
      label: "Disclaimer Text",
      before: base.disclaimerText,
      after: target.disclaimerText,
    });
  }

  return {
    serviceId: base.serviceId,
    serviceName,
    baseVersion: {
      id: base.id,
      versionNumber: base.versionNumber,
      status: base.status,
      effectiveDate: base.effectiveDate,
      publishedAt: base.publishedAt,
    },
    targetVersion: {
      id: target.id,
      versionNumber: target.versionNumber,
      status: target.status,
      effectiveDate: target.effectiveDate,
      publishedAt: target.publishedAt,
    },
    summary: {
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      questionChangesCount: questions.length,
    },
    requirements,
    questions,
    metadataChanges,
  };
}
