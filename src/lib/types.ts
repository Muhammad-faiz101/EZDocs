export type VerificationStatus = "illustrative" | "verified";

export type ChecklistItemStatus = "ready" | "missing" | "needs_verification";

export type VersionStatus = "draft" | "published";

export type RequirementType = "mandatory" | "conditional";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface QuestionDefinition {
  id: string;
  key: string;
  step: number;
  prompt: string;
  helpText: string;
  required: boolean;
  type: "single_choice";
  options: QuestionOption[];
}

export interface ConditionRule {
  questionKey: string;
  comparator: "equals" | "not_equals" | "in";
  value: string | string[];
}

export interface ConditionGroup {
  operator: "ALL" | "ANY";
  rules: ConditionRule[];
}

export interface VersionRequirement {
  id: string;
  documentId?: number | null;
  documentCode: string;
  title: string;
  category: string;
  requirementType: RequirementType;
  conditionLogic: ConditionGroup | null;
  conditionSummary: string;
  instructions: string;
  originalOrCopy: string;
  tips: string;
  verificationStatus: VerificationStatus;
  sourceNote: string;
  displayOrder: number;
}

export interface ChecklistSessionItem {
  requirementId: string;
  documentCode: string;
  title: string;
  category: string;
  requirementType: RequirementType;
  conditionSummary: string;
  instructions: string;
  originalOrCopy: string;
  tips: string;
  verificationStatus: VerificationStatus;
  sourceNote: string;
  status: ChecklistItemStatus;
  citizenNote: string;
}

export interface ExcludedRequirementItem {
  requirementId: string;
  documentCode: string;
  title: string;
  category: string;
  conditionSummary: string;
  reason: string;
}

export interface VersionSnapshotMeta {
  effectiveDate: string;
  publishedAt: string | null;
  lastVerifiedDate: string;
  sourceReference: string;
  disclaimerText: string;
}

export interface ServiceRecord {
  id: number;
  slug: string;
  name: string;
  jurisdiction: string;
  officeName: string;
  category: string;
  summary: string;
  description: string;
  estimatedTime: string;
  feeInfo: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latestPublishedVersion?: {
    id: number;
    versionNumber: string;
    effectiveDate: string;
    publishedAt: string | null;
    lastVerifiedDate: string;
    requirementCount: number;
    questionCount: number;
  } | null;
  publishedVersionCount?: number;
  draftVersionCount?: number;
}

export interface DocumentRecord {
  id: number;
  code: string;
  title: string;
  category: string;
  defaultInstructions: string;
  originalOrCopy: string;
  verificationStatus: VerificationStatus;
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistVersionRecord {
  id: number;
  serviceId: number;
  versionNumber: string;
  status: VersionStatus;
  changelogSummary: string;
  effectiveDate: string;
  publishedAt: string | null;
  lastVerifiedDate: string;
  sourceReference: string;
  disclaimerText: string;
  questionsJson: QuestionDefinition[];
  requirementsJson: VersionRequirement[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistSessionRecord {
  id: number;
  sessionCode: string;
  serviceId: number;
  serviceSlug: string;
  serviceName: string;
  jurisdiction: string;
  checklistVersionId: number;
  versionNumber: string;
  applicantLabel: string;
  answersJson: Record<string, string>;
  itemsJson: ChecklistSessionItem[];
  excludedItemsJson: ExcludedRequirementItem[];
  versionSnapshotMeta: VersionSnapshotMeta;
  parentSessionCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface RequirementDiffItem {
  documentCode: string;
  title: string;
  category: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  before?: VersionRequirement;
  after?: VersionRequirement;
  fieldChanges: FieldChange[];
}

export interface QuestionDiffItem {
  key: string;
  prompt: string;
  changeType: "added" | "removed" | "modified";
  before?: QuestionDefinition;
  after?: QuestionDefinition;
}

export interface VersionComparisonResult {
  serviceId: number;
  serviceName: string;
  baseVersion: {
    id: number;
    versionNumber: string;
    status: VersionStatus;
    effectiveDate: string;
    publishedAt: string | null;
  };
  targetVersion: {
    id: number;
    versionNumber: string;
    status: VersionStatus;
    effectiveDate: string;
    publishedAt: string | null;
  };
  summary: {
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    unchangedCount: number;
    questionChangesCount: number;
  };
  requirements: RequirementDiffItem[];
  questions: QuestionDiffItem[];
  metadataChanges: FieldChange[];
}
