//shared/schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  numeric
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// CORE USER TABLES
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const userSettings = pgTable(
  "user_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),

    // Profile settings
    profileName: text("profile_name"),
    profileEmail: text("profile_email"),
    profileCompany: text("profile_company"),
    profileTimezone: text("profile_timezone").default("America/New_York"),

    // Notification preferences
    notificationEmailReports: boolean("notification_email_reports").default(true),
    notificationContentGenerated: boolean("notification_content_generated").default(true),
    notificationSeoIssues: boolean("notification_seo_issues").default(true),
    notificationSystemAlerts: boolean("notification_system_alerts").default(false),

    // Automation preferences
    automationDefaultAiModel: text("automation_default_ai_model").default("gpt-4o"),
    automationAutoFixSeoIssues: boolean("automation_auto_fix_seo_issues").default(true),
    automationContentGenerationFrequency: text("automation_content_generation_frequency").default("twice-weekly"),
    automationReportGeneration: text("automation_report_generation").default("weekly"),

    // Security settings
    securityTwoFactorAuth: boolean("security_two_factor_auth").default(false),
    securitySessionTimeout: integer("security_session_timeout").default(24),
    securityAllowApiAccess: boolean("security_allow_api_access").default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_user_settings_user_id").on(table.userId)]
);

export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    provider: text("provider").notNull(), // 'openai', 'anthropic', 'google_pagespeed'
    keyName: text("key_name").notNull(),
    encryptedApiKey: text("encrypted_api_key").notNull(), // Encrypted API key
    maskedKey: text("masked_key").notNull(), // For display (e.g., "sk-...xyz123")

    isActive: boolean("is_active").notNull().default(true),
    validationStatus: text("validation_status").notNull().default("pending"), // 'valid', 'invalid', 'pending'
    lastValidated: timestamp("last_validated"),
    validationError: text("validation_error"),

    // Usage tracking
    usageCount: integer("usage_count").notNull().default(0),
    lastUsed: timestamp("last_used"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_api_keys_user_id").on(table.userId),
    index("idx_user_api_keys_provider").on(table.provider),
  ]
);

// ============================================================================
// WEBSITE TABLES
// ============================================================================

export const websites = pgTable(
  "websites",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    
    // Secure WordPress Application Password authentication
    wpApplicationName: text("wp_application_name").notNull(),
    wpApplicationPassword: text("wp_application_password").notNull(), // Encrypted
    wpUsername: text("wp_username"), // For display only, not authentication

    // AI and automation settings
    aiModel: text("ai_model").notNull().default("gpt-4o"),
    autoPosting: boolean("auto_posting").notNull().default(false), // Default to manual approval
    requireApproval: boolean("require_approval").notNull().default(true),

    // Performance and status
    status: text("status").notNull().default("active"), // active, processing, issues, suspended
    seoScore: integer("seo_score").notNull().default(0),
    contentCount: integer("content_count").notNull().default(0),

    // Security and access control
    allowedIPs: text("allowed_ips").array().default([]),
    apiRateLimit: integer("api_rate_limit").notNull().default(100), // requests per hour

    // Content quality settings
    brandVoice: text("brand_voice").default("professional"),
    contentGuidelines: text("content_guidelines"),
    targetAudience: text("target_audience"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_websites_user_id").on(table.userId),
  ]
);

// ============================================================================
// CONTENT TABLES
// ============================================================================

export const content = pgTable(
  "content",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    excerpt: text("excerpt"),
    metaDescription: text("meta_description"),
    metaTitle: text("meta_title"),

    // Content approval and workflow
    status: text("status").notNull().default("pending_approval"),
    approvedBy: varchar("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    rejectionReason: text("rejection_reason"),

    // AI and SEO data
    aiModel: text("ai_model").notNull(),
    seoKeywords: text("seo_keywords").array().notNull().default([]),
    seoScore: integer("seo_score").default(0),
    readabilityScore: integer("readability_score").default(0),
    plagiarismScore: integer("plagiarism_score").default(0),

    // Content quality and brand compliance
    brandVoiceScore: integer("brand_voice_score").default(0),
    factCheckStatus: text("fact_check_status").default("pending"),
    eatCompliance: boolean("eat_compliance").default(false),

    // Token and cost tracking
    tokensUsed: integer("tokens_used").default(0),
    costUsd: integer("cost_usd").default(0), // Store as cents (multiply by 100)

    // Scheduling and publishing
    publishDate: timestamp("publish_date"),
    wordpressPostId: integer("wordpress_post_id"),
    wordpressUrl: text("wordpress_url"),
    publishError: text("publish_error"),

    // Image data
    images: jsonb("images").default([]),
    cloudinaryData: jsonb("cloudinary_data").default({}),
    featuredImageUrl: text("featured_image_url"),
    featuredImageCloudinaryId: text("featured_image_cloudinary_id"),
    hasImages: boolean("has_images").default(false),
    totalImageCost: integer("total_image_cost").default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_content_user_id").on(table.userId),
    index("idx_content_website_user").on(table.websiteId, table.userId),
  ]
);

export const contentImages = pgTable(
  "content_images",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: varchar("content_id")
      .notNull()
      .references(() => content.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),

    // DALL-E generated image info
    originalUrl: text("original_url").notNull(),
    filename: text("filename").notNull(),
    altText: text("alt_text").notNull(),
    generationPrompt: text("generation_prompt").notNull(),
    costCents: integer("cost_cents").notNull(),
    imageStyle: text("image_style").notNull(),
    size: text("size").notNull().default("1024x1024"),

    // Cloudinary storage fields
    cloudinaryUrl: text("cloudinary_url"),
    cloudinarySecureUrl: text("cloudinary_secure_url"),
    cloudinaryPublicId: text("cloudinary_public_id"),
    cloudinaryFormat: varchar("cloudinary_format", { length: 20 }),
    cloudinaryWidth: integer("cloudinary_width"),
    cloudinaryHeight: integer("cloudinary_height"),
    cloudinaryBytes: integer("cloudinary_bytes"),
    cloudinaryVersion: varchar("cloudinary_version", { length: 20 }),
    cloudinaryThumbnailUrl: text("cloudinary_thumbnail_url"),
    cloudinaryOptimizedUrl: text("cloudinary_optimized_url"),
    cloudinaryUploadedAt: timestamp("cloudinary_uploaded_at"),
    
    // Image ordering and featuring
    imageOrder: integer("image_order").default(0),
    isFeatured: boolean("is_featured").default(false),

    // WordPress upload info
    wordpressMediaId: integer("wordpress_media_id"),
    wordpressUrl: text("wordpress_url"),
    status: text("status").notNull().default("generated"),
    uploadError: text("upload_error"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_content_images_content_id").on(table.contentId),
    index("idx_content_images_user_id").on(table.userId),
    index("idx_content_images_cloudinary_public_id").on(table.cloudinaryPublicId),
    index("idx_content_images_order").on(table.contentId, table.imageOrder),
  ]
);

export const contentApprovals = pgTable(
  "content_approvals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: varchar("content_id")
      .notNull()
      .references(() => content.id),
    reviewerId: varchar("reviewer_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(), // approved, rejected, needs_revision
    feedback: text("feedback"),
    qualityScore: integer("quality_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_content_approvals_user_id").on(table.userId)]
);

export const contentSchedule = pgTable(
  "content_schedule",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    scheduledDate: timestamp("scheduled_date").notNull(),
    topic: text("topic").notNull(),
    keywords: text("keywords").array().notNull().default([]),
    status: text("status").notNull().default("planned"), // planned, generating, ready, published
    contentId: varchar("content_id").references(() => content.id),

    hasImages: boolean("has_images").default(false),
    imageCount: integer("image_count").default(0),
    cloudinaryImageIds: text("cloudinary_image_ids").array().default([]),

    abTestVariant: text("ab_test_variant"), // A, B, or null
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_content_schedule_user_id").on(table.userId)]
);

// ============================================================================
// SEO TABLES
// ============================================================================

export const seoReports = pgTable(
  "seo_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    score: integer("score").notNull(),
    issues: jsonb("issues").notNull().default([]),
    recommendations: jsonb("recommendations").notNull().default([]),
    pageSpeedScore: integer("page_speed_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    hasTrackedIssues: boolean("has_tracked_issues").default(false),
    fixableIssuesCount: integer("fixable_issues_count").default(0),
    criticalIssuesCount: integer("critical_issues_count").default(0),
  },
  (table) => [index("idx_seo_reports_user_id").on(table.userId)]
);

export const seoAudits = pgTable(
  "seo_audits",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    url: text("url").notNull(),
    auditType: text("audit_type").notNull(), // technical, content, performance
    findings: jsonb("findings").notNull().default([]),
    autoFixApplied: boolean("auto_fix_applied").default(false),
    autoFixResults: jsonb("auto_fix_results").default([]),
    coreWebVitals: jsonb("core_web_vitals").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_seo_audits_user_id").on(table.userId)]
);

export const seoIssueStatuses = pgTable(
  "seo_issue_statuses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
    
    // Issue identification
    issueHash: text("issue_hash").notNull().unique(),
    issueType: text("issue_type").notNull(),
    issueTitle: text("issue_title").notNull(),
    issueDescription: text("issue_description"),
    issueSeverity: text("issue_severity").notNull(), // critical, warning, info
    
    // Status tracking
    status: text("status").notNull().default("open"), // open, in_progress, fixed, ignored, cannot_fix
    statusReason: text("status_reason"),
    
    // Fix attempts
    fixAttempts: integer("fix_attempts").notNull().default(0),
    lastFixAttempt: timestamp("last_fix_attempt"),
    lastFixError: text("last_fix_error"),
    
    // Resolution details
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"), // 'ai_fix', 'manual', 'auto_resolved'
    resolutionNotes: text("resolution_notes"),
    
    // Context
    firstDetected: timestamp("first_detected").notNull().defaultNow(),
    lastDetected: timestamp("last_detected").notNull().defaultNow(),
    detectionCount: integer("detection_count").notNull().default(1),
    
    // Associated data
    wordpressPostId: integer("wordpress_post_id"),
    elementPath: text("element_path"),
    currentValue: text("current_value"),
    recommendedValue: text("recommended_value"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_seo_issue_statuses_user_website").on(table.userId, table.websiteId),
    index("idx_seo_issue_statuses_hash").on(table.issueHash),
    index("idx_seo_issue_statuses_status").on(table.status),
    index("idx_seo_issue_statuses_type").on(table.issueType),
  ]
);

export const seoIssueTracking = pgTable(
  "seo_issue_tracking",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Issue identification
    issueType: varchar("issue_type", { length: 100 }).notNull(),
    issueTitle: varchar("issue_title", { length: 500 }).notNull(),
    issueDescription: text("issue_description"),
    severity: text("severity", { enum: ['critical', 'warning', 'info'] }).notNull().default('warning'),
    status: text("status", { enum: ['detected', 'fixing', 'fixed', 'resolved', 'reappeared'] }).notNull().default('detected'),
    autoFixAvailable: boolean("auto_fix_available").notNull().default(false),
    
    // Timestamps
    detectedAt: timestamp("detected_at").notNull().defaultNow(),
    fixedAt: timestamp("fixed_at"),
    resolvedAt: timestamp("resolved_at"),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    
    // Fix details
    fixMethod: text("fix_method", { enum: ['ai_automatic', 'ai_iterative', 'manual'] }),
    fixSessionId: varchar("fix_session_id", { length: 255 }),
    fixBefore: text("fix_before"),
    fixAfter: text("fix_after"),
    aiModel: varchar("ai_model", { length: 100 }),
    tokensUsed: integer("tokens_used"),
    
    // Element details
    elementPath: text("element_path"),
    currentValue: text("current_value"),
    recommendedValue: text("recommended_value"),
    
    // Resolution details
    resolvedBy: text("resolved_by"), // 'ai_fix', 'manual', 'auto_resolved'
    resolutionNotes: text("resolution_notes"),
    
    // Metadata stored as JSONB for flexibility
    metadata: jsonb("metadata").default({}),
    
    // Audit timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_seo_issue_tracking_website_user").on(table.websiteId, table.userId),
    index("idx_seo_issue_tracking_status").on(table.status),
    index("idx_seo_issue_tracking_issue_type").on(table.issueType),
    index("idx_seo_issue_tracking_severity").on(table.severity),
    index("idx_seo_issue_tracking_detected_at").on(table.detectedAt.desc()),
    index("idx_seo_issue_tracking_last_seen_at").on(table.lastSeenAt.desc()),
    index("idx_seo_issue_tracking_auto_fix").on(table.autoFixAvailable),
    index("idx_seo_issue_tracking_website_status_type").on(table.websiteId, table.status, table.issueType),
  ]
);

export const appliedFixes = pgTable(
  "applied_fixes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
    
    // Issue identification
    issueType: text("issue_type").notNull(),
    issueTitle: text("issue_title").notNull(),
    issueDescription: text("issue_description"),
    issueHash: text("issue_hash").notNull(),
    
    // Fix details
    fixType: text("fix_type").notNull(),
    fixDescription: text("fix_description").notNull(),
    fixSuccess: boolean("fix_success").notNull(),
    fixError: text("fix_error"),
    
    // Content affected
    wordpressPostId: integer("wordpress_post_id"),
    elementPath: text("element_path"),
    beforeValue: text("before_value"),
    afterValue: text("after_value"),
    
    // Fix context
    fixBatchId: varchar("fix_batch_id"),
    aiModel: text("ai_model"),
    scoreBefore: integer("score_before"),
    scoreAfter: integer("score_after"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_applied_fixes_user_website").on(table.userId, table.websiteId),
    index("idx_applied_fixes_issue_hash").on(table.issueHash),
    index("idx_applied_fixes_batch").on(table.fixBatchId),
  ]
);

// ============================================================================
// AI & AUTOMATION TABLES
// ============================================================================

export const aiUsageTracking = pgTable(
  "ai_usage_tracking",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    model: text("model").notNull(),
    tokensUsed: integer("tokens_used").notNull(),
    costUsd: integer("cost_usd").notNull(), // Store as cents
    operation: text("operation").notNull(), // content_generation, seo_analysis, etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_ai_usage_user_id").on(table.userId)]
);

export const autoSchedules = pgTable("auto_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  
  // Schedule configuration
  name: text("name").notNull(),
  frequency: text("frequency").notNull(), // 'daily', 'twice_weekly', 'weekly', 'biweekly', 'monthly', 'custom'
  timeOfDay: text("time_of_day").notNull(), // Format: 'HH:MM'
  customDays: text("custom_days").array().default([]),
  
  // Content generation settings
  topics: text("topics").array().default([]),
  keywords: text("keywords"),
  tone: text("tone"),
  wordCount: integer("word_count").default(1000),
  brandVoice: text("brand_voice"),
  targetAudience: text("target_audience"),
  eatCompliance: boolean("eat_compliance").default(false),
  
  // AI and image settings
  aiProvider: text("ai_provider").default("openai"),
  includeImages: boolean("include_images").default(false),
  imageCount: integer("image_count").default(1),
  imageStyle: text("image_style"),
  seoOptimized: boolean("seo_optimized").default(true),
  
  // Publishing settings
  autoPublish: boolean("auto_publish").default(false),
  publishDelay: integer("publish_delay").default(0), // Hours to wait before publishing
  
  // Topic rotation settings
  topicRotation: text("topic_rotation").default("sequential"), // 'sequential' or 'random'
  nextTopicIndex: integer("next_topic_index").default(0),
  
  // Cost and limit controls
  maxDailyCost: numeric("max_daily_cost", { precision: 10, scale: 2 }).default("10.00"),
  maxMonthlyPosts: integer("max_monthly_posts").default(30),
  costToday: numeric("cost_today", { precision: 10, scale: 2 }).default("0.00"),
  postsThisMonth: integer("posts_this_month").default(0),
  
  // Tracking
  lastRun: timestamp("last_run"),
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_auto_schedules_user_id").on(table.userId),
  index("idx_auto_schedules_website_id").on(table.websiteId),
  index("idx_auto_schedules_active").on(table.isActive),
  index("idx_auto_schedules_last_run").on(table.lastRun),
]);

// ============================================================================
// ACTIVITY & LOGGING TABLES
// ============================================================================

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "cascade",
    }), // nullable for system logs
    websiteId: varchar("website_id").references(() => websites.id),
    type: text("type").notNull(), // content_generated, seo_analysis, issue_detected, etc.
    description: text("description").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_activity_logs_user_id").on(table.userId)]
);

export const securityAudits = pgTable(
  "security_audits",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    websiteId: varchar("website_id").references(() => websites.id),
    action: text("action").notNull(), // login, content_publish, seo_change, etc.
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_security_audits_user_id").on(table.userId)]
);

export const clientReports = pgTable(
  "client_reports",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    reportType: text("report_type").notNull(), // weekly, monthly, quarterly
    period: text("period").notNull(),
    data: jsonb("data").notNull(),
    insights: jsonb("insights").notNull().default([]),
    roiData: jsonb("roi_data").notNull().default({}),
    whiteLabelConfig: jsonb("white_label_config").default({}),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_client_reports_user_id").on(table.userId)]
);

export const backups = pgTable(
  "backups",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .notNull()
      .references(() => websites.id),
    backupType: text("backup_type").notNull(), // content, settings, full
    data: jsonb("data").notNull(),
    wordpressBackupId: text("wordpress_backup_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_backups_user_id").on(table.userId)]
);

// ============================================================================
// CLOUDINARY & IMAGE TABLES
// ============================================================================

export const cloudinaryUsage = pgTable(
  "cloudinary_usage",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .references(() => websites.id, { onDelete: "cascade" }),
    
    // Usage metrics
    month: timestamp("month").notNull(),
    imagesUploaded: integer("images_uploaded").default(0),
    totalBytesStored: integer("total_bytes_stored").default(0),
    bandwidthUsed: integer("bandwidth_used").default(0),
    creditsUsed: integer("credits_used").default(0),
    transformationsCount: integer("transformations_count").default(0),
    
    // Cost tracking (in cents)
    estimatedCostCents: integer("estimated_cost_cents").default(0),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_cloudinary_usage_user_website").on(table.userId, table.websiteId),
    index("idx_cloudinary_usage_month").on(table.month),
  ]
);

export const failedImageUploads = pgTable(
  "failed_image_uploads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentId: varchar("content_id")
      .references(() => content.id, { onDelete: "cascade" }),
    websiteId: varchar("website_id")
      .references(() => websites.id, { onDelete: "cascade" }),
    
    // Original request data
    dalleUrl: text("dalle_url"),
    cloudinaryError: text("cloudinary_error"),
    filename: varchar("filename", { length: 255 }),
    altText: text("alt_text"),
    prompt: text("prompt"),
    
    // Error tracking
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 50 }),
    retryCount: integer("retry_count").default(0),
    maxRetries: integer("max_retries").default(3),
    
    // Status
    status: text("status").default("pending_retry"), // pending_retry, retrying, resolved, abandoned
    
    // Timestamps
    failedAt: timestamp("failed_at").notNull().defaultNow(),
    lastRetryAt: timestamp("last_retry_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_failed_uploads_status").on(table.status),
    index("idx_failed_uploads_content").on(table.contentId),
  ]
);

// ============================================================================
// GOOGLE SEARCH CONSOLE TABLES
// ============================================================================

export const gscConfigurations = pgTable(
  "gsc_configurations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(), // Plain text as requested
    redirectUri: text("redirect_uri").notNull(),
    isConfigured: boolean("is_configured").notNull().default(true),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_gsc_config_user_id").on(table.userId)]
);


export const gscAccounts = pgTable(
  "gsc_accounts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),  // Auto-generated UUID
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("account_id").notNull(),  // Google account ID stored here
    
    email: text("email").notNull(),
    name: text("name").notNull(),
    picture: text("picture"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiry: integer("token_expiry").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_gsc_accounts_user_id").on(table.userId),
    index("idx_gsc_accounts_account_id").on(table.accountId),
    index("idx_gsc_accounts_email").on(table.email),
    // Add unique constraint for user_id + account_id combination
    // This allows multiple users to connect the same Google account
     uniqueIndex("ux_gsc_accounts_user_id_account_id").on(table.userId, table.accountId),
  ]
);

// Update references in other tables to use account_id
export const gscProperties = pgTable(
  "gsc_properties",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("account_id")  // References account_id, not id
      .notNull(),
    websiteId: varchar("website_id")
      .references(() => websites.id, { onDelete: "set null" }),
    
    siteUrl: text("site_url").notNull().unique(),
    permissionLevel: text("permission_level").notNull(),
    siteType: text("site_type").notNull(),
    verified: boolean("verified").notNull().default(true),
    lastSynced: timestamp("last_synced"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_gsc_properties_user_id").on(table.userId),
    index("idx_gsc_properties_account_id").on(table.accountId),
  ]
);

export const gscIndexingRequests = pgTable(
  "gsc_indexing_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: varchar("account_id")  // References account_id, not id
      .notNull(),
    propertyId: varchar("property_id")
      .notNull()
      .references(() => gscProperties.id, { onDelete: "cascade" }),
    
    url: text("url").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    message: text("message"),
    notifyTime: timestamp("notify_time"),
    
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_gsc_indexing_user_id").on(table.userId),
    index("idx_gsc_indexing_status").on(table.status),
  ]
);

export const gscQuotaUsage = pgTable(
  "gsc_quota_usage",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: varchar("account_id"),  // References account_id, not id
    
    date: timestamp("date").notNull(),
    count: integer("count").notNull().default(0),
    limit: integer("limit").notNull().default(200),
    
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_gsc_quota_account_date").on(table.accountId, table.date),
  ]
);

// export const gscAccounts = pgTable(
//   "gsc_accounts",
//   {
//     id: varchar("id").primaryKey(), // Google account ID
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
    
//     email: text("email").notNull(),
//     name: text("name").notNull(),
//     picture: text("picture"),
//     accessToken: text("access_token").notNull(),
//     refreshToken: text("refresh_token").notNull(),
//     tokenExpiry: integer("token_expiry").notNull(),
//     isActive: boolean("is_active").notNull().default(true),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_accounts_user_id").on(table.userId),
//     index("idx_gsc_accounts_email").on(table.email),
//   ]
// );

// export const gscProperties = pgTable(
//   "gsc_properties",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     accountId: varchar("account_id")
//       .notNull()
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .references(() => websites.id, { onDelete: "set null" }),
    
//     siteUrl: text("site_url").notNull().unique(),
//     permissionLevel: text("permission_level").notNull(),
//     siteType: text("site_type").notNull(),
//     verified: boolean("verified").notNull().default(true),
//     lastSynced: timestamp("last_synced"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_properties_user_id").on(table.userId),
//     index("idx_gsc_properties_account_id").on(table.accountId),
//   ]
// );

// export const gscIndexingRequests = pgTable(
//   "gsc_indexing_requests",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     accountId: varchar("account_id")
//       .notNull()
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
//     propertyId: varchar("property_id")
//       .notNull()
//       .references(() => gscProperties.id, { onDelete: "cascade" }),
    
//     url: text("url").notNull(),
//     type: text("type").notNull(),
//     status: text("status").notNull().default("pending"),
//     message: text("message"),
//     notifyTime: timestamp("notify_time"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_indexing_user_id").on(table.userId),
//     index("idx_gsc_indexing_status").on(table.status),
//   ]
// );

// export const gscQuotaUsage = pgTable(
//   "gsc_quota_usage",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     accountId: varchar("account_id")
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
    
//     date: timestamp("date").notNull(),
//     count: integer("count").notNull().default(0),
//     limit: integer("limit").notNull().default(200),
    
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_quota_account_date").on(table.accountId, table.date),
//   ]
// );

// ============================================================================
// INSERT SCHEMAS - CORE USER
// ============================================================================

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  profileName: true,
  profileEmail: true,
  profileCompany: true,
  profileTimezone: true,
  notificationEmailReports: true,
  notificationContentGenerated: true,
  notificationSeoIssues: true,
  notificationSystemAlerts: true,
  automationDefaultAiModel: true,
  automationAutoFixSeoIssues: true,
  automationContentGenerationFrequency: true,
  automationReportGeneration: true,
  securityTwoFactorAuth: true,
  securitySessionTimeout: true,
  securityAllowApiAccess: true,
});

export const insertUserApiKeySchema = createInsertSchema(userApiKeys).pick({
  provider: true,
  keyName: true,
  encryptedApiKey: true,
  maskedKey: true,
  isActive: true,
  validationStatus: true,
  lastValidated: true,
  validationError: true,
  usageCount: true,
  lastUsed: true,
});

// ============================================================================
// INSERT SCHEMAS - WEBSITES
// ============================================================================

export const insertWebsiteSchema = createInsertSchema(websites).pick({
  name: true,
  url: true,
  wpApplicationName: true,
  wpApplicationPassword: true,
  wpUsername: true,
  aiModel: true,
  autoPosting: true,
  requireApproval: true,
  brandVoice: true,
  contentGuidelines: true,
  targetAudience: true,
  // userId will be added automatically in the backend
});

// ============================================================================
// INSERT SCHEMAS - CONTENT
// ============================================================================

export const insertContentSchema = createInsertSchema(content).pick({
  websiteId: true,
  title: true,
  body: true,
  excerpt: true,
  metaDescription: true,
  metaTitle: true,
  aiModel: true,
  seoKeywords: true,
  publishDate: true,
  seoScore: true,
  readabilityScore: true,
  brandVoiceScore: true,
  tokensUsed: true,
  costUsd: true,
  eatCompliance: true,
  // userId will be added automatically in the backend
});

export const insertContentImageSchema = createInsertSchema(contentImages).pick({
  contentId: true,
  websiteId: true,
  originalUrl: true,
  filename: true,
  altText: true,
  generationPrompt: true,
  costCents: true,
  imageStyle: true,
  size: true,
  
  // Cloudinary fields
  cloudinaryUrl: true,
  cloudinarySecureUrl: true,
  cloudinaryPublicId: true,
  cloudinaryFormat: true,
  cloudinaryWidth: true,
  cloudinaryHeight: true,
  cloudinaryBytes: true,
  cloudinaryVersion: true,
  cloudinaryThumbnailUrl: true,
  cloudinaryOptimizedUrl: true,
  cloudinaryUploadedAt: true,
  imageOrder: true,
  isFeatured: true,
  
  // WordPress fields
  wordpressMediaId: true,
  wordpressUrl: true,
  status: true,
  uploadError: true,
});

export const insertContentApprovalSchema = createInsertSchema(contentApprovals).pick({
  contentId: true,
  reviewerId: true,
  status: true,
  feedback: true,
  qualityScore: true,
  // userId will be added automatically in the backend
});

export const insertContentScheduleSchema = createInsertSchema(contentSchedule).pick({
  websiteId: true,
  scheduledDate: true,
  topic: true,
  keywords: true,
  abTestVariant: true,
  // userId will be added automatically in the backend
});

// ============================================================================
// INSERT SCHEMAS - SEO
// ============================================================================

export const insertSeoReportSchema = createInsertSchema(seoReports).pick({
  websiteId: true,
  score: true,
  issues: true,
  recommendations: true,
  pageSpeedScore: true,
  // userId will be added automatically in the backend
});

export const insertSeoAuditSchema = createInsertSchema(seoAudits).pick({
  websiteId: true,
  url: true,
  auditType: true,
  findings: true,
  autoFixApplied: true,
  autoFixResults: true,
  coreWebVitals: true,
  // userId will be added automatically in the backend
});

export const insertSeoIssueStatusSchema = createInsertSchema(seoIssueStatuses).pick({
  websiteId: true,
  issueHash: true,
  issueType: true,
  issueTitle: true,
  issueDescription: true,
  issueSeverity: true,
  status: true,
  statusReason: true,
  fixAttempts: true,
  lastFixAttempt: true,
  lastFixError: true,
  resolvedAt: true,
  resolvedBy: true,
  resolutionNotes: true,
  firstDetected: true,
  lastDetected: true,
  detectionCount: true,
  wordpressPostId: true,
  elementPath: true,
  currentValue: true,
  recommendedValue: true,
});

export const insertSeoIssueTrackingSchema = createInsertSchema(seoIssueTracking).pick({
  websiteId: true,
  issueType: true,
  issueTitle: true,
  issueDescription: true,
  severity: true,
  status: true,
  autoFixAvailable: true,
  detectedAt: true,
  fixedAt: true,
  resolvedAt: true,
  lastSeenAt: true,
  fixMethod: true,
  fixSessionId: true,
  fixBefore: true,
  fixAfter: true,
  aiModel: true,
  tokensUsed: true,
  elementPath: true,
  currentValue: true,
  recommendedValue: true,
  resolvedBy: true,
  resolutionNotes: true,
  metadata: true,
});

// ============================================================================
// INSERT SCHEMAS - AI & AUTOMATION
// ============================================================================

export const insertAiUsageTrackingSchema = createInsertSchema(aiUsageTracking).pick({
  websiteId: true,
  model: true,
  tokensUsed: true,
  costUsd: true,
  operation: true,
  // userId will be added automatically in the backend
});

export const insertAutoScheduleSchema = createInsertSchema(autoSchedules).pick({
  websiteId: true,
  name: true,
  frequency: true,
  timeOfDay: true,
  customDays: true,
  topics: true,
  keywords: true,
  tone: true,
  wordCount: true,
  brandVoice: true,
  targetAudience: true,
  eatCompliance: true,
  aiProvider: true,
  includeImages: true,
  imageCount: true,
  imageStyle: true,
  seoOptimized: true,
  autoPublish: true,
  publishDelay: true,
  topicRotation: true,
  maxDailyCost: true,
  maxMonthlyPosts: true,
  // userId will be added automatically in the backend
});

// ============================================================================
// INSERT SCHEMAS - ACTIVITY & LOGGING
// ============================================================================

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  websiteId: true,
  type: true,
  description: true,
  metadata: true,
  // userId will be added automatically in the backend
});

export const insertSecurityAuditSchema = createInsertSchema(securityAudits).pick({
  websiteId: true,
  action: true,
  ipAddress: true,
  userAgent: true,
  success: true,
  metadata: true,
  // userId will be added automatically in the backend
});

export const insertClientReportSchema = createInsertSchema(clientReports).pick({
  websiteId: true,
  reportType: true,
  period: true,
  data: true,
  insights: true,
  roiData: true,
  whiteLabelConfig: true,
  // userId will be added automatically in the backend
});

export const insertBackupSchema = createInsertSchema(backups).pick({
  websiteId: true,
  backupType: true,
  data: true,
  wordpressBackupId: true,
  // userId will be added automatically in the backend
});

// ============================================================================
// INSERT SCHEMAS - CLOUDINARY & IMAGES
// ============================================================================

export const insertCloudinaryUsageSchema = createInsertSchema(cloudinaryUsage).pick({
  websiteId: true,
  month: true,
  imagesUploaded: true,
  totalBytesStored: true,
  bandwidthUsed: true,
  creditsUsed: true,
  transformationsCount: true,
  estimatedCostCents: true,
  // userId will be added automatically in the backend
});

export const insertFailedImageUploadSchema = createInsertSchema(failedImageUploads).pick({
  contentId: true,
  websiteId: true,
  dalleUrl: true,
  cloudinaryError: true,
  filename: true,
  altText: true,
  prompt: true,
  errorMessage: true,
  errorCode: true,
  retryCount: true,
  maxRetries: true,
  status: true,
  // userId will be added automatically in the backend
});

// ============================================================================
// INSERT SCHEMAS - GOOGLE SEARCH CONSOLE
// ============================================================================

export const insertGscConfigurationSchema = createInsertSchema(gscConfigurations).pick({
  clientId: true,
  clientSecret: true,
  redirectUri: true,
});

export const insertGscAccountSchema = createInsertSchema(gscAccounts).pick({
  id: true,
  email: true,
  name: true,
  picture: true,
  accessToken: true,
  refreshToken: true,
  tokenExpiry: true,
});

// ============================================================================
// TYPE EXPORTS - CORE USER
// ============================================================================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeys.$inferSelect;

// ============================================================================
// TYPE EXPORTS - WEBSITES
// ============================================================================

export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type Website = typeof websites.$inferSelect;

// ============================================================================
// TYPE EXPORTS - CONTENT
// ============================================================================

export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof content.$inferSelect;

export type InsertContentImage = z.infer<typeof insertContentImageSchema>;
export type ContentImage = typeof contentImages.$inferSelect;

export type InsertContentApproval = z.infer<typeof insertContentApprovalSchema>;
export type ContentApproval = typeof contentApprovals.$inferSelect;

export type InsertContentSchedule = z.infer<typeof insertContentScheduleSchema>;
export type ContentSchedule = typeof contentSchedule.$inferSelect;

// ============================================================================
// TYPE EXPORTS - SEO
// ============================================================================

export type InsertSeoReport = z.infer<typeof insertSeoReportSchema>;
export type SeoReport = typeof seoReports.$inferSelect;

export type InsertSeoAudit = z.infer<typeof insertSeoAuditSchema>;
export type SeoAudit = typeof seoAudits.$inferSelect;

export type InsertSeoIssueStatus = z.infer<typeof insertSeoIssueStatusSchema>;
export type SeoIssueStatus = typeof seoIssueStatuses.$inferSelect;

export type InsertSeoIssueTracking = z.infer<typeof insertSeoIssueTrackingSchema>;
export type SeoIssueTracking = typeof seoIssueTracking.$inferSelect;

// ============================================================================
// TYPE EXPORTS - AI & AUTOMATION
// ============================================================================

export type InsertAiUsageTracking = z.infer<typeof insertAiUsageTrackingSchema>;
export type AiUsageTracking = typeof aiUsageTracking.$inferSelect;

export type InsertAutoSchedule = z.infer<typeof insertAutoScheduleSchema>;
export type AutoSchedule = typeof autoSchedules.$inferSelect;

// ============================================================================
// TYPE EXPORTS - ACTIVITY & LOGGING
// ============================================================================

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertSecurityAudit = z.infer<typeof insertSecurityAuditSchema>;
export type SecurityAudit = typeof securityAudits.$inferSelect;

export type InsertClientReport = z.infer<typeof insertClientReportSchema>;
export type ClientReport = typeof clientReports.$inferSelect;

export type InsertBackup = z.infer<typeof insertBackupSchema>;
export type Backup = typeof backups.$inferSelect;

// ============================================================================
// TYPE EXPORTS - CLOUDINARY & IMAGES
// ============================================================================

export type InsertCloudinaryUsage = z.infer<typeof insertCloudinaryUsageSchema>;
export type CloudinaryUsage = typeof cloudinaryUsage.$inferSelect;

export type InsertFailedImageUpload = z.infer<typeof insertFailedImageUploadSchema>;
export type FailedImageUpload = typeof failedImageUploads.$inferSelect;

// ============================================================================
// TYPE EXPORTS - GOOGLE SEARCH CONSOLE
// ============================================================================

export type GscConfiguration = typeof gscConfigurations.$inferSelect;
export type InsertGscConfiguration = z.infer<typeof insertGscConfigurationSchema>;
export type GscAccount = typeof gscAccounts.$inferSelect;
export type InsertGscAccount = z.infer<typeof insertGscAccountSchema>;



// //shared/schema.ts
// import { sql } from "drizzle-orm";
// import {
//   pgTable,
//   text,
//   varchar,
//   timestamp,
//   integer,
//   boolean,
//   jsonb,
//   index,
//   numeric
// } from "drizzle-orm/pg-core";
// import { createInsertSchema } from "drizzle-zod";
// import { z } from "zod";

// export const users = pgTable("users", {
//   id: varchar("id")
//     .primaryKey()
//     .default(sql`gen_random_uuid()`),
//   username: text("username").notNull().unique(),
//   password: text("password").notNull(),
// });

// // Session storage table.
// // (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// export const sessions = pgTable(
//   "sessions",
//   {
//     sid: varchar("sid").primaryKey(),
//     sess: jsonb("sess").notNull(),
//     expire: timestamp("expire").notNull(),
//   },
//   (table) => [index("IDX_session_expire").on(table.expire)]
// );

// export const websites = pgTable(
//   "websites",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     name: text("name").notNull(),
//     url: text("url").notNull(),
//     // Secure WordPress Application Password authentication
//     wpApplicationName: text("wp_application_name").notNull(),
//     wpApplicationPassword: text("wp_application_password").notNull(), // Encrypted
//     wpUsername: text("wp_username"), // For display only, not authentication

//     // AI and automation settings
//     aiModel: text("ai_model").notNull().default("gpt-4o"),
//     autoPosting: boolean("auto_posting").notNull().default(false), // Default to manual approval
//     requireApproval: boolean("require_approval").notNull().default(true),

//     // Performance and status
//     status: text("status").notNull().default("active"), // active, processing, issues, suspended
//     seoScore: integer("seo_score").notNull().default(0),
//     contentCount: integer("content_count").notNull().default(0),

//     // Security and access control
//     allowedIPs: text("allowed_ips").array().default([]),
//     apiRateLimit: integer("api_rate_limit").notNull().default(100), // requests per hour

//     // Content quality settings
//     brandVoice: text("brand_voice").default("professional"),
//     contentGuidelines: text("content_guidelines"),
//     targetAudience: text("target_audience"),

//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     // Add index for efficient user-website lookups
//     index("idx_websites_user_id").on(table.userId),
//   ]
// );

// export const content = pgTable(
//   "content",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     title: text("title").notNull(),
//     body: text("body").notNull(),
//     excerpt: text("excerpt"),
//     metaDescription: text("meta_description"),
//     metaTitle: text("meta_title"),

//     // Content approval and workflow
//     status: text("status").notNull().default("pending_approval"),
//     approvedBy: varchar("approved_by").references(() => users.id),
//     approvedAt: timestamp("approved_at"),
//     rejectionReason: text("rejection_reason"),

//     // AI and SEO data
//     aiModel: text("ai_model").notNull(),
//     seoKeywords: text("seo_keywords").array().notNull().default([]),
//     seoScore: integer("seo_score").default(0),
//     readabilityScore: integer("readability_score").default(0),
//     plagiarismScore: integer("plagiarism_score").default(0),

//     // Content quality and brand compliance
//     brandVoiceScore: integer("brand_voice_score").default(0),
//     factCheckStatus: text("fact_check_status").default("pending"),
//     eatCompliance: boolean("eat_compliance").default(false),

//     // NEW FIELDS - Add these to save AI results properly
//     tokensUsed: integer("tokens_used").default(0),
//     costUsd: integer("cost_usd").default(0), // Store as cents (multiply by 100)

//     // Scheduling and publishing
//     publishDate: timestamp("publish_date"),
//     wordpressPostId: integer("wordpress_post_id"),

//     wordpressUrl: text("wordpress_url"),
//     publishError: text("publish_error"),

//      images: jsonb("images").default([]),
//     cloudinaryData: jsonb("cloudinary_data").default({}),
//     featuredImageUrl: text("featured_image_url"),
//     featuredImageCloudinaryId: text("featured_image_cloudinary_id"),
//     hasImages: boolean("has_images").default(false),
//     totalImageCost: integer("total_image_cost").default(0),

//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_content_user_id").on(table.userId),
//     index("idx_content_website_user").on(table.websiteId, table.userId),
//   ]
// );

// export const seoReports = pgTable(
//   "seo_reports",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     score: integer("score").notNull(),
//     issues: jsonb("issues").notNull().default([]),
//     recommendations: jsonb("recommendations").notNull().default([]),
//     pageSpeedScore: integer("page_speed_score"),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//      hasTrackedIssues: boolean("has_tracked_issues").default(false),
//     fixableIssuesCount: integer("fixable_issues_count").default(0),
//     criticalIssuesCount: integer("critical_issues_count").default(0),
//   },
//   (table) => [index("idx_seo_reports_user_id").on(table.userId)]
// );

// export const activityLogs = pgTable(
//   "activity_logs",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id").references(() => users.id, {
//       onDelete: "cascade",
//     }), // ADD THIS LINE (nullable for system logs)
//     websiteId: varchar("website_id").references(() => websites.id),
//     type: text("type").notNull(), // content_generated, seo_analysis, issue_detected, etc.
//     description: text("description").notNull(),
//     metadata: jsonb("metadata").notNull().default({}),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_activity_logs_user_id").on(table.userId)]
// );

// export const clientReports = pgTable(
//   "client_reports",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     reportType: text("report_type").notNull(), // weekly, monthly, quarterly
//     period: text("period").notNull(),
//     data: jsonb("data").notNull(),
//     insights: jsonb("insights").notNull().default([]),
//     roiData: jsonb("roi_data").notNull().default({}),
//     whiteLabelConfig: jsonb("white_label_config").default({}),
//     generatedAt: timestamp("generated_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_client_reports_user_id").on(table.userId)]
// );

// // New tables for enhanced functionality
// export const contentApprovals = pgTable(
//   "content_approvals",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     contentId: varchar("content_id")
//       .notNull()
//       .references(() => content.id),
//     reviewerId: varchar("reviewer_id")
//       .notNull()
//       .references(() => users.id),
//     status: text("status").notNull(), // approved, rejected, needs_revision
//     feedback: text("feedback"),
//     qualityScore: integer("quality_score"),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_content_approvals_user_id").on(table.userId)]
// );

// export const securityAudits = pgTable(
//   "security_audits",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id").references(() => users.id, {
//       onDelete: "cascade",
//     }), // ADD THIS LINE
//     websiteId: varchar("website_id").references(() => websites.id),
//     action: text("action").notNull(), // login, content_publish, seo_change, etc.
//     ipAddress: text("ip_address"),
//     userAgent: text("user_agent"),
//     success: boolean("success").notNull(),
//     metadata: jsonb("metadata").notNull().default({}),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_security_audits_user_id").on(table.userId)]
// );

// export const aiUsageTracking = pgTable(
//   "ai_usage_tracking",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     model: text("model").notNull(),
//     tokensUsed: integer("tokens_used").notNull(),
//     costUsd: integer("cost_usd").notNull(), // Store as cents
//     operation: text("operation").notNull(), // content_generation, seo_analysis, etc.
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_ai_usage_user_id").on(table.userId)]
// );

// export const seoAudits = pgTable(
//   "seo_audits",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     url: text("url").notNull(),
//     auditType: text("audit_type").notNull(), // technical, content, performance
//     findings: jsonb("findings").notNull().default([]),
//     autoFixApplied: boolean("auto_fix_applied").default(false),
//     autoFixResults: jsonb("auto_fix_results").default([]),
//     coreWebVitals: jsonb("core_web_vitals").default({}),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_seo_audits_user_id").on(table.userId)]
// );

// export const contentSchedule = pgTable(
//   "content_schedule",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     scheduledDate: timestamp("scheduled_date").notNull(),
//     topic: text("topic").notNull(),
//     keywords: text("keywords").array().notNull().default([]),
//     status: text("status").notNull().default("planned"), // planned, generating, ready, published
//     contentId: varchar("content_id").references(() => content.id),


//      hasImages: boolean("has_images").default(false),
//     imageCount: integer("image_count").default(0),
//     cloudinaryImageIds: text("cloudinary_image_ids").array().default([]),


//     abTestVariant: text("ab_test_variant"), // A, B, or null
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_content_schedule_user_id").on(table.userId)]
// );

// export const backups = pgTable(
//   "backups",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }), // ADD THIS LINE
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id),
//     backupType: text("backup_type").notNull(), // content, settings, full
//     data: jsonb("data").notNull(),
//     wordpressBackupId: text("wordpress_backup_id"),
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_backups_user_id").on(table.userId)]
// );

// // Insert schemas - UPDATED to include userId
// export const insertUserSchema = createInsertSchema(users).pick({
//   username: true,
//   password: true,
// });

// export const insertWebsiteSchema = createInsertSchema(websites).pick({
//   name: true,
//   url: true,
//   wpApplicationName: true,
//   wpApplicationPassword: true,
//   wpUsername: true,
//   aiModel: true,
//   autoPosting: true,
//   requireApproval: true,
//   brandVoice: true,
//   contentGuidelines: true,
//   targetAudience: true,
//   // userId will be added automatically in the backend
// });



// export const insertContentSchema = createInsertSchema(content).pick({
//   websiteId: true,
//   title: true,
//   body: true,
//   excerpt: true,
//   metaDescription: true,
//   metaTitle: true,
//   aiModel: true,
//   seoKeywords: true,
//   publishDate: true,
//   seoScore: true,
//   readabilityScore: true,
//   brandVoiceScore: true,
//   tokensUsed: true,
//   costUsd: true,
//   eatCompliance: true,
//   // userId will be added automatically in the backend
// });

// export const insertSeoReportSchema = createInsertSchema(seoReports).pick({
//   websiteId: true,
//   score: true,
//   issues: true,
//   recommendations: true,
//   pageSpeedScore: true,
//   // userId will be added automatically in the backend
// });

// export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
//   websiteId: true,
//   type: true,
//   description: true,
//   metadata: true,
//   // userId will be added automatically in the backend
// });

// export const insertClientReportSchema = createInsertSchema(clientReports).pick({
//   websiteId: true,
//   reportType: true,
//   period: true,
//   data: true,
//   insights: true,
//   roiData: true,
//   whiteLabelConfig: true,
//   // userId will be added automatically in the backend
// });

// // New insert schemas for enhanced tables - UPDATED
// export const insertContentApprovalSchema = createInsertSchema(
//   contentApprovals
// ).pick({
//   contentId: true,
//   reviewerId: true,
//   status: true,
//   feedback: true,
//   qualityScore: true,
//   // userId will be added automatically in the backend
// });

// export const insertSecurityAuditSchema = createInsertSchema(
//   securityAudits
// ).pick({
//   websiteId: true,
//   action: true,
//   ipAddress: true,
//   userAgent: true,
//   success: true,
//   metadata: true,
//   // userId will be added automatically in the backend
// });

// export const insertAiUsageTrackingSchema = createInsertSchema(
//   aiUsageTracking
// ).pick({
//   websiteId: true,
//   model: true,
//   tokensUsed: true,
//   costUsd: true,
//   operation: true,
//   // userId will be added automatically in the backend
// });

// export const insertSeoAuditSchema = createInsertSchema(seoAudits).pick({
//   websiteId: true,
//   url: true,
//   auditType: true,
//   findings: true,
//   autoFixApplied: true,
//   autoFixResults: true,
//   coreWebVitals: true,
//   // userId will be added automatically in the backend
// });

// export const insertContentScheduleSchema = createInsertSchema(
//   contentSchedule
// ).pick({
//   websiteId: true,
//   scheduledDate: true,
//   topic: true,
//   keywords: true,
//   abTestVariant: true,
//   // userId will be added automatically in the backend
// });

// export const insertBackupSchema = createInsertSchema(backups).pick({
//   websiteId: true,
//   backupType: true,
//   data: true,
//   wordpressBackupId: true,
//   // userId will be added automatically in the backend
// });

// export const contentImages = pgTable(
//   "content_images",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     contentId: varchar("content_id")
//       .notNull()
//       .references(() => content.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id, { onDelete: "cascade" }),

//     // DALL-E generated image info
//     originalUrl: text("original_url").notNull(),
//     filename: text("filename").notNull(),
//     altText: text("alt_text").notNull(),
//     generationPrompt: text("generation_prompt").notNull(),
//     costCents: integer("cost_cents").notNull(),
//     imageStyle: text("image_style").notNull(),
//     size: text("size").notNull().default("1024x1024"),

//     // Cloudinary storage fields (NEW)
//     cloudinaryUrl: text("cloudinary_url"),
//     cloudinarySecureUrl: text("cloudinary_secure_url"),
//     cloudinaryPublicId: text("cloudinary_public_id"),
//     cloudinaryFormat: varchar("cloudinary_format", { length: 20 }),
//     cloudinaryWidth: integer("cloudinary_width"),
//     cloudinaryHeight: integer("cloudinary_height"),
//     cloudinaryBytes: integer("cloudinary_bytes"),
//     cloudinaryVersion: varchar("cloudinary_version", { length: 20 }),
//     cloudinaryThumbnailUrl: text("cloudinary_thumbnail_url"),
//     cloudinaryOptimizedUrl: text("cloudinary_optimized_url"),
//     cloudinaryUploadedAt: timestamp("cloudinary_uploaded_at"),
    
//     // Image ordering and featuring (NEW)
//     imageOrder: integer("image_order").default(0),
//     isFeatured: boolean("is_featured").default(false),

//     // WordPress upload info
//     wordpressMediaId: integer("wordpress_media_id"),
//     wordpressUrl: text("wordpress_url"),
//     status: text("status").notNull().default("generated"),
//     uploadError: text("upload_error"),

//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_content_images_content_id").on(table.contentId),
//     index("idx_content_images_user_id").on(table.userId),
//     index("idx_content_images_cloudinary_public_id").on(table.cloudinaryPublicId),
//     index("idx_content_images_order").on(table.contentId, table.imageOrder),
//   ]
// );

// // 2. ADD new cloudinaryUsage table
// export const cloudinaryUsage = pgTable(
//   "cloudinary_usage",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .references(() => websites.id, { onDelete: "cascade" }),
    
//     // Usage metrics
//     month: timestamp("month").notNull(),
//     imagesUploaded: integer("images_uploaded").default(0),
//     totalBytesStored: integer("total_bytes_stored").default(0),
//     bandwidthUsed: integer("bandwidth_used").default(0),
//     creditsUsed: integer("credits_used").default(0),
//     transformationsCount: integer("transformations_count").default(0),
    
//     // Cost tracking (in cents)
//     estimatedCostCents: integer("estimated_cost_cents").default(0),
    
//     // Timestamps
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_cloudinary_usage_user_website").on(table.userId, table.websiteId),
//     index("idx_cloudinary_usage_month").on(table.month),
//   ]
// );

// // 3. ADD new failedImageUploads table
// export const failedImageUploads = pgTable(
//   "failed_image_uploads",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     contentId: varchar("content_id")
//       .references(() => content.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .references(() => websites.id, { onDelete: "cascade" }),
    
//     // Original request data
//     dalleUrl: text("dalle_url"),
//     cloudinaryError: text("cloudinary_error"),
//     filename: varchar("filename", { length: 255 }),
//     altText: text("alt_text"),
//     prompt: text("prompt"),
    
//     // Error tracking
//     errorMessage: text("error_message"),
//     errorCode: varchar("error_code", { length: 50 }),
//     retryCount: integer("retry_count").default(0),
//     maxRetries: integer("max_retries").default(3),
    
//     // Status
//     status: text("status").default("pending_retry"), // pending_retry, retrying, resolved, abandoned
    
//     // Timestamps
//     failedAt: timestamp("failed_at").notNull().defaultNow(),
//     lastRetryAt: timestamp("last_retry_at"),
//     resolvedAt: timestamp("resolved_at"),
//   },
//   (table) => [
//     index("idx_failed_uploads_status").on(table.status),
//     index("idx_failed_uploads_content").on(table.contentId),
//   ]
// );


// export const insertCloudinaryUsageSchema = createInsertSchema(cloudinaryUsage).pick({
//   websiteId: true,
//   month: true,
//   imagesUploaded: true,
//   totalBytesStored: true,
//   bandwidthUsed: true,
//   creditsUsed: true,
//   transformationsCount: true,
//   estimatedCostCents: true,
//   // userId will be added automatically in the backend
// });

// export const insertFailedImageUploadSchema = createInsertSchema(failedImageUploads).pick({
//   contentId: true,
//   websiteId: true,
//   dalleUrl: true,
//   cloudinaryError: true,
//   filename: true,
//   altText: true,
//   prompt: true,
//   errorMessage: true,
//   errorCode: true,
//   retryCount: true,
//   maxRetries: true,
//   status: true,
//   // userId will be added automatically in the backend
// });

// // Add insert schema
// export const insertContentImageSchema = createInsertSchema(contentImages).pick({
//   contentId: true,
//   websiteId: true,
//   originalUrl: true,
//   filename: true,
//   altText: true,
//   generationPrompt: true,
//   costCents: true,
//   imageStyle: true,
//   size: true,
  
//   // Cloudinary fields (NEW)
//   cloudinaryUrl: true,
//   cloudinarySecureUrl: true,
//   cloudinaryPublicId: true,
//   cloudinaryFormat: true,
//   cloudinaryWidth: true,
//   cloudinaryHeight: true,
//   cloudinaryBytes: true,
//   cloudinaryVersion: true,
//   cloudinaryThumbnailUrl: true,
//   cloudinaryOptimizedUrl: true,
//   cloudinaryUploadedAt: true,
//   imageOrder: true,
//   isFeatured: true,
  
//   // WordPress fields
//   wordpressMediaId: true,
//   wordpressUrl: true,
//   status: true,
//   uploadError: true,
// });

// export const userSettings = pgTable(
//   "user_settings",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .unique()
//       .references(() => users.id, { onDelete: "cascade" }),

//     // Profile settings
//     profileName: text("profile_name"),
//     profileEmail: text("profile_email"),
//     profileCompany: text("profile_company"),
//     profileTimezone: text("profile_timezone").default("America/New_York"),

//     // Notification preferences
//     notificationEmailReports: boolean("notification_email_reports").default(
//       true
//     ),
//     notificationContentGenerated: boolean(
//       "notification_content_generated"
//     ).default(true),
//     notificationSeoIssues: boolean("notification_seo_issues").default(true),
//     notificationSystemAlerts: boolean("notification_system_alerts").default(
//       false
//     ),

//     // Automation preferences
//     automationDefaultAiModel: text("automation_default_ai_model").default(
//       "gpt-4o"
//     ),
//     automationAutoFixSeoIssues: boolean(
//       "automation_auto_fix_seo_issues"
//     ).default(true),
//     automationContentGenerationFrequency: text(
//       "automation_content_generation_frequency"
//     ).default("twice-weekly"),
//     automationReportGeneration: text("automation_report_generation").default(
//       "weekly"
//     ),

//     // Security settings
//     securityTwoFactorAuth: boolean("security_two_factor_auth").default(false),
//     securitySessionTimeout: integer("security_session_timeout").default(24),
//     securityAllowApiAccess: boolean("security_allow_api_access").default(true),

//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_user_settings_user_id").on(table.userId)]
// );

// // Add insert schema for user settings
// export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
//   profileName: true,
//   profileEmail: true,
//   profileCompany: true,
//   profileTimezone: true,
//   notificationEmailReports: true,
//   notificationContentGenerated: true,
//   notificationSeoIssues: true,
//   notificationSystemAlerts: true,
//   automationDefaultAiModel: true,
//   automationAutoFixSeoIssues: true,
//   automationContentGenerationFrequency: true,
//   automationReportGeneration: true,
//   securityTwoFactorAuth: true,
//   securitySessionTimeout: true,
//   securityAllowApiAccess: true,
// });

// export const userApiKeys = pgTable(
//   "user_api_keys",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),

//     provider: text("provider").notNull(), // 'openai', 'anthropic', 'google_pagespeed'
//     keyName: text("key_name").notNull(),
//     encryptedApiKey: text("encrypted_api_key").notNull(), // Encrypted API key
//     maskedKey: text("masked_key").notNull(), // For display (e.g., "sk-...xyz123")

//     isActive: boolean("is_active").notNull().default(true),
//     validationStatus: text("validation_status").notNull().default("pending"), // 'valid', 'invalid', 'pending'
//     lastValidated: timestamp("last_validated"),
//     validationError: text("validation_error"),

//     // Usage tracking
//     usageCount: integer("usage_count").notNull().default(0),
//     lastUsed: timestamp("last_used"),

//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_user_api_keys_user_id").on(table.userId),
//     index("idx_user_api_keys_provider").on(table.provider),
//   ]
// );

// // Add insert schema for user API keys
// export const insertUserApiKeySchema = createInsertSchema(userApiKeys).pick({
//   provider: true,
//   keyName: true,
//   encryptedApiKey: true,
//   maskedKey: true,
//   isActive: true,
//   validationStatus: true,
//   lastValidated: true,
//   validationError: true,
//   usageCount: true,
//   lastUsed: true,
// });

// export const appliedFixes = pgTable(
//   "applied_fixes",
//   {
//     id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//     userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
    
//     // Issue identification
//     issueType: text("issue_type").notNull(), // missing_alt_text, poor_title_tag, etc.
//     issueTitle: text("issue_title").notNull(),
//     issueDescription: text("issue_description"),
//     issueHash: text("issue_hash").notNull(), // Unique identifier for this specific issue
    
//     // Fix details
//     fixType: text("fix_type").notNull(),
//     fixDescription: text("fix_description").notNull(),
//     fixSuccess: boolean("fix_success").notNull(),
//     fixError: text("fix_error"),
    
//     // Content affected
//     wordpressPostId: integer("wordpress_post_id"),
//     elementPath: text("element_path"), // CSS selector or similar
//     beforeValue: text("before_value"),
//     afterValue: text("after_value"),
    
//     // Fix context
//     fixBatchId: varchar("fix_batch_id"), // Groups fixes from the same AI fix run
//     aiModel: text("ai_model"),
//     scoreBefore: integer("score_before"),
//     scoreAfter: integer("score_after"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_applied_fixes_user_website").on(table.userId, table.websiteId),
//     index("idx_applied_fixes_issue_hash").on(table.issueHash),
//     index("idx_applied_fixes_batch").on(table.fixBatchId),
//   ]
// );

// export const seoIssueStatuses = pgTable(
//   "seo_issue_statuses",
//   {
//     id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//     userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
    
//     // Issue identification
//     issueHash: text("issue_hash").notNull().unique(), // Consistent hash for the same issue
//     issueType: text("issue_type").notNull(), // missing_alt_text, poor_title_tag, etc.
//     issueTitle: text("issue_title").notNull(),
//     issueDescription: text("issue_description"),
//     issueSeverity: text("issue_severity").notNull(), // critical, warning, info
    
//     // Status tracking
//     status: text("status").notNull().default("open"), // open, in_progress, fixed, ignored, cannot_fix
//     statusReason: text("status_reason"), // Why it's ignored/cannot be fixed
    
//     // Fix attempts
//     fixAttempts: integer("fix_attempts").notNull().default(0),
//     lastFixAttempt: timestamp("last_fix_attempt"),
//     lastFixError: text("last_fix_error"),
    
//     // Resolution details
//     resolvedAt: timestamp("resolved_at"),
//     resolvedBy: text("resolved_by"), // 'ai_fix', 'manual', 'auto_resolved'
//     resolutionNotes: text("resolution_notes"),
    
//     // Context
//     firstDetected: timestamp("first_detected").notNull().defaultNow(),
//     lastDetected: timestamp("last_detected").notNull().defaultNow(),
//     detectionCount: integer("detection_count").notNull().default(1),
    
//     // Associated data
//     wordpressPostId: integer("wordpress_post_id"),
//     elementPath: text("element_path"),
//     currentValue: text("current_value"),
//     recommendedValue: text("recommended_value"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_seo_issue_statuses_user_website").on(table.userId, table.websiteId),
//     index("idx_seo_issue_statuses_hash").on(table.issueHash),
//     index("idx_seo_issue_statuses_status").on(table.status),
//     index("idx_seo_issue_statuses_type").on(table.issueType),
//   ]
// );

// // Add insert schema
// export const insertSeoIssueStatusSchema = createInsertSchema(seoIssueStatuses).pick({
//   websiteId: true,
//   issueHash: true,
//   issueType: true,
//   issueTitle: true,
//   issueDescription: true,
//   issueSeverity: true,
//   status: true,
//   statusReason: true,
//   fixAttempts: true,
//   lastFixAttempt: true,
//   lastFixError: true,
//   resolvedAt: true,
//   resolvedBy: true,
//   resolutionNotes: true,
//   firstDetected: true,
//   lastDetected: true,
//   detectionCount: true,
//   wordpressPostId: true,
//   elementPath: true,
//   currentValue: true,
//   recommendedValue: true,
// });


// export type InsertSeoIssueStatus = z.infer<typeof insertSeoIssueStatusSchema>;
// export type SeoIssueStatus = typeof seoIssueStatuses.$inferSelect;

// // Auto-Schedules table for automated content generation
// export const autoSchedules = pgTable("auto_schedules", {
//   id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
//   userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
//   websiteId: varchar("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  
//   // Schedule configuration
//   name: text("name").notNull(),
//   frequency: text("frequency").notNull(), // 'daily', 'twice_weekly', 'weekly', 'biweekly', 'monthly', 'custom'
//   timeOfDay: text("time_of_day").notNull(), // Format: 'HH:MM'
//   customDays: text("custom_days").array().default([]), // For custom frequency
  
//   // Content generation settings
//   topics: text("topics").array().default([]),
//   keywords: text("keywords"),
//   tone: text("tone"),
//   wordCount: integer("word_count").default(1000),
//   brandVoice: text("brand_voice"),
//   targetAudience: text("target_audience"),
//   eatCompliance: boolean("eat_compliance").default(false),
  
//   // AI and image settings
//   aiProvider: text("ai_provider").default("openai"),
//   includeImages: boolean("include_images").default(false),
//   imageCount: integer("image_count").default(1),
//   imageStyle: text("image_style"),
//   seoOptimized: boolean("seo_optimized").default(true),
  
//   // Publishing settings
//   autoPublish: boolean("auto_publish").default(false),
//   publishDelay: integer("publish_delay").default(0), // Hours to wait before publishing
  
//   // Topic rotation settings
//   topicRotation: text("topic_rotation").default("sequential"), // 'sequential' or 'random'
//   nextTopicIndex: integer("next_topic_index").default(0),
  
//   // Cost and limit controls - FIXED: Using numeric instead of real
//   maxDailyCost: numeric("max_daily_cost", { precision: 10, scale: 2 }).default("10.00"),
//   maxMonthlyPosts: integer("max_monthly_posts").default(30),
//   costToday: numeric("cost_today", { precision: 10, scale: 2 }).default("0.00"),
//   postsThisMonth: integer("posts_this_month").default(0),
  
//   // Tracking
//   lastRun: timestamp("last_run"),
//   isActive: boolean("is_active").default(true),
  
//   // Timestamps
//   createdAt: timestamp("created_at").notNull().defaultNow(),
//   updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   deletedAt: timestamp("deleted_at"),
// }, (table) => [
//   index("idx_auto_schedules_user_id").on(table.userId),
//   index("idx_auto_schedules_website_id").on(table.websiteId),
//   index("idx_auto_schedules_active").on(table.isActive),
//   index("idx_auto_schedules_last_run").on(table.lastRun),
// ]);

// // Insert schema for auto schedules
// export const insertAutoScheduleSchema = createInsertSchema(autoSchedules).pick({
//   websiteId: true,
//   name: true,
//   frequency: true,
//   timeOfDay: true,
//   customDays: true,
//   topics: true,
//   keywords: true,
//   tone: true,
//   wordCount: true,
//   brandVoice: true,
//   targetAudience: true,
//   eatCompliance: true,
//   aiProvider: true,
//   includeImages: true,
//   imageCount: true,
//   imageStyle: true,
//   seoOptimized: true,
//   autoPublish: true,
//   publishDelay: true,
//   topicRotation: true,
//   maxDailyCost: true,
//   maxMonthlyPosts: true,
//   // userId will be added automatically in the backend
// });















// export const seoIssueTracking = pgTable(
//   "seo_issue_tracking",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     websiteId: varchar("website_id")
//       .notNull()
//       .references(() => websites.id, { onDelete: "cascade" }),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
    
//     // Issue identification
//     issueType: varchar("issue_type", { length: 100 }).notNull(),
//     issueTitle: varchar("issue_title", { length: 500 }).notNull(),
//     issueDescription: text("issue_description"),
//     severity: text("severity", { enum: ['critical', 'warning', 'info'] }).notNull().default('warning'),
//     status: text("status", { enum: ['detected', 'fixing', 'fixed', 'resolved', 'reappeared'] }).notNull().default('detected'),
//     autoFixAvailable: boolean("auto_fix_available").notNull().default(false),
    
//     // Timestamps
//     detectedAt: timestamp("detected_at").notNull().defaultNow(),
//     fixedAt: timestamp("fixed_at"),
//     resolvedAt: timestamp("resolved_at"),
//     lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    
//     // Fix details
//     fixMethod: text("fix_method", { enum: ['ai_automatic', 'ai_iterative', 'manual'] }),
//     fixSessionId: varchar("fix_session_id", { length: 255 }),
//     fixBefore: text("fix_before"),
//     fixAfter: text("fix_after"),
//     aiModel: varchar("ai_model", { length: 100 }),
//     tokensUsed: integer("tokens_used"),
    
//     // Element details
//     elementPath: text("element_path"),
//     currentValue: text("current_value"),
//     recommendedValue: text("recommended_value"),
    
//     // Resolution details
//     resolvedBy: text("resolved_by"), // 'ai_fix', 'manual', 'auto_resolved'
//     resolutionNotes: text("resolution_notes"),
    
//     // Metadata stored as JSONB for flexibility
//     metadata: jsonb("metadata").default({}),
    
//     // Audit timestamps
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_seo_issue_tracking_website_user").on(table.websiteId, table.userId),
//     index("idx_seo_issue_tracking_status").on(table.status),
//     index("idx_seo_issue_tracking_issue_type").on(table.issueType),
//     index("idx_seo_issue_tracking_severity").on(table.severity),
//     index("idx_seo_issue_tracking_detected_at").on(table.detectedAt.desc()),
//     index("idx_seo_issue_tracking_last_seen_at").on(table.lastSeenAt.desc()),
//     index("idx_seo_issue_tracking_auto_fix").on(table.autoFixAvailable),
//     index("idx_seo_issue_tracking_website_status_type").on(table.websiteId, table.status, table.issueType),
//   ]
// );




// // Add insert schema
// export const insertSeoIssueTrackingSchema = createInsertSchema(seoIssueTracking).pick({
//   websiteId: true,
//   issueType: true,
//   issueTitle: true,
//   issueDescription: true,
//   severity: true,
//   status: true,
//   autoFixAvailable: true,
//   detectedAt: true,
//   fixedAt: true,
//   resolvedAt: true,
//   lastSeenAt: true,
//   fixMethod: true,
//   fixSessionId: true,
//   fixBefore: true,
//   fixAfter: true,
//   aiModel: true,
//   tokensUsed: true,
//   elementPath: true,
//   currentValue: true,
//   recommendedValue: true,
//   resolvedBy: true,
//   resolutionNotes: true,
//   metadata: true,
// });




// //=================GOOGLE SEARCH CONSOLE++++++++++++++++++++++++//
// export const gscConfigurations = pgTable(
//   "gsc_configurations",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .unique()
//       .references(() => users.id, { onDelete: "cascade" }),
    
//     clientId: text("client_id").notNull(),
//     clientSecret: text("client_secret").notNull(), // Plain text as requested
//     redirectUri: text("redirect_uri").notNull(),
//     isConfigured: boolean("is_configured").notNull().default(true),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [index("idx_gsc_config_user_id").on(table.userId)]
// );

// export const gscAccounts = pgTable(
//   "gsc_accounts",
//   {
//     id: varchar("id").primaryKey(), // Google account ID
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
    
//     email: text("email").notNull(),
//     name: text("name").notNull(),
//     picture: text("picture"),
//     accessToken: text("access_token").notNull(),
//     refreshToken: text("refresh_token").notNull(),
//     tokenExpiry: integer("token_expiry").notNull(),
//     isActive: boolean("is_active").notNull().default(true),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_accounts_user_id").on(table.userId),
//     index("idx_gsc_accounts_email").on(table.email),
//   ]
// );

// export const gscProperties = pgTable(
//   "gsc_properties",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     accountId: varchar("account_id")
//       .notNull()
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
//     websiteId: varchar("website_id")
//       .references(() => websites.id, { onDelete: "set null" }),
    
//     siteUrl: text("site_url").notNull().unique(),
//     permissionLevel: text("permission_level").notNull(),
//     siteType: text("site_type").notNull(),
//     verified: boolean("verified").notNull().default(true),
//     lastSynced: timestamp("last_synced"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_properties_user_id").on(table.userId),
//     index("idx_gsc_properties_account_id").on(table.accountId),
//   ]
// );

// export const gscIndexingRequests = pgTable(
//   "gsc_indexing_requests",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     userId: varchar("user_id")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     accountId: varchar("account_id")
//       .notNull()
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
//     propertyId: varchar("property_id")
//       .notNull()
//       .references(() => gscProperties.id, { onDelete: "cascade" }),
    
//     url: text("url").notNull(),
//     type: text("type").notNull(),
//     status: text("status").notNull().default("pending"),
//     message: text("message"),
//     notifyTime: timestamp("notify_time"),
    
//     createdAt: timestamp("created_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_indexing_user_id").on(table.userId),
//     index("idx_gsc_indexing_status").on(table.status),
//   ]
// );

// export const gscQuotaUsage = pgTable(
//   "gsc_quota_usage",
//   {
//     id: varchar("id")
//       .primaryKey()
//       .default(sql`gen_random_uuid()`),
//     accountId: varchar("account_id")
//       .references(() => gscAccounts.id, { onDelete: "cascade" }),
    
//     date: timestamp("date").notNull(),
//     count: integer("count").notNull().default(0),
//     limit: integer("limit").notNull().default(200),
    
//     updatedAt: timestamp("updated_at").notNull().defaultNow(),
//   },
//   (table) => [
//     index("idx_gsc_quota_account_date").on(table.accountId, table.date),
//   ]
// );

// // Add insert schemas and types
// export const insertGscConfigurationSchema = createInsertSchema(gscConfigurations).pick({
//   clientId: true,
//   clientSecret: true,
//   redirectUri: true,
// });

// export const insertGscAccountSchema = createInsertSchema(gscAccounts).pick({
//   id: true,
//   email: true,
//   name: true,
//   picture: true,
//   accessToken: true,
//   refreshToken: true,
//   tokenExpiry: true,
// });



// // Add type definitions
// export type InsertSeoIssueTracking = z.infer<typeof insertSeoIssueTrackingSchema>;
// export type SeoIssueTracking = typeof seoIssueTracking.$inferSelect;



// // Types for auto schedules
// export type InsertAutoSchedule = z.infer<typeof insertAutoScheduleSchema>;
// export type AutoSchedule = typeof autoSchedules.$inferSelect;
// // Types
// export type InsertUser = z.infer<typeof insertUserSchema>;
// export type User = typeof users.$inferSelect;

// export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
// export type Website = typeof websites.$inferSelect;

// export type InsertContent = z.infer<typeof insertContentSchema>;
// export type Content = typeof content.$inferSelect;

// export type InsertSeoReport = z.infer<typeof insertSeoReportSchema>;
// export type SeoReport = typeof seoReports.$inferSelect;

// export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
// export type ActivityLog = typeof activityLogs.$inferSelect;

// export type InsertClientReport = z.infer<typeof insertClientReportSchema>;
// export type ClientReport = typeof clientReports.$inferSelect;

// // Enhanced types
// export type InsertContentApproval = z.infer<typeof insertContentApprovalSchema>;
// export type ContentApproval = typeof contentApprovals.$inferSelect;

// export type InsertSecurityAudit = z.infer<typeof insertSecurityAuditSchema>;
// export type SecurityAudit = typeof securityAudits.$inferSelect;

// export type InsertAiUsageTracking = z.infer<typeof insertAiUsageTrackingSchema>;
// export type AiUsageTracking = typeof aiUsageTracking.$inferSelect;

// export type InsertSeoAudit = z.infer<typeof insertSeoAuditSchema>;
// export type SeoAudit = typeof seoAudits.$inferSelect;

// export type InsertContentSchedule = z.infer<typeof insertContentScheduleSchema>;
// export type ContentSchedule = typeof contentSchedule.$inferSelect;

// export type InsertBackup = z.infer<typeof insertBackupSchema>;
// export type Backup = typeof backups.$inferSelect;

// // User session type for Replit Auth compatibility
// export type UpsertUser = typeof users.$inferInsert;

// export type InsertContentImage = z.infer<typeof insertContentImageSchema>;
// export type InsertCloudinaryUsage = z.infer<typeof insertCloudinaryUsageSchema>;
// export type CloudinaryUsage = typeof cloudinaryUsage.$inferSelect;

// export type InsertFailedImageUpload = z.infer<typeof insertFailedImageUploadSchema>;
// export type FailedImageUpload = typeof failedImageUploads.$inferSelect;
// export type ContentImage = typeof contentImages.$inferSelect;

// export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
// export type UserSettings = typeof userSettings.$inferSelect;

// export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
// export type UserApiKey = typeof userApiKeys.$inferSelect;
// export type GscConfiguration = typeof gscConfigurations.$inferSelect;
// export type InsertGscConfiguration = z.infer<typeof insertGscConfigurationSchema>;
// export type GscAccount = typeof gscAccounts.$inferSelect;
// export type InsertGscAccount = z.infer<typeof insertGscAccountSchema>;