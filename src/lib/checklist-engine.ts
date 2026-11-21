import type {
  ChecklistSessionItem,
  ConditionGroup,
  ConditionRule,
  ExcludedRequirementItem,
  QuestionDefinition,
  VersionRequirement,
} from "./types";

export interface AnswerValidationError {
  questionKey: string;
  prompt: string;
  step: number;
  message: string;
}

export function validateQuestionnaireAnswers(
  questions: QuestionDefinition[],
  answers: Record<string, string>
): AnswerValidationError[] {
  const errors: AnswerValidationError[] = [];

  for (const q of questions) {
    const val = answers[q.key];
    if (q.required && (!val || val.trim() === "")) {
      errors.push({
        questionKey: q.key,
        prompt: q.prompt,
        step: q.step,
        message: "Please select an option to continue.",
      });
      continue;
    }

    if (val && q.options.length > 0) {
      const validValues = new Set(q.options.map((o) => o.value));
      if (!validValues.has(val)) {
        errors.push({
          questionKey: q.key,
          prompt: q.prompt,
          step: q.step,
          message: "Selected answer is not a valid option for this question.",
        });
      }
    }
  }

  return errors;
}

export function evaluateRule(
  rule: ConditionRule,
  answers: Record<string, string>
): boolean {
  const answerVal = answers[rule.questionKey];
  if (answerVal === undefined || answerVal === "") {
    return false;
  }

  switch (rule.comparator) {
    case "equals":
      return answerVal === String(rule.value);
    case "not_equals":
      return answerVal !== String(rule.value);
    case "in": {
      const list = Array.isArray(rule.value) ? rule.value : [String(rule.value)];
      return list.includes(answerVal);
    }
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup | null | undefined,
  answers: Record<string, string>
): boolean {
  if (!group || !group.rules || group.rules.length === 0) {
    return true;
  }

  if (group.operator === "ALL") {
    return group.rules.every((r) => evaluateRule(r, answers));
  }
  return group.rules.some((r) => evaluateRule(r, answers));
}

export function describeCondition(
  group: ConditionGroup | null | undefined,
  questions: QuestionDefinition[]
): string {
  if (!group || !group.rules || group.rules.length === 0) {
    return "Applies to all applicants";
  }

  const questionMap = new Map(questions.map((q) => [q.key, q]));
  const parts = group.rules.map((rule) => {
    const q = questionMap.get(rule.questionKey);
    const qLabel = q ? q.prompt.replace(/\?$/, "") : rule.questionKey;
    const valStr = Array.isArray(rule.value)
      ? rule.value
          .map((v) => q?.options.find((o) => o.value === v)?.label ?? v)
          .join(" or ")
      : q?.options.find((o) => o.value === rule.value)?.label ?? String(rule.value);

    if (rule.comparator === "not_equals") {
      return `${qLabel} is not "${valStr}"`;
    }
    return `${qLabel}: "${valStr}"`;
  });

  return parts.join(group.operator === "ALL" ? " AND " : " OR ");
}

export interface GeneratedChecklistOutput {
  items: ChecklistSessionItem[];
  excludedItems: ExcludedRequirementItem[];
}

export function generatePersonalizedChecklist(
  requirements: VersionRequirement[],
  questions: QuestionDefinition[],
  answers: Record<string, string>,
  carryOverFromItems?: ChecklistSessionItem[]
): GeneratedChecklistOutput {
  const sorted = [...requirements].sort((a, b) => a.displayOrder - b.displayOrder);
  const previousMap = new Map<string, ChecklistSessionItem>();
  if (carryOverFromItems) {
    for (const prev of carryOverFromItems) {
      previousMap.set(prev.documentCode, prev);
    }
  }

  const items: ChecklistSessionItem[] = [];
  const excludedItems: ExcludedRequirementItem[] = [];

  for (const req of sorted) {
    const isMandatory = req.requirementType === "mandatory";
    const applies = isMandatory
      ? true
      : evaluateConditionGroup(req.conditionLogic, answers);

    if (applies) {
      const prev = previousMap.get(req.documentCode);
      // If instructions changed during upgrade and item was previously marked ready, flag as needs_verification
      let status: ChecklistSessionItem["status"] = "missing";
      let citizenNote = "";
      if (prev) {
        citizenNote = prev.citizenNote;
        if (
          prev.status === "ready" &&
          (prev.instructions !== req.instructions ||
            prev.originalOrCopy !== req.originalOrCopy)
        ) {
          status = "needs_verification";
          citizenNote = citizenNote
            ? `${citizenNote} [Requirement instructions updated in new version]`
            : "Requirement instructions changed in the updated version — please re-verify.";
        } else {
          status = prev.status;
        }
      }

      items.push({
        requirementId: req.id,
        documentCode: req.documentCode,
        title: req.title,
        category: req.category,
        requirementType: req.requirementType,
        conditionSummary:
          req.conditionSummary ||
          (isMandatory
            ? "Required for all applicants"
            : describeCondition(req.conditionLogic, questions)),
        instructions: req.instructions,
        originalOrCopy: req.originalOrCopy,
        tips: req.tips,
        verificationStatus: req.verificationStatus,
        sourceNote: req.sourceNote,
        status,
        citizenNote,
      });
    } else {
      excludedItems.push({
        requirementId: req.id,
        documentCode: req.documentCode,
        title: req.title,
        category: req.category,
        conditionSummary:
          req.conditionSummary || describeCondition(req.conditionLogic, questions),
        reason: `Not required based on your questionnaire responses (${
          req.conditionSummary || describeCondition(req.conditionLogic, questions)
        }).`,
      });
    }
  }

  return { items, excludedItems };
}

export interface ProgressSummary {
  total: number;
  ready: number;
  missing: number;
  needsVerification: number;
  readinessPercent: number;
  mandatoryTotal: number;
  mandatoryReady: number;
  conditionalTotal: number;
  conditionalReady: number;
  isFullyReady: boolean;
}

export function calculateChecklistProgress(
  items: ChecklistSessionItem[]
): ProgressSummary {
  const total = items.length;
  const ready = items.filter((i) => i.status === "ready").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const needsVerification = items.filter(
    (i) => i.status === "needs_verification"
  ).length;
  const mandatoryItems = items.filter((i) => i.requirementType === "mandatory");
  const conditionalItems = items.filter(
    (i) => i.requirementType === "conditional"
  );
  const readinessPercent = total === 0 ? 100 : Math.round((ready / total) * 100);

  return {
    total,
    ready,
    missing,
    needsVerification,
    readinessPercent,
    mandatoryTotal: mandatoryItems.length,
    mandatoryReady: mandatoryItems.filter((i) => i.status === "ready").length,
    conditionalTotal: conditionalItems.length,
    conditionalReady: conditionalItems.filter((i) => i.status === "ready")
      .length,
    isFullyReady: total > 0 && ready === total,
  };
}

export function generateSessionCode(serviceSlug: string): string {
  const prefix = serviceSlug
    .split("-")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3)
    .padEnd(3, "X");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `EZD-${prefix}-${randomPart}${suffix}`;
}
