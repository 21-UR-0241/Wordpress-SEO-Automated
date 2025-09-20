// Add this file: server/services/scheduler-service.ts

import { storage } from "../storage";
import { wordpressService } from "./wordpress-service";
import { autoScheduleService } from "./auto-schedule-service";

export class SchedulerService {
  private isRunning = false;

  async processScheduledContent(): Promise<{
    processed: number;
    published: number;
    failed: number;
    results: any[];
  }> {
    if (this.isRunning) {
      console.log("⏳ Scheduler already running, skipping...");
      return { processed: 0, published: 0, failed: 0, results: [] };
    }

    this.isRunning = true;
    console.log("🕒 Starting scheduled content processing...");

    try {
      // Get all overdue scheduled content
      const overdueContent = await storage.getPendingScheduledContent();

      if (overdueContent.length === 0) {
        console.log("✅ No scheduled content to process");
        return { processed: 0, published: 0, failed: 0, results: [] };
      }

      console.log(
        `📋 Found ${overdueContent.length} scheduled items to process`
      );
      const results = [];

      for (const schedule of overdueContent) {
        try {
          console.log(`📤 Processing scheduled content: ${schedule.contentId}`);

          // Get the content
          const content = await storage.getContent(schedule.contentId);
          if (!content) {
            console.error(`❌ Content not found: ${schedule.contentId}`);
            await this.markScheduleFailed(schedule.id, "Content not found");
            results.push({
              scheduleId: schedule.id,
              success: false,
              error: "Content not found",
            });
            continue;
          }

          // Get the website
          const website = await storage.getUserWebsite(
            content.websiteId,
            content.userId
          );
          if (!website) {
            console.error(`❌ Website not found: ${content.websiteId}`);
            await this.markScheduleFailed(schedule.id, "Website not found");
            results.push({
              scheduleId: schedule.id,
              success: false,
              error: "Website not found",
            });
            continue;
          }

          // Publish the content
          const publishResult = await this.publishContentToWordPress(
            content,
            website
          );

          if (publishResult.success) {
            // Update content with WordPress details
            await storage.updateContent(content.id, {
              status: "published",
              publishDate: new Date(),
              wordpressPostId: publishResult.postId,
              wordpressUrl: publishResult.url,
              publishError: null,
            });

            // Update schedule status
            await storage.updateContentSchedule(schedule.id, {
              status: "published",
            });

            // Log activity
            await storage.createActivityLog({
              userId: content.userId,
              websiteId: content.websiteId,
              type: "scheduled_content_published",
              description: `Scheduled content published: "${content.title}"`,
              metadata: {
                scheduleId: schedule.id,
                contentId: content.id,
                wordpressPostId: publishResult.postId,
                wordpressUrl: publishResult.url,
                publishedAt: new Date().toISOString(),
              },
            });

            results.push({
              scheduleId: schedule.id,
              contentId: content.id,
              success: true,
              postId: publishResult.postId,
              url: publishResult.url,
            });

            console.log(`✅ Successfully published: ${content.title}`);
          } else {
            await this.markScheduleFailed(schedule.id, publishResult.error);
            await storage.updateContent(content.id, {
              status: "publish_failed",
              publishError: publishResult.error,
            });

            results.push({
              scheduleId: schedule.id,
              contentId: content.id,
              success: false,
              error: publishResult.error,
            });

            console.error(
              `❌ Failed to publish: ${content.title} - ${publishResult.error}`
            );
          }
        } catch (error) {
          console.error(`❌ Error processing schedule ${schedule.id}:`, error);
          await this.markScheduleFailed(
            schedule.id,
            error instanceof Error ? error.message : "Unknown error"
          );
          results.push({
            scheduleId: schedule.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const published = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(
        `🎯 Processing complete: ${published} published, ${failed} failed`
      );

      return {
        processed: overdueContent.length,
        published,
        failed,
        results,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async publishContentToWordPress(
    content: any,
    website: any
  ): Promise<{
    success: boolean;
    postId?: number;
    url?: string;
    error?: string;
  }> {
    try {
      const wpCredentials = {
        url: website.url,
        username: website.wpUsername || "admin",
        applicationPassword: website.wpApplicationPassword,
      };

      const postData = {
        title: content.title,
        content: content.body,
        excerpt: content.excerpt || "",
        status: "publish" as const,
        meta: {
          description: content.metaDescription || content.excerpt || "",
          title: content.metaTitle || content.title,
        },
      };

      const wpResult = await wordpressService.publishPost(
        wpCredentials,
        postData
      );

      return {
        success: true,
        postId: wpResult.id,
        url: wpResult.link,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown WordPress error",
      };
    }
  }

  private async markScheduleFailed(
    scheduleId: string,
    error: string
  ): Promise<void> {
    try {
      await storage.updateContentSchedule(scheduleId, { status: "failed" });

      const schedule = await storage.getContentScheduleById(scheduleId);
      if (schedule) {
        await storage.createActivityLog({
          userId: schedule.userId,
          websiteId: schedule.websiteId,
          type: "scheduled_content_failed",
          description: `Failed to publish scheduled content: "${schedule.topic}"`,
          metadata: {
            scheduleId,
            error,
            failedAt: new Date().toISOString(),
          },
        });
      }
    } catch (logError) {
      console.error("Failed to log schedule failure:", logError);
    }
  }

  // Method to start automatic scheduling (call this when server starts)
  startScheduler(intervalMinutes: number = 5): void {
    console.log(
      `🔄 Starting content scheduler (checking every ${intervalMinutes} minutes)`
    );

    // Run immediately
    this.processScheduledContent().catch(console.error);
    autoScheduleService.processAutoSchedules().catch(console.error);

    // Then run on interval
    setInterval(() => {
      this.processScheduledContent().catch(console.error);
      autoScheduleService.processAutoSchedules().catch(console.error);
    }, intervalMinutes * 60 * 1000);

    // Set up daily cost reset at midnight
    const now = new Date();
    const millisTillMidnight =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        0
      ).getTime() - now.getTime();

    setTimeout(() => {
      // Reset daily costs at midnight
      autoScheduleService.resetDailyCosts().catch(console.error);
      console.log("💰 Daily cost counters reset at midnight");

      // Then reset every 24 hours
      setInterval(() => {
        autoScheduleService.resetDailyCosts().catch(console.error);
        console.log("💰 Daily cost counters reset");
      }, 24 * 60 * 60 * 1000);
    }, millisTillMidnight);

    // Reset monthly counts if it's the first day of the month
    if (now.getDate() === 1) {
      autoScheduleService.resetMonthlyCounts().catch(console.error);
      console.log("📊 Monthly post counters reset");
    }
    // Set up monthly counter reset check
    setInterval(() => {
      const currentDate = new Date();
      if (currentDate.getDate() === 1 && currentDate.getHours() === 0) {
        autoScheduleService.resetMonthlyCounts().catch(console.error);
        console.log("📊 Monthly post counters reset");
      }
    }, 60 * 60 * 1000); // Check every hour
  }

  // Method for manual processing (for testing)
  async manualProcess(): Promise<any> {
    return this.processScheduledContent();
  }

  // Method for manually triggering auto-generation processing (for testing)
  async manualProcessAutoSchedules(): Promise<any> {
    return autoScheduleService.processAutoSchedules();
  }
}

export const schedulerService = new SchedulerService();

