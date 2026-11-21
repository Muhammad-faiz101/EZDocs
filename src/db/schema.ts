import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  QuestionDefinition,
  VersionRequirement,
  ChecklistSessionItem,
  ExcludedRequirementItem,
  VersionSnapshotMeta,
} from "@/lib/types";

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  officeName: text("office_name").notNull(),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  estimatedTime: text("estimated_time").notNull(),
  feeInfo: text("fee_info").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  defaultInstructions: text("default_instructions").notNull(),
  originalOrCopy: text("original_or_copy").notNull(),
  verificationStatus: text("verification_status").notNull().default("illustrative"),
  sourceNote: text("source_note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const checklistVersions = pgTable(
  "checklist_versions",
  {
    id: serial("id").primaryKey(),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    versionNumber: text("version_number").notNull(),
    status: text("status").notNull().default("draft"), // 'draft' | 'published'
    changelogSummary: text("changelog_summary").notNull().default(""),
    effectiveDate: text("effective_date").notNull(),
    publishedAt: timestamp("published_at"),
    lastVerifiedDate: text("last_verified_date").notNull(),
    sourceReference: text("source_reference").notNull(),
    disclaimerText: text("disclaimer_text").notNull(),
    questionsJson: jsonb("questions_json").$type<QuestionDefinition[]>().notNull(),
    requirementsJson: jsonb("requirements_json").$type<VersionRequirement[]>().notNull(),
    createdBy: text("created_by").notNull().default("admin@ezdocs.gov.demo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("checklist_versions_service_version_idx").on(
      table.serviceId,
      table.versionNumber
    ),
  ]
);

export const checklistSessions = pgTable("checklist_sessions", {
  id: serial("id").primaryKey(),
  sessionCode: text("session_code").notNull().unique(),
  serviceId: integer("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  serviceSlug: text("service_slug").notNull(),
  serviceName: text("service_name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  checklistVersionId: integer("checklist_version_id")
    .notNull()
    .references(() => checklistVersions.id),
  versionNumber: text("version_number").notNull(),
  applicantLabel: text("applicant_label").notNull().default(""),
  answersJson: jsonb("answers_json").$type<Record<string, string>>().notNull(),
  itemsJson: jsonb("items_json").$type<ChecklistSessionItem[]>().notNull(),
  excludedItemsJson: jsonb("excluded_items_json")
    .$type<ExcludedRequirementItem[]>()
    .notNull(),
  versionSnapshotMeta: jsonb("version_snapshot_meta")
    .$type<VersionSnapshotMeta>()
    .notNull(),
  parentSessionCode: text("parent_session_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Service Administrator"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
