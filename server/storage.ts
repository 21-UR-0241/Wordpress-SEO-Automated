import { 
  users,
  websites,
  content,
  seoReports,
  activityLogs,
  clientReports,
  contentApprovals,
  securityAudits,
  aiUsageTracking,
  seoAudits,
  contentSchedule,
  backups,
  userSettings,
  seoIssueTracking,
  contentImages,
  insertContentImageSchema,
  autoSchedules,
  userApiKeys,
  gscConfigurations,
  gscAccounts,
  gscProperties,
  gscIndexingRequests,
  gscQuotaUsage,
  type User, 
  type UpsertUser,
  type InsertUser, 
  type Website, 
  type InsertWebsite,
  type Content,
  type InsertContent,
  type SeoReport,
  type InsertSeoReport,
  type ActivityLog,
  type InsertActivityLog,
  type ClientReport,
  type InsertClientReport,
  type ContentApproval,
  type InsertContentApproval,
  type SecurityAudit,
  type InsertSecurityAudit,
  type AiUsageTracking,
  type InsertAiUsageTracking,
  type SeoAudit,
  type InsertSeoAudit,
  type ContentSchedule,
  type InsertContentSchedule,
  type Backup,
  type InsertBackup,
  type UserSettings,
  type InsertUserSettings,
  type ContentImage,
  type InsertContentImage,
  type AutoSchedule,
  type InsertAutoSchedule,
  type UserApiKey,
  type InsertUserApiKey,
  type GscConfiguration,
  type InsertGscConfiguration,
  type GscAccount,
  type InsertGscAccount,
} from "@shared/schema";

import { apiKeyEncryptionService } from "./services/api-key-encryption";
import { wordPressAuthService } from "./services/wordpress-auth";
import { gscStorage } from "./services/gsc-storage";
import { db } from "./db";
import { lte, gte, count, eq, desc, and, or, isNull, inArray, sql, not } from "drizzle-orm";
import { randomUUID, createHash } from 'crypto';

// =============================================================================
// CUSTOM INTERFACES
// =============================================================================

export interface SeoIssueTracking {
  id: string;
  websiteId: string;
  userId: string;
  issueType: string;
  issueTitle: string;
  issueDescription?: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'detected' | 'fixing' | 'fixed' | 'resolved' | 'reappeared';
  autoFixAvailable: boolean;
  detectedAt: Date;
  fixedAt?: Date;
  resolvedAt?: Date;
  lastSeenAt: Date;
  fixMethod?: 'ai_automatic' | 'manual';
  fixSessionId?: string;
  fixBefore?: string;
  fixAfter?: string;
  aiModel?: string;
  tokensUsed?: number;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// STORAGE INTERFACE
// =============================================================================

export interface IStorage {
  // User Management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;

  // User Settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  deleteUserSettings(userId: string): Promise<boolean>;
  getOrCreateUserSettings(userId: string): Promise<UserSettings>;

  // Website Management
  getUserWebsites(userId: string): Promise<Website[]>;
  getUserWebsite(id: string, userId: string): Promise<Website | undefined>;
  createWebsite(website: InsertWebsite & { userId: string }): Promise<Website>;
  updateWebsite(id: string, website: Partial<Website>): Promise<Website | undefined>;
  deleteWebsite(id: string): Promise<boolean>;
  validateWebsiteOwnership(websiteId: string, userId: string): Promise<boolean>;

  // Content Management
  getUserContent(userId: string, websiteId?: string): Promise<Content[]>;
  getContentByWebsite(websiteId: string): Promise<Content[]>;
  getContent(id: string): Promise<Content | undefined>;
  createContent(content: InsertContent & { userId: string }): Promise<Content>;
  updateContent(id: string, content: Partial<Content>): Promise<Content | undefined>;
  getPendingApprovalContent(): Promise<Content[]>;
  getUserPendingApprovalContent(userId: string): Promise<Content[]>;

  // SEO Reports
  getUserSeoReports(userId: string, websiteId?: string): Promise<SeoReport[]>;
  getSeoReportsByWebsite(websiteId: string): Promise<SeoReport[]>;
  getLatestSeoReport(websiteId: string): Promise<SeoReport | undefined>;
  createSeoReport(report: InsertSeoReport & { userId: string }): Promise<SeoReport>;

  // Activity Logs
  getUserActivityLogs(userId: string, websiteId?: string): Promise<ActivityLog[]>;
  getActivityLogs(websiteId?: string): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog & { userId: string }): Promise<ActivityLog>;

  // Client Reports
  getClientReports(websiteId: string): Promise<ClientReport[]>;
  createClientReport(report: InsertClientReport & { userId: string }): Promise<ClientReport>;

  // Enhanced Features
  createContentApproval(approval: InsertContentApproval & { userId: string }): Promise<ContentApproval>;
  createSecurityAudit(audit: InsertSecurityAudit & { userId?: string }): Promise<SecurityAudit>;
  trackAiUsage(usage: InsertAiUsageTracking & { userId: string }): Promise<AiUsageTracking>;
  createSeoAudit(audit: InsertSeoAudit & { userId: string }): Promise<SeoAudit>;
  createBackup(backup: InsertBackup & { userId: string }): Promise<Backup>;

  // Content Scheduling
  getContentSchedule(websiteId: string): Promise<ContentSchedule[]>;
  createContentSchedule(schedule: InsertContentSchedule & { userId: string }): Promise<ContentSchedule>;

  // Dashboard Stats
  getUserDashboardStats(userId: string): Promise<{
    websiteCount: number;
    contentCount: number;
    avgSeoScore: number;
    recentActivity: number;
    scheduledPosts: number;
  }>;

  // API Key Management
  getUserApiKeys(userId: string): Promise<UserApiKey[]>;
  getUserApiKey(userId: string, keyId: string): Promise<UserApiKey | undefined>;
  createUserApiKey(userId: string, data: {
    provider: string;
    keyName: string;
    apiKey: string;
  }): Promise<UserApiKey>;
  updateUserApiKey(userId: string, keyId: string, updates: Partial<{
    keyName: string;
    isActive: boolean;
    validationStatus: string;
    lastValidated: Date;
    validationError: string;
    usageCount: number;
    lastUsed: Date;
  }>): Promise<UserApiKey | undefined>;
  deleteUserApiKey(userId: string, keyId: string): Promise<boolean>;
  getDecryptedApiKey(userId: string, keyId: string): Promise<string | null>;
  validateUserApiKey(userId: string, keyId: string): Promise<{ valid: boolean; error?: string }>;

  // SEO Issue Tracking
  createOrUpdateSeoIssue(issue: any): Promise<SeoIssueTracking>;
  getTrackedSeoIssues(websiteId: string, userId: string, options?: any): Promise<SeoIssueTracking[]>;
  updateSeoIssueStatus(issueId: string, status: string, updates?: any): Promise<SeoIssueTracking | null>;
  bulkUpdateSeoIssueStatuses(issueIds: string[], status: string, fixSessionId?: string): Promise<number>;
  getSeoIssueTrackingSummary(websiteId: string, userId: string): Promise<any>;
  markIssuesAsResolved(websiteId: string, userId: string, currentIssueTypes: string[]): Promise<number>;

  // Google Search Console
  saveGscConfiguration(userId: string, config: InsertGscConfiguration): Promise<GscConfiguration>;
  getGscConfiguration(userId: string): Promise<GscConfiguration | undefined>;
  updateGscConfiguration(userId: string, updates: Partial<InsertGscConfiguration>): Promise<GscConfiguration | undefined>;
  deleteGscConfiguration(userId: string): Promise<boolean>;
  saveGscAccount(userId: string, account: InsertGscAccount): Promise<GscAccount>;
  getGscAccounts(userId: string): Promise<GscAccount[]>;
  getGscAccount(userId: string, accountId: string): Promise<GscAccount | undefined>;
  updateGscAccount(userId: string, accountId: string, updates: Partial<GscAccount>): Promise<GscAccount | undefined>;
  removeGscAccount(userId: string, accountId: string): Promise<boolean>;
  getGscQuotaUsage(accountId: string, date?: Date): Promise<{ used: number; limit: number }>;
  incrementGscQuotaUsage(accountId: string): Promise<void>;
}

// =============================================================================
// DATABASE STORAGE CLASS IMPLEMENTATION
// =============================================================================

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeSampleData();
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  private async initializeSampleData() {
    try {
      const existingWebsites = await db.select().from(websites).limit(1);
      if (existingWebsites.length > 0) return;
      console.log('No existing websites found, sample data initialization skipped');
    } catch (error) {
      console.error('Failed to initialize sample data:', error);
    }
  }

  // ===========================================================================
  // USER MANAGEMENT
  // ===========================================================================

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: userData,
      })
      .returning();
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // ===========================================================================
  // USER SETTINGS
  // ===========================================================================

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(userId: string, settingsData: Partial<InsertUserSettings>): Promise<UserSettings> {
    const [settings] = await db
      .insert(userSettings)
      .values({
        userId,
        ...settingsData,
      })
      .returning();
    return settings;
  }

  async updateUserSettings(userId: string, settingsData: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const [settings] = await db
      .update(userSettings)
      .set({ 
        ...settingsData, 
        updatedAt: new Date() 
      })
      .where(eq(userSettings.userId, userId))
      .returning();
    return settings;
  }

  async deleteUserSettings(userId: string): Promise<boolean> {
    const result = await db
      .delete(userSettings)
      .where(eq(userSettings.userId, userId));
    return (result.rowCount ?? 0) > 0;
  }

  async getOrCreateUserSettings(userId: string): Promise<UserSettings> {
    let settings = await this.getUserSettings(userId);
    
    if (!settings) {
      settings = await this.createUserSettings(userId, {
        profileTimezone: "America/New_York",
        notificationEmailReports: true,
        notificationContentGenerated: true,
        notificationSeoIssues: true,
        notificationSystemAlerts: false,
        automationDefaultAiModel: "gpt-4o",
        automationAutoFixSeoIssues: true,
        automationContentGenerationFrequency: "twice-weekly",
        automationReportGeneration: "weekly",
        securityTwoFactorAuth: false,
        securitySessionTimeout: 24,
        securityAllowApiAccess: true,
      });
    }
    
    return settings;
  }

  // ===========================================================================
  // WEBSITE MANAGEMENT
  // ===========================================================================

  async getUserWebsites(userId: string): Promise<Website[]> {
    return await db
      .select()
      .from(websites)
      .where(eq(websites.userId, userId))
      .orderBy(desc(websites.updatedAt));
  }

  async getUserWebsite(id: string, userId: string): Promise<Website | undefined> {
    const [website] = await db
      .select()
      .from(websites)
      .where(and(eq(websites.id, id), eq(websites.userId, userId)));
    return website;
  }

  async createWebsite(insertWebsite: InsertWebsite & { userId: string }): Promise<Website> {
    console.log("Creating website in database:", insertWebsite);
    
    const encryptedPassword = wordPressAuthService.encryptCredentials({
      applicationName: insertWebsite.wpApplicationName,
      applicationPassword: insertWebsite.wpApplicationPassword,
      username: insertWebsite.wpUsername || 'admin'
    });

    const [website] = await db
      .insert(websites)
      .values({
        ...insertWebsite,
        wpApplicationPassword: insertWebsite.wpApplicationPassword,
        status: "active",
        seoScore: 0,
        contentCount: 0,
        userId: insertWebsite.userId
      })
      .returning();
    
    console.log("Website created successfully:", website);

    await this.createActivityLog({
      userId: insertWebsite.userId,
      websiteId: website.id,
      type: "website_connected",
      description: `Website connected: ${website.name}`,
      metadata: { url: website.url, secure: true },
    });

    await this.createSecurityAudit({
      userId: insertWebsite.userId,
      websiteId: website.id,
      action: "website_connection",
      success: true,
      metadata: { 
        authType: "application_password", 
        applicationName: insertWebsite.wpApplicationName 
      },
    });

    return website;
  }

  async updateWebsite(id: string, updates: Partial<Website>): Promise<Website | undefined> {
    const [website] = await db
      .update(websites)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(websites.id, id))
      .returning();
    return website;
  }

  async deleteWebsite(id: string): Promise<boolean> {
    const result = await db.delete(websites).where(eq(websites.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async validateWebsiteOwnership(websiteId: string, userId: string): Promise<boolean> {
    const website = await this.getUserWebsite(websiteId, userId);
    return !!website;
  }

  // ===========================================================================
  // CONTENT MANAGEMENT
  // ===========================================================================

  async getUserContent(userId: string, websiteId?: string): Promise<Content[]> {
    if (websiteId) {
      const website = await this.getUserWebsite(websiteId, userId);
      if (!website) {
        return [];
      }
      return await this.getContentByWebsite(websiteId);
    }
    
    return await db
      .select()
      .from(content)
      .where(eq(content.userId, userId))
      .orderBy(desc(content.createdAt));
  }

  async getContentByWebsite(websiteId: string): Promise<Content[]> {
    return await db
      .select()
      .from(content)
      .where(eq(content.websiteId, websiteId))
      .orderBy(desc(content.createdAt));
  }

  async getContent(id: string): Promise<Content | undefined> {
    const [contentItem] = await db.select().from(content).where(eq(content.id, id));
    return contentItem;
  }

  async getPendingApprovalContent(): Promise<Content[]> {
    return await db
      .select()
      .from(content)
      .where(eq(content.status, "pending_approval"))
      .orderBy(desc(content.createdAt));
  }

  async getUserPendingApprovalContent(userId: string): Promise<Content[]> {
    return await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.status, "pending_approval"),
          eq(content.userId, userId)
        )
      )
      .orderBy(desc(content.createdAt));
  }

  async createContent(insertContent: InsertContent & { userId: string }): Promise<Content> {
    const [contentItem] = await db
      .insert(content)
      .values({
        ...insertContent,
        status: "pending_approval",
        userId: insertContent.userId
      })
      .returning();
    return contentItem;
  }

  async updateContent(id: string, updates: Partial<Content>): Promise<Content | undefined> {
    const [contentItem] = await db
      .update(content)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return contentItem;
  }

  async getUnpublishedContent(websiteId: string): Promise<Content[]> {
    return await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.websiteId, websiteId),
          or(
            eq(content.status, 'ready'),
            eq(content.status, 'pending_approval')
          )
        )
      )
      .orderBy(desc(content.createdAt));
  }

  async getAvailableContentForScheduling(websiteId: string, userId: string): Promise<Content[]> {
    const website = await this.getUserWebsite(websiteId, userId);
    if (!website) {
      return [];
    }
    
    const availableContent = await db
      .select({
        id: content.id,
        userId: content.userId,
        websiteId: content.websiteId,
        title: content.title,
        body: content.body,
        excerpt: content.excerpt,
        metaDescription: content.metaDescription,
        metaTitle: content.metaTitle,
        status: content.status,
        approvedBy: content.approvedBy,
        approvedAt: content.approvedAt,
        rejectionReason: content.rejectionReason,
        aiModel: content.aiModel,
        seoKeywords: content.seoKeywords,
        seoScore: content.seoScore,
        readabilityScore: content.readabilityScore,
        plagiarismScore: content.plagiarismScore,
        brandVoiceScore: content.brandVoiceScore,
        factCheckStatus: content.factCheckStatus,
        eatCompliance: content.eatCompliance,
        tokensUsed: content.tokensUsed,
        costUsd: content.costUsd,
        publishDate: content.publishDate,
        wordpressPostId: content.wordpressPostId,
        wordpressUrl: content.wordpressUrl,
        publishError: content.publishError,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        hasImages: content.hasImages,
        imageCount: content.imageCount,
        imageCostCents: content.imageCostCents
      })
      .from(content)
      .leftJoin(contentSchedule, eq(content.id, contentSchedule.contentId))
      .where(
        and(
          eq(content.websiteId, websiteId),
          eq(content.userId, userId),
          or(
            eq(content.status, 'ready'),
            eq(content.status, 'pending_approval')
          ),
          isNull(contentSchedule.id)
        )
      )
      .orderBy(desc(content.createdAt));
    
    return availableContent;
  }

  // ===========================================================================
  // CONTENT IMAGES
  // ===========================================================================

  async createContentImage(data: InsertContentImage & { userId: string }): Promise<ContentImage> {
    const validatedData = insertContentImageSchema.parse(data);
    const imageWithUserId = { ...validatedData, userId: data.userId };
    
    const [image] = await db.insert(contentImages).values(imageWithUserId).returning();
    return image;
  }

  async getContentImages(contentId: string): Promise<ContentImage[]> {
    return db
      .select()
      .from(contentImages)
      .where(eq(contentImages.contentId, contentId))
      .orderBy(contentImages.createdAt);
  }

  async updateContentImage(imageId: string, updates: Partial<{
    wordpressMediaId: number;
    wordpressUrl: string;
    status: string;
    uploadError: string;
  }>): Promise<ContentImage | null> {
    const [updated] = await db
      .update(contentImages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contentImages.id, imageId))
      .returning();
    
    return updated || null;
  }

  async getUserContentImages(userId: string, limit: number = 50): Promise<ContentImage[]> {
    return db
      .select()
      .from(contentImages)
      .where(eq(contentImages.userId, userId))
      .orderBy(desc(contentImages.createdAt))
      .limit(limit);
  }

  async deleteContentImages(contentId: string): Promise<void> {
    await this.db.delete(contentImages).where(eq(contentImages.contentId, contentId));
  }

  async getUserImageStats(userId: string): Promise<{
    totalImages: number;
    totalCostCents: number;
    imagesThisMonth: number;
    costThisMonthCents: number;
  }> {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [allTimeStats] = await this.db
      .select({
        totalImages: count(),
        totalCostCents: sum(contentImages.costCents)
      })
      .from(contentImages)
      .where(eq(contentImages.userId, userId));

    const [monthlyStats] = await this.db
      .select({
        imagesThisMonth: count(),
        costThisMonthCents: sum(contentImages.costCents)
      })
      .from(contentImages)
      .where(
        and(
          eq(contentImages.userId, userId),
          gte(contentImages.createdAt, thisMonth)
        )
      );

    return {
      totalImages: Number(allTimeStats.totalImages) || 0,
      totalCostCents: Number(allTimeStats.totalCostCents) || 0,
      imagesThisMonth: Number(monthlyStats.imagesThisMonth) || 0,
      costThisMonthCents: Number(monthlyStats.costThisMonthCents) || 0
    };
  }

  // ===========================================================================
  // CONTENT SCHEDULING
  // ===========================================================================

  async getContentSchedule(websiteId: string): Promise<ContentSchedule[]> {
    return await db
      .select()
      .from(contentSchedule)
      .where(eq(contentSchedule.websiteId, websiteId))
      .orderBy(desc(contentSchedule.scheduledDate));
  }

  async getContentScheduleByContentId(contentId: string): Promise<ContentSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(contentSchedule)
      .where(eq(contentSchedule.contentId, contentId));
    return schedule;
  }

  async getContentScheduleWithDetails(websiteId: string): Promise<Array<ContentSchedule & {
    contentTitle: string;
    contentExcerpt: string | null;
    seoKeywords: string[];
  }>> {
    const schedules = await db
      .select({
        id: contentSchedule.id,
        userId: contentSchedule.userId,
        websiteId: contentSchedule.websiteId,
        scheduledDate: contentSchedule.scheduledDate,
        status: contentSchedule.status,
        contentId: contentSchedule.contentId,
        abTestVariant: contentSchedule.abTestVariant,
        createdAt: contentSchedule.createdAt,
        contentTitle: content.title,
        contentExcerpt: content.excerpt,
        seoKeywords: content.seoKeywords
      })
      .from(contentSchedule)
      .innerJoin(content, eq(contentSchedule.contentId, content.id))
      .where(eq(contentSchedule.websiteId, websiteId))
      .orderBy(desc(contentSchedule.scheduledDate));

    return schedules.map(row => ({
      id: row.id,
      userId: row.userId,
      websiteId: row.websiteId,
      scheduledDate: row.scheduledDate,
      status: row.status,
      contentId: row.contentId,
      abTestVariant: row.abTestVariant,
      createdAt: row.createdAt,
      contentTitle: row.contentTitle,
      contentExcerpt: row.contentExcerpt,
      seoKeywords: row.seoKeywords || []
    }));
  }

  async updateContentSchedule(id: string, updates: Partial<{
    scheduledDate: Date;
    status: string;
    contentId: string;
    abTestVariant: string | null;
  }>): Promise<ContentSchedule | undefined> {
    const [schedule] = await db
      .update(contentSchedule)
      .set({ ...updates })
      .where(eq(contentSchedule.id, id))
      .returning();
    return schedule;
  }

  async deleteContentSchedule(id: string): Promise<boolean> {
    const result = await db.delete(contentSchedule).where(eq(contentSchedule.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getContentScheduleById(id: string): Promise<ContentSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(contentSchedule)
      .where(eq(contentSchedule.id, id));
    return schedule;
  }

  async getUserContentSchedule(userId: string, websiteId?: string): Promise<ContentSchedule[]> {
    if (websiteId) {
      const website = await this.getUserWebsite(websiteId, userId);
      if (!website) {
        return [];
      }
      return await this.getContentSchedule(websiteId);
    }
    
    return await db
      .select()
      .from(contentSchedule)
      .where(eq(contentSchedule.userId, userId))
      .orderBy(contentSchedule.scheduledDate);
  }

  async getPendingScheduledContent(): Promise<ContentSchedule[]> {
    const now = new Date();
    return await db
      .select()
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.status, 'scheduled'),
          lte(contentSchedule.scheduledDate, now)
        )
      )
      .orderBy(contentSchedule.scheduledDate);
  }

  async getUpcomingScheduledContent(userId: string): Promise<ContentSchedule[]> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'scheduled'),
          gte(contentSchedule.scheduledDate, now),
          lte(contentSchedule.scheduledDate, nextWeek)
        )
      )
      .orderBy(contentSchedule.scheduledDate);
  }

  async isContentScheduled(contentId: string): Promise<boolean> {
    const [schedule] = await db
      .select()
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.contentId, contentId),
          or(
            eq(contentSchedule.status, 'scheduled'),
            eq(contentSchedule.status, 'publishing')
          )
        )
      );
    return !!schedule;
  }

  async createContentSchedule(data: {
    contentId?: string;
    content_id?: string;
    userId?: string;
    user_id?: string;
    websiteId?: string;
    website_id?: string;
    scheduled_date?: Date | string | null;
    scheduledDate?: Date | string | null;
    scheduledFor?: Date | string | null;
    status?: string;
    title?: string | null;
    topic?: string | null;
    metadata?: any;
  }) {
    const contentId = data.contentId || data.content_id;
    const userId = data.userId || data.user_id;
    const websiteId = data.websiteId || data.website_id;

    let scheduledDate: Date;
    
    const possibleDate = data.scheduled_date || data.scheduledDate || data.scheduledFor;
    
    if (possibleDate instanceof Date) {
      scheduledDate = possibleDate;
    } else if (possibleDate && typeof possibleDate === 'string') {
      const parsed = new Date(possibleDate);
      if (!isNaN(parsed.getTime())) {
        scheduledDate = parsed;
      } else {
        console.warn('⚠️ Invalid date string provided:', possibleDate);
        scheduledDate = new Date();
      }
    } else {
      console.warn('⚠️ No valid scheduled_date provided, using current time');
      scheduledDate = new Date();
    }
    
    let title = data.title;
    if (!title || title.trim() === '') {
      title = `Content scheduled on ${scheduledDate.toLocaleDateString()}`;
      console.warn('⚠️ No title provided, using default:', title);
    }
    
    let topic = data.topic || data.metadata?.topic;
    if (!topic || topic.trim() === '') {
      topic = 'General Content';
      console.warn('⚠️ No topic provided, using default:', topic);
    }
    
    if (!contentId) {
      throw new Error('contentId is required for createContentSchedule');
    }
    if (!userId) {
      throw new Error('userId is required for createContentSchedule');
    }
    if (!websiteId) {
      throw new Error('websiteId is required for createContentSchedule');
    }
    
    console.log('📋 Creating content_schedule entry:', {
      contentId: contentId,
      userId: userId,
      websiteId: websiteId,
      scheduled_date: scheduledDate.toISOString(),
      title: title,
      topic: topic,
      status: data.status || 'scheduled',
    });
    
    try {
      const [schedule] = await db
        .insert(contentSchedule)
        .values({
          contentId: contentId,      
          userId: userId,            
          websiteId: websiteId,      
          scheduledDate: scheduledDate,  
          title: title,
          topic: topic,
          status: data.status || 'scheduled',
          metadata: data.metadata || {},
          publishedAt: null,
        })
        .returning();
      
      console.log('✅ Content schedule created successfully:', {
        id: schedule.id,
        scheduledDate: schedule.scheduledDate || schedule.scheduled_date,
        title: schedule.title,
        topic: schedule.topic,
      });
      
      return schedule;
      
    } catch (error: any) {
      console.error('❌ Database error in createContentSchedule:', error);
      console.error('Failed data:', {
        contentId,
        userId,
        websiteId,
        scheduled_date: scheduledDate?.toISOString(),
        title,
        topic,
        status: data.status,
      });
      
      if (error.message?.includes('null value in column')) {
        const columnMatch = error.message.match(/column "([^"]+)"/);
        if (columnMatch) {
          console.error(`📌 Required field '${columnMatch[1]}' is null or missing`);
          console.error(`Add this field to the values object in createContentSchedule`);
        }
      }
      
      throw error;
    }
  }

  async updateContentScheduleByContentId(contentId: string, updates: {
    status?: string;
    published_at?: Date;
    error?: string;
    metadata?: any;
  }) {
    const updateData: any = {};
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.published_at !== undefined) updateData.publishedAt = updates.published_at;
    if (updates.error !== undefined) {
      updateData.metadata = {
        ...(updateData.metadata || {}),
        error: updates.error,
        errorAt: new Date().toISOString()
      };
    }
    if (updates.metadata !== undefined) {
      updateData.metadata = {
        ...(updateData.metadata || {}),
        ...updates.metadata
      };
    }
    
    updateData.updatedAt = new Date();
    
    const result = await db
      .update(contentSchedule)
      .set(updateData)
      .where(eq(contentSchedule.contentId, contentId))
      .returning();
    
    return result[0] || null;
  }

  async getSchedulingStats(userId: string): Promise<{
    totalScheduled: number;
    scheduledThisWeek: number;
    scheduledThisMonth: number;
    overdueCount: number;
    publishedFromSchedule: number;
  }> {
    const now = new Date();
    const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const [totalScheduled] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'scheduled')
        )
      );
    
    const [scheduledThisWeek] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'scheduled'),
          gte(contentSchedule.scheduledDate, now),
          lte(contentSchedule.scheduledDate, thisWeek)
        )
      );
    
    const [scheduledThisMonth] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'scheduled'),
          gte(contentSchedule.scheduledDate, thisMonthStart),
          lte(contentSchedule.scheduledDate, thisMonthEnd)
        )
      );
    
    const [overdueCount] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'scheduled'),
          lte(contentSchedule.scheduledDate, now)
        )
      );
    
    const [publishedFromSchedule] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(
        and(
          eq(contentSchedule.userId, userId),
          eq(contentSchedule.status, 'published')
        )
      );
    
    return {
      totalScheduled: Number(totalScheduled.count) || 0,
      scheduledThisWeek: Number(scheduledThisWeek.count) || 0,
      scheduledThisMonth: Number(scheduledThisMonth.count) || 0,
      overdueCount: Number(overdueCount.count) || 0,
      publishedFromSchedule: Number(publishedFromSchedule.count) || 0
    };
  }

  // ===========================================================================
  // AUTO-SCHEDULING
  // ===========================================================================

  async getActiveAutoSchedules(): Promise<AutoSchedule[]> {
    try {
      const schedules = await db
        .select()
        .from(autoSchedules)
        .where(
          and(
            eq(autoSchedules.isActive, true),
            isNull(autoSchedules.deletedAt)
          )
        )
        .orderBy(desc(autoSchedules.createdAt));
      
      return schedules.map(schedule => ({
        ...schedule,
        topics: schedule.topics || [],
        customDays: schedule.customDays || [],
        publishDelay: schedule.publishDelay || 0,
        topicRotation: schedule.topicRotation || 'sequential',
        nextTopicIndex: schedule.nextTopicIndex || 0,
        maxDailyCost: schedule.maxDailyCost || 10,
        maxMonthlyPosts: schedule.maxMonthlyPosts || 30,
        costToday: schedule.costToday || 0,
        postsThisMonth: schedule.postsThisMonth || 0,
      }));
    } catch (error) {
      console.error('Error fetching active auto-schedules:', error);
      return [];
    }
  }

  async updateAutoSchedule(scheduleId: string, updates: any): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };
      
      if (updates.lastRun !== undefined) {
        updateData.lastRun = updates.lastRun;
      }
      
      if (updates.postsThisMonth !== undefined) {
        const posts = typeof updates.postsThisMonth === 'string' 
          ? parseInt(updates.postsThisMonth) 
          : updates.postsThisMonth;
        updateData.postsThisMonth = posts || 0;
      }
      
      if (updates.costToday !== undefined) {
        let cost = updates.costToday;
        
        if (typeof cost === 'string' && cost.includes('.') && cost.split('.').length > 2) {
          const parts = cost.split('.');
          cost = parseFloat(`0.${parts[parts.length - 1]}`);
        } else {
          cost = parseFloat(cost);
        }
        
        if (isNaN(cost)) {
          console.error('Invalid costToday value:', updates.costToday);
          updateData.costToday = 0;
        } else {
          updateData.costToday = cost;
        }
        
        console.log('Cost update:', {
          original: updates.costToday,
          parsed: cost,
          final: updateData.costToday
        });
      }
      
      if (updates.nextTopicIndex !== undefined) {
        const index = typeof updates.nextTopicIndex === 'string' 
          ? parseInt(updates.nextTopicIndex) 
          : updates.nextTopicIndex;
        updateData.nextTopicIndex = index || 0;
      }

      console.log('Updating auto-schedule:', {
        scheduleId,
        updates: updateData
      });

      await db
        .update(autoSchedules)
        .set(updateData)
        .where(eq(autoSchedules.id, scheduleId));
        
      console.log('✅ Auto-schedule updated successfully');
    } catch (error) {
      console.error('Error updating auto-schedule:', error);
      throw error;
    }
  }

  async resetAutoScheduleDailyCosts(): Promise<void> {
    try {
      await db
        .update(autoSchedules)
        .set({ 
          costToday: 0,
          updatedAt: new Date()
        })
        .where(eq(autoSchedules.isActive, true));
      
      console.log('✅ Daily costs reset for all active auto-schedules');
    } catch (error) {
      console.error('Error resetting daily costs:', error);
      throw error;
    }
  }

  async resetAutoScheduleMonthlyCounts(): Promise<void> {
    try {
      await db
        .update(autoSchedules)
        .set({ 
          postsThisMonth: 0,
          updatedAt: new Date()
        })
        .where(eq(autoSchedules.isActive, true));
      
      console.log('✅ Monthly post counts reset for all active auto-schedules');
    } catch (error) {
      console.error('Error resetting monthly counts:', error);
      throw error;
    }
  }

  async createAutoSchedule(schedule: InsertAutoSchedule & { userId: string }): Promise<AutoSchedule> {
    try {
      const scheduleData = {
        id: randomUUID(),
        userId: schedule.userId,
        websiteId: schedule.websiteId,
        name: schedule.name,
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
        customDays: schedule.customDays || [],
        topics: schedule.topics || [],
        keywords: schedule.keywords || null,
        tone: schedule.tone || 'professional',
        wordCount: schedule.wordCount || 800,
        brandVoice: schedule.brandVoice || null,
        targetAudience: schedule.targetAudience || null,
        eatCompliance: schedule.eatCompliance || false,
        aiProvider: schedule.aiProvider || 'openai',
        includeImages: schedule.includeImages || false,
        imageCount: schedule.imageCount || 1,
        imageStyle: schedule.imageStyle || 'natural',
        seoOptimized: schedule.seoOptimized !== false,
        autoPublish: schedule.autoPublish || false,
        publishDelay: schedule.publishDelay || 0,
        topicRotation: schedule.topicRotation || 'random',
        nextTopicIndex: schedule.nextTopicIndex || 0,
        maxDailyCost: schedule.maxDailyCost || 5.00,
        maxMonthlyPosts: schedule.maxMonthlyPosts || 30,
        costToday: schedule.costToday || 0,
        postsThisMonth: schedule.postsThisMonth || 0,
        lastRun: schedule.lastRun || null,
        isActive: schedule.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [newSchedule] = await db
        .insert(autoSchedules)
        .values(scheduleData)
        .returning();
      
      console.log('Auto-schedule created successfully:', newSchedule.id);
      return newSchedule;
    } catch (error) {
      console.error('Error creating auto-schedule:', error);
      throw error;
    }
  }

  async getAutoSchedule(scheduleId: string): Promise<AutoSchedule | undefined> {
    try {
      const [schedule] = await db
        .select()
        .from(autoSchedules)
        .where(eq(autoSchedules.id, scheduleId));
      
      return schedule;
    } catch (error) {
      console.error('Error fetching auto-schedule:', error);
      return undefined;
    }
  }

  async deleteAutoSchedule(scheduleId: string): Promise<boolean> {
    try {
      await db
        .update(autoSchedules)
        .set({ 
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(autoSchedules.id, scheduleId));
      
      return true;
    } catch (error) {
      console.error('Error deleting auto-schedule:', error);
      return false;
    }
  }

  async getUserAutoSchedules(userId: string): Promise<AutoSchedule[]> {
    try {
      const schedules = await db
        .select()
        .from(autoSchedules)
        .where(
          and(
            eq(autoSchedules.userId, userId),
            isNull(autoSchedules.deletedAt)
          )
        )
        .orderBy(desc(autoSchedules.createdAt));
      
      return schedules;
    } catch (error) {
      console.error('Error fetching user auto-schedules:', error);
      return [];
    }
  }

  // ===========================================================================
  // SEO REPORTS
  // ===========================================================================

  async getUserSeoReports(userId: string, websiteId?: string): Promise<SeoReport[]> {
    if (websiteId) {
      const website = await this.getUserWebsite(websiteId, userId);
      if (!website) {
        return [];
      }
      return await this.getSeoReportsByWebsite(websiteId);
    }
    
    return await db
      .select()
      .from(seoReports)
      .where(eq(seoReports.userId, userId))
      .orderBy(desc(seoReports.createdAt));
  }

  async getSeoReportsByWebsite(websiteId: string): Promise<SeoReport[]> {
    return await db
      .select()
      .from(seoReports)
      .where(eq(seoReports.websiteId, websiteId))
      .orderBy(desc(seoReports.createdAt));
  }

  async getLatestSeoReport(websiteId: string): Promise<SeoReport | undefined> {
    const [report] = await db
      .select()
      .from(seoReports)
      .where(eq(seoReports.websiteId, websiteId))
      .orderBy(desc(seoReports.createdAt))
      .limit(1);
    return report;
  }

  async createSeoReport(insertReport: InsertSeoReport & { userId: string }): Promise<SeoReport> {
    const [report] = await db
      .insert(seoReports)
      .values({
        ...insertReport,
        userId: insertReport.userId
      })
      .returning();
    return report;
  }

  // ===========================================================================
  // ACTIVITY LOGS & AUDITS
  // ===========================================================================

  async getUserActivityLogs(userId: string, websiteId?: string): Promise<ActivityLog[]> {
    if (websiteId) {
      const website = await this.getUserWebsite(websiteId, userId);
      if (!website) {
        return [];
      }
      
      return await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.websiteId, websiteId))
        .orderBy(desc(activityLogs.createdAt));
    }
    
    return await db
      .select()
      .from(activityLogs)
      .where(
        or(
          eq(activityLogs.userId, userId),
          isNull(activityLogs.userId)
        )
      )
      .orderBy(desc(activityLogs.createdAt));
  }

  async getActivityLogs(websiteId?: string): Promise<ActivityLog[]> {
    if (websiteId) {
      return await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.websiteId, websiteId))
        .orderBy(desc(activityLogs.createdAt));
    }
    
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt));
  }

  async createActivityLog(insertLog: InsertActivityLog & { userId: string }): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values({
        ...insertLog,
        userId: insertLog.userId
      })
      .returning();
    return log;
  }

  async createContentApproval(approval: InsertContentApproval & { userId: string }): Promise<ContentApproval> {
    const [approvalRecord] = await db
      .insert(contentApprovals)
      .values({
        ...approval,
        userId: approval.userId
      })
      .returning();
    return approvalRecord;
  }

  async createSecurityAudit(audit: InsertSecurityAudit & { userId?: string }): Promise<SecurityAudit> {
    const [auditRecord] = await db
      .insert(securityAudits)
      .values({
        ...audit,
        userId: audit.userId || null
      })
      .returning();
    return auditRecord;
  }

  async trackAiUsage(usage: InsertAiUsageTracking & { userId: string }): Promise<AiUsageTracking> {
    const [usageRecord] = await db
      .insert(aiUsageTracking)
      .values({
        ...usage,
        userId: usage.userId
      })
      .returning();
    return usageRecord;
  }

  async createSeoAudit(audit: InsertSeoAudit & { userId: string }): Promise<SeoAudit> {
    const [auditRecord] = await db
      .insert(seoAudits)
      .values({
        ...audit,
        userId: audit.userId
      })
      .returning();
    return auditRecord;
  }

  async createBackup(backup: InsertBackup & { userId: string }): Promise<Backup> {
    const [backupRecord] = await db
      .insert(backups)
      .values({
        ...backup,
        userId: backup.userId
      })
      .returning();
    return backupRecord;
  }

  // ===========================================================================
  // CLIENT REPORTS
  // ===========================================================================

  async getClientReports(websiteId: string): Promise<ClientReport[]> {
    return await db
      .select()
      .from(clientReports)
      .where(eq(clientReports.websiteId, websiteId))
      .orderBy(desc(clientReports.generatedAt));
  }

  async createClientReport(insertReport: InsertClientReport & { userId: string }): Promise<ClientReport> {
    const [report] = await db
      .insert(clientReports)
      .values({
        ...insertReport,
        userId: insertReport.userId
      })
      .returning();
    return report;
  }

  async updateClientReport(id: string, updates: Partial<{
    data: any;
    insights: any[];
    roiData: any;
    generatedAt: Date;
  }>): Promise<ClientReport | undefined> {
    const [report] = await db
      .update(clientReports)
      .set({ ...updates })
      .where(eq(clientReports.id, id))
      .returning();
    return report;
  }

  // ===========================================================================
  // DASHBOARD STATS
  // ===========================================================================

  async getUserDashboardStats(userId: string): Promise<{
    websiteCount: number;
    contentCount: number;
    avgSeoScore: number;
    recentActivity: number;
    scheduledPosts: number;
    seoReports?: any[];
  }> {
    const userWebsites = await this.getUserWebsites(userId);
    const userContent = await this.getUserContent(userId);
    const recentLogs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.userId, userId),
          gte(activityLogs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );
    
    const [scheduledCount] = await db
      .select({ count: count() })
      .from(contentSchedule)
      .where(eq(contentSchedule.userId, userId));

    const allSeoReports = [];
    for (const website of userWebsites) {
      const reports = await this.getSeoReportsByWebsite(website.id);
      if (reports.length > 0) {
        allSeoReports.push(...reports);
      }
    }
    
    allSeoReports.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const currentScore = allSeoReports.length > 0 
      ? Math.round(allSeoReports[0].score)
      : 0;

    return {
      websiteCount: userWebsites.length,
      contentCount: userContent.length,
      avgSeoScore: currentScore,
      recentActivity: recentLogs.length,
      scheduledPosts: Number(scheduledCount?.count) || 0,
      seoReports: allSeoReports
    };
  }

  // ===========================================================================
  // API KEY MANAGEMENT
  // ===========================================================================

  private normalizeApiKey(row: any): UserApiKey {
    return {
      id: row.id,
      userId: row.user_id || row.userId,
      provider: row.provider,
      keyName: row.key_name || row.keyName,
      encryptedApiKey: row.encrypted_api_key || row.encryptedApiKey || row.encryptedKey,
      maskedKey: row.masked_key || row.maskedKey,
      isActive: row.is_active !== undefined ? row.is_active : row.isActive,
      validationStatus: row.validation_status || row.validationStatus,
      lastValidated: row.last_validated || row.lastValidated,
      validationError: row.validation_error || row.validationError,
      usageCount: row.usage_count !== undefined ? row.usage_count : row.usageCount,
      lastUsed: row.last_used || row.lastUsed,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };
  }

  async getUserApiKeys(userId: string): Promise<UserApiKey[]> {
    const rawKeys = await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .orderBy(desc(userApiKeys.createdAt));
    
    return rawKeys.map(row => this.normalizeApiKey(row));
  }

  async getUserApiKey(userId: string, keyId: string): Promise<UserApiKey | undefined> {
    const [rawKey] = await db
      .select()
      .from(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.id, keyId)
        )
      );
    
    return rawKey ? this.normalizeApiKey(rawKey) : undefined;
  }

  async createUserApiKey(userId: string, data: {
    provider: string;
    keyName: string;
    apiKey: string;
  }): Promise<UserApiKey> {
    const formatValidation = apiKeyEncryptionService.validateApiKeyFormat(data.provider, data.apiKey);
    if (!formatValidation.valid) {
      throw new Error(formatValidation.error || 'Invalid API key format');
    }

    const encryptedApiKey = apiKeyEncryptionService.encrypt(data.apiKey);
    const maskedKey = apiKeyEncryptionService.createMaskedKey(data.apiKey);

    const [rawKey] = await db
      .insert(userApiKeys)
      .values({
        userId,
        provider: data.provider,
        keyName: data.keyName,
        encryptedApiKey,
        maskedKey,
        validationStatus: 'pending'
      })
      .returning();

    return this.normalizeApiKey(rawKey);
  }

  async updateUserApiKey(userId: string, keyId: string, updates: Partial<{
    keyName: string;
    isActive: boolean;
    validationStatus: string;
    lastValidated: Date;
    validationError: string;
    usageCount: number;
    lastUsed: Date;
  }>): Promise<UserApiKey | undefined> {
    const dbUpdates: any = {};
    
    if (updates.keyName !== undefined) dbUpdates.key_name = updates.keyName;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.validationStatus !== undefined) dbUpdates.validation_status = updates.validationStatus;
    if (updates.lastValidated !== undefined) dbUpdates.last_validated = updates.lastValidated;
    if (updates.validationError !== undefined) dbUpdates.validation_error = updates.validationError;
    if (updates.usageCount !== undefined) dbUpdates.usage_count = updates.usageCount;
    if (updates.lastUsed !== undefined) dbUpdates.last_used = updates.lastUsed;
    
    if (Object.keys(dbUpdates).length === 0) {
      console.warn('updateUserApiKey called with no valid fields to update');
      const existingKey = await db
        .select()
        .from(userApiKeys)
        .where(
          and(
            eq(userApiKeys.userId, userId),
            eq(userApiKeys.id, keyId)
          )
        )
        .limit(1);
      return existingKey[0] ? this.normalizeApiKey(existingKey[0]) : undefined;
    }
    
    dbUpdates.updated_at = new Date();

    const [rawKey] = await db
      .update(userApiKeys)
      .set(dbUpdates)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.id, keyId)
        )
      )
      .returning();
    
    return rawKey ? this.normalizeApiKey(rawKey) : undefined;
  }

  async deleteUserApiKey(userId: string, keyId: string): Promise<boolean> {
    const result = await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.userId, userId),
          eq(userApiKeys.id, keyId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async getDecryptedApiKey(userId: string, keyId: string): Promise<string | null> {
    const apiKey = await this.getUserApiKey(userId, keyId);
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    try {
      return apiKeyEncryptionService.decrypt(apiKey.encryptedApiKey);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }

  async validateUserApiKey(userId: string, keyId: string): Promise<{ valid: boolean; error?: string }> {
    const apiKey = await this.getUserApiKey(userId, keyId);
    if (!apiKey) {
      return { valid: false, error: 'API key not found' };
    }

    try {
      const decryptedKey = await this.getDecryptedApiKey(userId, keyId);
      if (!decryptedKey) {
        return { valid: false, error: 'Could not decrypt API key' };
      }

      await this.updateUserApiKey(userId, keyId, {
        lastValidated: new Date(),
        validationStatus: 'valid',
        validationError: undefined
      });

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      
      await this.updateUserApiKey(userId, keyId, {
        lastValidated: new Date(),
        validationStatus: 'invalid',
        validationError: errorMessage
      });

      return { valid: false, error: errorMessage };
    }
  }

  async getApiKeyUsageStats(userId: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    validKeys: number;
    totalUsage: number;
  }> {
    const keys = await this.getUserApiKeys(userId);
    
    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.isActive).length,
      validKeys: keys.filter(k => k.validationStatus === 'valid').length,
      totalUsage: keys.reduce((sum, k) => sum + (k.usageCount || 0), 0)
    };
  }

  // ===========================================================================
  // SEO ISSUE TRACKING
  // ===========================================================================

  private generateIssueHash(issueType: string, websiteId: string, elementPath?: string): string {
    const hashInput = `${issueType}-${websiteId}-${elementPath || 'global'}`;
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  async createOrUpdateSeoIssue(issue: {
    userId: string;
    websiteId: string;
    issueType: string;
    issueTitle: string;
    issueDescription?: string;
    severity: 'critical' | 'warning' | 'info';
    autoFixAvailable: boolean;
    elementPath?: string;
    currentValue?: string;
    recommendedValue?: string;
    seoReportId?: string;
  }): Promise<SeoIssueTracking> {
    const issueHash = this.generateIssueHash(issue.issueType, issue.websiteId, issue.elementPath);
    
    try {
      const [existingIssue] = await db
        .select()
        .from(seoIssueTracking)
        .where(
          and(
            eq(seoIssueTracking.websiteId, issue.websiteId),
            eq(seoIssueTracking.userId, issue.userId),
            eq(seoIssueTracking.issueType, issue.issueType),
            eq(seoIssueTracking.issueTitle, issue.issueTitle)
          )
        )
        .limit(1);

      const now = new Date();
      
      if (existingIssue) {
        let newStatus = existingIssue.status;
        
        if (existingIssue.status === 'fixing') {
          newStatus = 'detected' as const;
          console.log(`Reset stuck fixing status for: ${issue.issueTitle}`);
        } else if (['fixed', 'resolved'].includes(existingIssue.status)) {
          newStatus = 'reappeared' as const;
        }
        
        const [updatedIssue] = await db
          .update(seoIssueTracking)
          .set({
            lastSeenAt: now,
            status: newStatus,
            issueDescription: issue.issueDescription,
            severity: issue.severity,
            autoFixAvailable: issue.autoFixAvailable,
            currentValue: issue.currentValue,
            recommendedValue: issue.recommendedValue,
            metadata: {
              ...existingIssue.metadata,
              lastDetectedInReport: issue.seoReportId,
              detectionCount: (existingIssue.metadata?.detectionCount || 0) + 1,
              reappearedAt: newStatus === 'reappeared' ? now.toISOString() : existingIssue.metadata?.reappearedAt,
              wasStuckInFixing: existingIssue.status === 'fixing' ? true : existingIssue.metadata?.wasStuckInFixing
            },
            updatedAt: now
          })
          .where(eq(seoIssueTracking.id, existingIssue.id))
          .returning();
        
        console.log(`Updated existing SEO issue: ${issue.issueTitle} (${existingIssue.status} → ${newStatus})`);
        return updatedIssue;
      } else {
        const [newIssue] = await db
          .insert(seoIssueTracking)
          .values({
            websiteId: issue.websiteId,
            userId: issue.userId,
            issueType: issue.issueType,
            issueTitle: issue.issueTitle,
            issueDescription: issue.issueDescription,
            severity: issue.severity,
            status: 'detected',
            autoFixAvailable: issue.autoFixAvailable,
            detectedAt: now,
            lastSeenAt: now,
            elementPath: issue.elementPath,
            currentValue: issue.currentValue,
            recommendedValue: issue.recommendedValue,
            metadata: {
              issueHash,
              firstDetectedInReport: issue.seoReportId,
              detectionCount: 1
            },
            createdAt: now,
            updatedAt: now
          })
          .returning();
        
        console.log(`Created new SEO issue: ${issue.issueTitle}`);
        return newIssue;
      }
    } catch (error) {
      console.error('Error creating/updating SEO issue:', error);
      throw error;
    }
  }

  async getTrackedSeoIssues(
    websiteId: string, 
    userId: string,
    options: {
      status?: string[];
      autoFixableOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<SeoIssueTracking[]> {
    try {
      let query = db
        .select()
        .from(seoIssueTracking)
        .where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId)
          )
        );

      if (options.status && options.status.length > 0) {
        query = query.where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId),
            inArray(seoIssueTracking.status, options.status)
          )
        );
      }

      if (options.autoFixableOnly) {
        query = query.where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId),
            eq(seoIssueTracking.autoFixAvailable, true)
          )
        );
      }

      query = query.orderBy(
        desc(seoIssueTracking.lastSeenAt)
      );

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const issues = await query;
      
      console.log(`Retrieved ${issues.length} tracked SEO issues for website ${websiteId}`);
      return issues;
    } catch (error) {
      console.error('Error getting tracked SEO issues:', error);
      throw error;
    }
  }

  async updateSeoIssueStatus(
    issueId: string,
    status: 'detected' | 'fixing' | 'fixed' | 'resolved' | 'reappeared',
    updates: {
      fixMethod?: 'ai_automatic' | 'manual';
      fixSessionId?: string;
      fixBefore?: string;
      fixAfter?: string;
      aiModel?: string;
      tokensUsed?: number;
      fixError?: string;
      resolutionNotes?: string;
    } = {}
  ): Promise<SeoIssueTracking | null> {
    try {
      const now = new Date();
      const updateData: any = {
        status,
        updatedAt: now
      };

      if (status === 'fixed' || status === 'resolved') {
        updateData.fixedAt = now;
        if (status === 'resolved') {
          updateData.resolvedAt = now;
        }
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[key] = value;
        }
      });

      const [existingIssue] = await db
        .select()
        .from(seoIssueTracking)
        .where(eq(seoIssueTracking.id, issueId))
        .limit(1);

      if (existingIssue) {
        updateData.metadata = {
          ...existingIssue.metadata,
          statusHistory: [
            ...(existingIssue.metadata?.statusHistory || []),
            {
              previousStatus: existingIssue.status,
              newStatus: status,
              timestamp: now.toISOString(),
              fixMethod: updates.fixMethod,
              fixSessionId: updates.fixSessionId
            }
          ],
          fixAttempts: status === 'fixing' 
            ? (existingIssue.metadata?.fixAttempts || 0) + 1
            : existingIssue.metadata?.fixAttempts,
          lastFixError: updates.fixError || existingIssue.metadata?.lastFixError
        };
      }

      const [updatedIssue] = await db
        .update(seoIssueTracking)
        .set(updateData)
        .where(eq(seoIssueTracking.id, issueId))
        .returning();

      console.log(`Updated SEO issue ${issueId} status to: ${status}`);
      return updatedIssue;
    } catch (error) {
      console.error('Error updating SEO issue status:', error);
      throw error;
    }
  }

  async bulkUpdateSeoIssueStatuses(
    issueIds: string[],
    status: 'detected' | 'fixing' | 'fixed' | 'resolved' | 'reappeared',
    fixSessionId?: string
  ): Promise<number> {
    try {
      const now = new Date();
      const updateData: any = {
        status,
        updatedAt: now
      };

      if (status === 'fixing' && fixSessionId) {
        updateData.fixSessionId = fixSessionId;
      }

      if (status === 'fixed' || status === 'resolved') {
        updateData.fixedAt = now;
        if (status === 'resolved') {
          updateData.resolvedAt = now;
        }
      }

      const result = await db
        .update(seoIssueTracking)
        .set(updateData)
        .where(inArray(seoIssueTracking.id, issueIds));

      console.log(`Bulk updated ${result.rowCount || 0} SEO issues to status: ${status}`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error bulk updating SEO issue statuses:', error);
      throw error;
    }
  }

  async getSeoIssueTrackingSummary(websiteId: string, userId: string): Promise<{
    totalIssues: number;
    detected: number;
    fixing: number;
    fixed: number;
    resolved: number;
    reappeared: number;
    autoFixable: number;
    completionPercentage: number;
    lastActivity: Date | null;
  }> {
    try {
      const [summary] = await db
        .select({
          totalIssues: count(),
          detected: count(sql`CASE WHEN status = 'detected' THEN 1 END`),
          fixing: count(sql`CASE WHEN status = 'fixing' THEN 1 END`),
          fixed: count(sql`CASE WHEN status = 'fixed' THEN 1 END`),
          resolved: count(sql`CASE WHEN status = 'resolved' THEN 1 END`),
          reappeared: count(sql`CASE WHEN status = 'reappeared' THEN 1 END`),
          autoFixable: count(sql`CASE WHEN auto_fix_available = true THEN 1 END`),
          lastActivity: sql<Date>`MAX(last_seen_at)`
        })
        .from(seoIssueTracking)
        .where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId)
          )
        );

      const completionPercentage = summary.totalIssues > 0 
        ? Math.round(((summary.fixed + summary.resolved) / summary.totalIssues) * 100)
        : 0;

      return {
        ...summary,
        completionPercentage
      };
    } catch (error) {
      console.error('Error getting SEO issue tracking summary:', error);
      throw error;
    }
  }

  async markIssuesAsResolved(
    websiteId: string,
    userId: string,
    currentIssueTypes: string[]
  ): Promise<number> {
    try {
      const now = new Date();
      
      let query = db
        .update(seoIssueTracking)
        .set({
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: 'auto_resolved',
          resolutionNotes: 'Issue no longer detected in latest analysis',
          updatedAt: now
        })
        .where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId),
            eq(seoIssueTracking.status, 'detected')
          )
        );

      if (currentIssueTypes.length > 0) {
        query = query.where(
          and(
            eq(seoIssueTracking.websiteId, websiteId),
            eq(seoIssueTracking.userId, userId),
            eq(seoIssueTracking.status, 'detected'),
            not(inArray(seoIssueTracking.issueType, currentIssueTypes))
          )
        );
      }

      const result = await query;

      console.log(`Auto-resolved ${result.rowCount || 0} issues no longer detected`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error marking issues as resolved:', error);
      throw error;
    }
  }

  // ===========================================================================
  // GOOGLE SEARCH CONSOLE
  // ===========================================================================

  async saveGscConfiguration(userId: string, config: InsertGscConfiguration): Promise<GscConfiguration> {
    const [saved] = await db
      .insert(gscConfigurations)
      .values({
        ...config,
        userId,
        isConfigured: true
      })
      .onConflictDoUpdate({
        target: gscConfigurations.userId,
        set: {
          ...config,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return saved;
  }

  async getGscConfiguration(userId: string): Promise<GscConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(gscConfigurations)
      .where(eq(gscConfigurations.userId, userId));
    
    return config;
  }

  async updateGscConfiguration(userId: string, updates: Partial<InsertGscConfiguration>): Promise<GscConfiguration | undefined> {
    const [updated] = await db
      .update(gscConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gscConfigurations.userId, userId))
      .returning();
    
    return updated;
  }

  async deleteGscConfiguration(userId: string): Promise<boolean> {
    const result = await db
      .delete(gscConfigurations)
      .where(eq(gscConfigurations.userId, userId));
    
    return (result.rowCount ?? 0) > 0;
  }

  async saveGscAccount(userId: string, account: InsertGscAccount): Promise<GscAccount> {
    const [saved] = await db
      .insert(gscAccounts)
      .values({
        ...account,
        userId
      })
      .onConflictDoUpdate({
        target: gscAccounts.id,
        set: {
          ...account,
          updatedAt: new Date()
        }
      })
      .returning();
    
    return saved;
  }

  async getGscAccounts(userId: string): Promise<GscAccount[]> {
    return await db
      .select()
      .from(gscAccounts)
      .where(eq(gscAccounts.userId, userId))
      .orderBy(desc(gscAccounts.createdAt));
  }

  async getGscAccount(userId: string, accountId: string): Promise<GscAccount | undefined> {
    const [account] = await db
      .select()
      .from(gscAccounts)
      .where(
        and(
          eq(gscAccounts.userId, userId),
          eq(gscAccounts.id, accountId)
        )
      );
    
    return account;
  }

  async updateGscAccount(userId: string, accountId: string, updates: Partial<GscAccount>): Promise<GscAccount | undefined> {
    const [updated] = await db
      .update(gscAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(gscAccounts.userId, userId),
          eq(gscAccounts.id, accountId)
        )
      )
      .returning();
    
    return updated;
  }

  async removeGscAccount(userId: string, accountId: string): Promise<boolean> {
    const result = await db
      .delete(gscAccounts)
      .where(
        and(
          eq(gscAccounts.userId, userId),
          eq(gscAccounts.id, accountId)
        )
      );
    
    return (result.rowCount ?? 0) > 0;
  }

  async getGscQuotaUsage(accountId: string, date?: Date): Promise<{ used: number; limit: number }> {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const [quota] = await db
      .select()
      .from(gscQuotaUsage)
      .where(
        and(
          eq(gscQuotaUsage.accountId, accountId),
          eq(gscQuotaUsage.date, targetDate)
        )
      );
    
    return {
      used: quota?.count || 0,
      limit: quota?.limit || 200
    };
  }

  async incrementGscQuotaUsage(accountId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await db
      .insert(gscQuotaUsage)
      .values({
        accountId,
        date: today,
        count: 1,
        limit: 200
      })
      .onConflictDoUpdate({
        target: [gscQuotaUsage.accountId, gscQuotaUsage.date],
        set: {
          count: sql`${gscQuotaUsage.count} + 1`,
          updatedAt: new Date()
        }
      });
  }
}

// =============================================================================
// STORAGE EXPORT
// =============================================================================

export const storage = new DatabaseStorage();