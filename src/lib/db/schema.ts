/**
 * Database schema (PostgreSQL, Drizzle ORM).
 *
 * Design notes
 * - Approval ("is this vetted?") and publication ("is this visible?") are separate
 *   columns. A CHECK constraint guarantees nothing is published unless approved,
 *   so adding an item to the system never means it is officially endorsed.
 * - Deleting a category or tag that is still used is blocked (ON DELETE RESTRICT).
 * - `search_text` holds Arabic-normalised text for searching; original text is never altered.
 * - Authentication: `users` carries the role, active state and a scrypt password hash;
 *   `sessions` stores only hashes of session tokens; `auth_attempts` holds keyed hashes
 *   used for sign-in rate limiting.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ───────────── Enums ───────────── */

export const approvalStatus = pgEnum("approval_status", ["draft", "in_review", "approved"]);
export const publicationStatus = pgEnum("publication_status", [
  "unpublished",
  "published",
  "archived",
]);
export const permissionStatus = pgEnum("permission_status", [
  "unknown",
  "pending",
  "granted",
  "restricted",
  "public_domain",
]);
export const sourceKind = pgEnum("source_kind", ["video", "audio", "file", "external_link"]);
export const linkStatus = pgEnum("link_status", ["unchecked", "ok", "broken"]);
export const fileVisibility = pgEnum("file_visibility", ["public", "private"]);
export const participationKind = pgEnum("participation_kind", [
  "conference",
  "seminar",
  "public_lesson",
  "event",
  "other",
]);

/* ───────────── Users, roles, permissions ───────────── */

export const roles = pgTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const permissions = pgTable("permissions", {
  id: id(),
  key: text("key").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true),
    /** scrypt hash ("scrypt$N$r$p$salt$key"); null = cannot sign in yet. */
    passwordHash: text("password_hash"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.roleId),
  ],
);

/* ───────────── Sessions & sign-in attempts ───────────── */

/** Only a SHA-256 hash of the session token is stored, never the token itself. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Sign-in attempts for rate limiting. Stores keyed hashes only (no emails, no raw IPs). */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: id(),
    identifierHash: text("identifier_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("auth_attempts_identifier_idx").on(t.identifierHash, t.createdAt),
    index("auth_attempts_ip_idx").on(t.ipHash, t.createdAt),
  ],
);


/* ───────────── Taxonomy ───────────── */

export const contentTypes = pgTable("content_types", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "restrict",
    }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("categories_parent_idx").on(t.parentId),
    check("categories_not_own_parent", sql`${t.parentId} <> ${t.id}`),
  ],
);

export const tags = pgTable("tags", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Files ───────────── */

export const storedFiles = pgTable(
  "stored_files",
  {
    id: id(),
    provider: text("provider").notNull(), // e.g. "s3", "local"
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    visibility: fileVisibility("visibility").notNull().default("private"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("stored_files_provider_key_idx").on(t.provider, t.storageKey),
    check("stored_files_size_positive", sql`${t.sizeBytes} >= 0`),
  ],
);

/* ───────────── Content ───────────── */

export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    summary: text("summary"),
    description: text("description"),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "restrict" }),
    speakerName: text("speaker_name"), // only as documented; never invented
    approvalStatus: approvalStatus("approval_status").notNull().default("draft"),
    publicationStatus: publicationStatus("publication_status").notNull().default("unpublished"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }), // null = unknown
    durationSeconds: integer("duration_seconds"),
    thumbnailFileId: uuid("thumbnail_file_id").references(() => storedFiles.id, {
      onDelete: "set null",
    }),
    thumbnailUrl: text("thumbnail_url"),
    copyrightNotice: text("copyright_notice"),
    permissionStatus: permissionStatus("permission_status").notNull().default("unknown"),
    reuseRestrictions: text("reuse_restrictions"),
    isFeatured: boolean("is_featured").notNull().default(false),
    /** True for development sample data. Must never be true in production. */
    isSample: boolean("is_sample").notNull().default(false),
    /** Arabic-normalised title + summary + description, maintained by the app. */
    searchText: text("search_text").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "content_published_requires_approval",
      sql`${t.publicationStatus} <> 'published' OR ${t.approvalStatus} = 'approved'`,
    ),
    check(
      "content_published_has_date",
      sql`${t.publicationStatus} <> 'published' OR ${t.publishedAt} IS NOT NULL`,
    ),
    check(
      "content_duration_non_negative",
      sql`${t.durationSeconds} IS NULL OR ${t.durationSeconds} >= 0`,
    ),
    index("content_listing_idx").on(t.publicationStatus, t.publishedAt.desc()),
    index("content_type_idx").on(t.contentTypeId),
    index("content_search_idx").using("gin", sql`to_tsvector('simple', ${t.searchText})`),
  ],
);

export const contentSources = pgTable(
  "content_sources",
  {
    id: id(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    kind: sourceKind("kind").notNull(),
    url: text("url"), // external URL (null when an uploaded file is used)
    storedFileId: uuid("stored_file_id").references(() => storedFiles.id, {
      onDelete: "restrict",
    }),
    sourceName: text("source_name"), // e.g. publishing platform or channel
    originalSourceUrl: text("original_source_url"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isDownloadable: boolean("is_downloadable").notNull().default(false),
    linkStatus: linkStatus("link_status").notNull().default("unchecked"),
    linkCheckedAt: timestamp("link_checked_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("source_has_url_or_file", sql`${t.url} IS NOT NULL OR ${t.storedFileId} IS NOT NULL`),
    index("content_sources_item_idx").on(t.contentItemId),
    // At most one primary source per item.
    uniqueIndex("content_sources_one_primary_idx")
      .on(t.contentItemId)
      .where(sql`${t.isPrimary}`),
  ],
);

export const contentCategories = pgTable(
  "content_categories",
  {
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentItemId, t.categoryId] }),
    index("content_categories_category_idx").on(t.categoryId),
  ],
);

export const contentTags = pgTable(
  "content_tags",
  {
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentItemId, t.tagId] }),
    index("content_tags_tag_idx").on(t.tagId),
  ],
);

export const contentRelations = pgTable(
  "content_relations",
  {
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    relatedItemId: uuid("related_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.contentItemId, t.relatedItemId] }),
    check("content_relation_not_self", sql`${t.contentItemId} <> ${t.relatedItemId}`),
  ],
);

/* ───────────── Participations (conferences, seminars, events) ───────────── */

export const participations = pgTable(
  "participations",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    kind: participationKind("kind").notNull().default("other"),
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true }), // null = unknown
    location: text("location"),
    thumbnailUrl: text("thumbnail_url"),
    sourceUrl: text("source_url"),
    approvalStatus: approvalStatus("approval_status").notNull().default("draft"),
    publicationStatus: publicationStatus("publication_status").notNull().default("unpublished"),
    isSample: boolean("is_sample").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "participation_published_requires_approval",
      sql`${t.publicationStatus} <> 'published' OR ${t.approvalStatus} = 'approved'`,
    ),
  ],
);

export const participationItems = pgTable(
  "participation_items",
  {
    participationId: uuid("participation_id")
      .notNull()
      .references(() => participations.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.participationId, t.contentItemId] })],
);

/* ───────────── Static pages, news, settings ───────────── */

export const staticPages = pgTable("static_pages", {
  id: id(),
  key: text("key").notNull().unique(), // about, privacy, terms, copyright_policy ...
  title: text("title").notNull(),
  body: text("body").notNull().default(""), // Markdown, sanitised when rendered
  publicationStatus: publicationStatus("publication_status").notNull().default("unpublished"),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const newsPosts = pgTable(
  "news_posts",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    publicationStatus: publicationStatus("publication_status").notNull().default("unpublished"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "news_published_has_date",
      sql`${t.publicationStatus} <> 'published' OR ${t.publishedAt} IS NOT NULL`,
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
});

/* ───────────── Contact messages & audit log ───────────── */

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: id(),
    name: text("name"),
    email: text("email"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    privacyAccepted: boolean("privacy_accepted").notNull().default(false),
    isRead: boolean("is_read").notNull().default(false),
    /** Hashed (not raw) IP, used only for rate limiting / abuse review. */
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("contact_messages_created_idx").on(t.createdAt.desc())],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // e.g. content.publish
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    /** Non-sensitive context only. Never passwords, tokens or message bodies. */
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt.desc()),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);