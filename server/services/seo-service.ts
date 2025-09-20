import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";

export interface EnhancedSEOAnalysisResult {
  score: number;
  issues: SEOIssue[];
  recommendations: SEORecommendation[];
  pageSpeedScore?: number;
  technicalDetails: TechnicalSEODetails;
  contentAnalysis: ContentAnalysisResult;
  competitiveAnalysis?: CompetitiveAnalysisResult;
}

export interface ContentAnalysisResult {
  qualityScore: number;
  readabilityScore: number;
  keywordOptimization: KeywordOptimizationResult;
  eatScore: EATScore;
  contentGaps: string[];
  semanticKeywords: string[];
  contentStructureScore: number;
  uniquenessScore: number;
  userIntentAlignment: number;
}

export interface KeywordOptimizationResult {
  primaryKeywordDensity: number;
  keywordDistribution: "poor" | "good" | "excellent";
  missingKeywords: string[];
  keywordCannibalization: boolean;
  lsiKeywords: string[];
}

export interface EATScore {
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  overall: number;
}

export interface CompetitiveAnalysisResult {
  competitorUrls: string[];
  contentGapOpportunities: string[];
  strengthsVsCompetitors: string[];
  improvementOpportunities: string[];
}

export interface TechnicalSEODetails {
  metaTags: {
    hasTitle: boolean;
    titleLength: number;
    hasDescription: boolean;
    descriptionLength: number;
    hasKeywords: boolean;
    hasOgTags?: boolean;
    hasTwitterCards?: boolean;
  };
  headings: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    hasProperHierarchy: boolean;
  };
  images: {
    total: number;
    withoutAlt: number;
    withoutTitle: number;
  };
  links: {
    internal: number;
    external: number;
    broken: number;
  };
  performance: {
    loadTime?: number;
    pageSize?: number;
  };
  mobile: {
    responsive: boolean;
    viewportMeta: boolean;
  };
  schema?: {
    hasStructuredData: boolean;
  };
}

export interface SEOIssue {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  affectedPages: number;
  autoFixAvailable: boolean;
}

export interface SEORecommendation {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
}

export class EnhancedSEOService {
  constructor() {
    // Constructor no longer initializes AI clients - they're retrieved per-user
  }

  // Replace these methods in your seo-service.ts

  private async getUserOpenAI(userId: string): Promise<OpenAI | null> {
    if (!userId) {
      // No user ID - check system environment variables
      if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR) {
        return new OpenAI({
          apiKey:
            process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
        });
      }
      return null;
    }

    // First try user-specific API key
    const userApiKey = await storage.getDecryptedApiKey(userId, "openai");
    if (userApiKey) {
      return new OpenAI({ apiKey: userApiKey });
    }

    // Fallback to system environment variables
    if (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR) {
      console.log(
        `Using system OpenAI API key for user ${userId} (no user-specific key found)`
      );
      return new OpenAI({
        apiKey:
          process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
      });
    }

    return null;
  }

  private async getUserAnthropic(userId: string): Promise<Anthropic | null> {
    if (!userId) {
      // No user ID - check system environment variables
      if (process.env.ANTHROPIC_API_KEY) {
        return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }
      return null;
    }

    // First try user-specific API key
    const userApiKey = await storage.getDecryptedApiKey(userId, "anthropic");
    if (userApiKey) {
      return new Anthropic({ apiKey: userApiKey });
    }

    // Fallback to system environment variables
    if (process.env.ANTHROPIC_API_KEY) {
      console.log(
        `Using system Anthropic API key for user ${userId} (no user-specific key found)`
      );
      return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }

    return null;
  }

  // Also update getUserGooglePageSpeedApiKey to have the same fallback behavior
  private async getUserGooglePageSpeedApiKey(
    userId: string
  ): Promise<string | null> {
    if (!userId) {
      // No user ID - return system API key
      return process.env.GOOGLE_PAGESPEED_API_KEY || null;
    }

    try {
      // First try user-specific API key
      const userApiKey = await storage.getDecryptedApiKey(
        userId,
        "google_pagespeed"
      );
      if (userApiKey) {
        return userApiKey;
      }

      // Fallback to system environment variables
      if (process.env.GOOGLE_PAGESPEED_API_KEY) {
        console.log(
          `Using system Google PageSpeed API key for user ${userId} (no user-specific key found)`
        );
        return process.env.GOOGLE_PAGESPEED_API_KEY;
      }

      return null;
    } catch (error) {
      console.warn(
        `Failed to get Google PageSpeed API key for user ${userId}:`,
        error.message
      );
      // Still fallback to system environment variables on error
      return process.env.GOOGLE_PAGESPEED_API_KEY || null;
    }
  }
  async analyzeWebsite(
  url: string,
  targetKeywords?: string[],
  userId?: string,
  websiteId?: string
): Promise<EnhancedSEOAnalysisResult> {
  try {
    console.log(
      `Starting enhanced SEO analysis for: ${url}${
        userId ? ` (user: ${userId})` : ""
      }${websiteId ? ` (website: ${websiteId})` : ""}`
    );

    const normalizedUrl = this.normalizeUrl(url);

    // Perform basic technical analysis first
    const [pageContent, pageSpeedScore, technicalDetails] = await Promise.all([
      this.fetchPageContent(normalizedUrl),
      this.getPageSpeedScore(normalizedUrl, userId),
      this.performTechnicalAnalysis(normalizedUrl),
    ]);

    // Extract text content for AI analysis
    const textContent = this.extractTextContent(pageContent);
    const pageTitle = cheerio.load(pageContent)("title").text();
    const metaDescription =
      cheerio.load(pageContent)('meta[name="description"]').attr("content") || "";

    // Perform AI-powered content analysis (if user has AI keys)
    const contentAnalysis = await this.performAIContentAnalysis(
      textContent,
      pageTitle,
      metaDescription,
      targetKeywords || [],
      userId,
      //nadagdag
      websiteId
    );

    // Generate issues based on both technical and content analysis
    const issues = this.analyzeForIssues(
      technicalDetails,
      pageContent,
      contentAnalysis
    );
    const recommendations = this.generateEnhancedRecommendations(
      issues,
      technicalDetails,
      contentAnalysis
    );
    const score = this.calculateEnhancedScore(
      issues,
      pageSpeedScore,
      technicalDetails,
      contentAnalysis
    );

    // Store the SEO report if we have both userId and websiteId
    let seoReportId = "";
    if (userId && websiteId) {
      try {
        // Validate that the website exists and belongs to the user
        const website = await storage.getUserWebsite(websiteId, userId);
        if (!website) {
          throw new Error(
            `Website ${websiteId} not found or access denied for user ${userId}`
          );
        }

        const seoReport = await storage.createSeoReport({
          userId,
          websiteId,
          score,
          issues: issues.map((i) => ({
            type: i.type,
            title: i.title,
            description: i.description,
            affectedPages: i.affectedPages,
            autoFixAvailable: i.autoFixAvailable,
          })),
          recommendations,
          pageSpeedScore,
          metadata: {
            technicalDetails,
            contentAnalysis,
            analysisUrl: url,
            targetKeywords,
            aiAnalysisPerformed: !!userId,
            hasTrackedIssues: true,
            trackingEnabled: true
          },
        });
        seoReportId = seoReport.id;

        // Update the website's SEO score
        await storage.updateWebsite(websiteId, {
          seoScore: score,
          updatedAt: new Date(),
        });

        // NEW: Track individual issues
        await this.storeTrackedIssues(issues, userId, websiteId, seoReportId);

        console.log(`SEO report created with ID: ${seoReportId} and issues tracked`);
      } catch (error) {
        console.error("Failed to store SEO report or track issues:", error);
        console.log("Continuing with analysis despite storage failure");
      }
    } else {
      console.log("Skipping SEO report storage and issue tracking - missing userId or websiteId");
    }

    console.log(`Enhanced SEO analysis completed. Score: ${score}`);

    return {
      score,
      issues,
      recommendations,
      pageSpeedScore,
      technicalDetails,
      contentAnalysis,
    };
  } catch (error) {
    console.error("Enhanced SEO analysis failed:", error);
    throw new Error(`Failed to analyze website SEO: ${error.message}`);
  }
}


// Add method to get detailed SEO data including tracked issues (UPDATED)
async getDetailedSeoData(
  websiteId: string,
  userId: string
): Promise<{
  hasAIAnalysis: boolean;
  trackedIssues: any[];
  issuesSummary: any;
  recentActivity: any[];
}> {
  try {
    // Get the latest SEO report
    const seoReports = await storage.getSeoReportsByWebsite(websiteId);
    const latestReport = seoReports[0];
    
    const hasAIAnalysis = latestReport?.metadata?.aiAnalysisPerformed || false;
    
    // Get tracked issues - this already returns properly formatted data from storage
    const trackedIssues = await storage.getTrackedSeoIssues(websiteId, userId, {
      limit: 50 // Limit to recent issues
    });
    
    // Get summary statistics
    const issuesSummary = await storage.getSeoIssueTrackingSummary(websiteId, userId);
    
    // Get recent activity (last 10 status changes from metadata)
    const recentActivity = trackedIssues
      .filter(issue => issue.metadata?.statusHistory)
      .flatMap(issue => 
        (issue.metadata.statusHistory || []).map((history: any) => ({
          ...history,
          issueTitle: issue.issueTitle,
          issueType: issue.issueType,
          issueId: issue.id
        }))
      )
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    console.log(`Retrieved ${trackedIssues.length} tracked issues for website ${websiteId}`);

    return {
      hasAIAnalysis,
      trackedIssues,
      issuesSummary,
      recentActivity
    };
  } catch (error) {
    console.error('Error getting detailed SEO data:', error);
    return {
      hasAIAnalysis: false,
      trackedIssues: [],
      issuesSummary: {
        totalIssues: 0,
        detected: 0,
        fixing: 0,
        fixed: 0,
        resolved: 0,
        reappeared: 0,
        autoFixable: 0,
        completionPercentage: 0,
        lastActivity: null
      },
      recentActivity: []
    };
  }
}

//seo-service.ts - Update storeTrackedIssues to prevent duplicates of already fixed issues

private async storeTrackedIssues(
  issues: SEOIssue[],
  userId: string,
  websiteId: string,
  seoReportId: string
): Promise<void> {
  if (!userId || !websiteId) {
    console.log('Skipping issue tracking - missing userId or websiteId');
    return;
  }

  console.log(`Tracking ${issues.length} SEO issues for website ${websiteId}`);

  // Get ALL existing tracked issues, including fixed ones
  const existingTrackedIssues = await storage.getTrackedSeoIssues(websiteId, userId, {
    // Get all statuses to properly handle reappearing issues
    limit: 500
  });

  const AI_FIXABLE_TYPES = [
    'missing page title',
    'title tag too long', 
    'title tag too short',
    'missing meta description',
    'meta description too long',
    'missing h1 tag',
    'multiple h1 tags', 
    'improper heading hierarchy',
    'images missing alt text',
    'low content quality',
    'poor readability',
    'poor content structure',
    'missing viewport meta tag',
    'missing schema markup',
    'missing open graph tags',
    'poor keyword distribution',
    'keyword over-optimization',
    'missing important keywords',
  ];

  try {
    const currentIssueTypes = new Set<string>();
    
    for (const issue of issues) {
      try {
        const issueType = this.mapIssueToTrackingType(issue.title);
        currentIssueTypes.add(issueType);
        
        // Find if this issue was previously tracked
        const existingIssue = existingTrackedIssues.find(existing => 
          existing.issueType === issueType || 
          this.isSameIssue(existing, issue)
        );

        if (existingIssue) {
          // Issue exists - check its status
          if (existingIssue.status === 'fixed' || existingIssue.status === 'resolved') {
            // Issue was previously fixed but is detected again
            console.log(`Issue "${issue.title}" reappeared after being ${existingIssue.status}`);
            
            await storage.updateSeoIssueStatus(existingIssue.id, 'reappeared', {
              resolutionNotes: 'Issue detected again in new analysis',
              previousStatus: existingIssue.status,
              reappearedAt: new Date().toISOString(),
              lastSeenAt: new Date().toISOString()
            });
          } else if (existingIssue.status === 'fixing') {
            // Reset stuck fixing status
            console.log(`Resetting stuck "fixing" issue: ${issue.title}`);
            
            await storage.updateSeoIssueStatus(existingIssue.id, 'detected', {
              resolutionNotes: 'Reset from stuck fixing status during new analysis',
              lastSeenAt: new Date().toISOString()
            });
          } else if (existingIssue.status === 'detected' || existingIssue.status === 'reappeared') {
            // Update last seen timestamp
            await storage.updateSeoIssueStatus(existingIssue.id, existingIssue.status, {
              lastSeenAt: new Date().toISOString()
            });
          }
        } else {
          // New issue - create it
          const isAutoFixable = AI_FIXABLE_TYPES.some(type => 
            issue.title.toLowerCase().includes(type.toLowerCase())
          ) || issue.autoFixAvailable === true;

          await storage.createSeoIssue({
            userId,
            websiteId,
            seoReportId,
            issueType,
            issueTitle: issue.title,
            issueDescription: issue.description,
            severity: issue.type as 'critical' | 'warning' | 'info',
            autoFixAvailable: isAutoFixable,
            status: 'detected',
            elementPath: this.generateElementPath(issue.title),
            currentValue: this.extractCurrentValue(issue.title, issue.description),
            recommendedValue: this.generateRecommendedValue(issue.title, issue.description),
            detectedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString()
          });
          
          console.log(`Created new tracked issue: ${issue.title}`);
        }
      } catch (issueError) {
        console.error(`Failed to track individual issue "${issue.title}":`, issueError);
      }
    }

    // Mark issues as resolved if they're no longer detected
    // But ONLY if they were previously 'detected' or 'reappeared', not 'fixed'
    const issuesToResolve = existingTrackedIssues.filter(existing => {
      // Only auto-resolve issues that were detected/reappeared, not manually fixed
      if (!['detected', 'reappeared'].includes(existing.status)) {
        return false;
      }
      // Check if this issue type is no longer in current issues
      return !currentIssueTypes.has(existing.issueType);
    });

    for (const issueToResolve of issuesToResolve) {
      await storage.updateSeoIssueStatus(issueToResolve.id, 'resolved', {
        resolutionNotes: 'Issue no longer detected in latest analysis',
        resolvedAutomatically: true,
        resolvedAt: new Date().toISOString()
      });
      console.log(`Auto-resolved issue: ${issueToResolve.issueTitle}`);
    }

    // Important: Don't change 'fixed' issues to 'resolved' automatically
    // They should stay as 'fixed' to show they were addressed by AI
    const fixedIssues = existingTrackedIssues.filter(existing => 
      existing.status === 'fixed' && !currentIssueTypes.has(existing.issueType)
    );
    
    console.log(`${fixedIssues.length} issues remain marked as 'fixed' (not in current analysis)`);

    console.log(`Successfully processed ${issues.length} issues for tracking`);
  } catch (error) {
    console.error('Error in storeTrackedIssues:', error);
  }
}

private isSameIssue(tracked: any, reported: SEOIssue): boolean {
  // More sophisticated issue matching
  const trackedTitle = tracked.issueTitle.toLowerCase();
  const reportedTitle = reported.title.toLowerCase();
  
  // Exact match
  if (trackedTitle === reportedTitle) return true;
  
  // Partial match for key terms
  const keyTerms = [
    'meta description', 'title tag', 'h1', 'alt text',
    'viewport', 'schema', 'content quality', 'readability'
  ];
  
  for (const term of keyTerms) {
    if (trackedTitle.includes(term) && reportedTitle.includes(term)) {
      return true;
    }
  }
  
  return false;
}

private mapIssueToTrackingType(title: string): string {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("meta description")) return "missing_meta_description";
  if (titleLower.includes("title tag")) return "poor_title_tag";
  if (titleLower.includes("h1") || titleLower.includes("heading")) return "heading_structure";
  if (titleLower.includes("alt text") || titleLower.includes("image")) return "missing_alt_text";
  if (titleLower.includes("viewport")) return "missing_viewport_meta";
  if (titleLower.includes("schema") || titleLower.includes("structured data")) return "missing_schema";
  if (titleLower.includes("mobile") || titleLower.includes("responsive")) return "mobile_responsiveness";
  if (titleLower.includes("content quality")) return "low_content_quality";
  if (titleLower.includes("readability")) return "poor_readability";
  if (titleLower.includes("e-a-t")) return "low_eat_score";
  if (titleLower.includes("keyword")) return "keyword_optimization";
  if (titleLower.includes("open graph")) return "missing_og_tags";
  if (titleLower.includes("user intent")) return "poor_user_intent";
  if (titleLower.includes("content uniqueness") || titleLower.includes("uniqueness")) return "low_content_uniqueness";
  if (titleLower.includes("content structure")) return "poor_content_structure";
  
  return "other";
}


/**
 * Generate element path for issue tracking
 */
private generateElementPath(title: string): string | undefined {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("title tag")) return "title";
  if (titleLower.includes("meta description")) return 'meta[name="description"]';
  if (titleLower.includes("h1")) return "h1";
  if (titleLower.includes("viewport")) return 'meta[name="viewport"]';
  if (titleLower.includes("alt text")) return "img";
  
  return undefined;
}

/**
 * Extract current value from issue description
 */
private extractCurrentValue(title: string, description: string): string | undefined {
  if (title.toLowerCase().includes("missing")) {
    return "Not present";
  }
  
  if (title.toLowerCase().includes("too long")) {
    const match = description.match(/(\d+) characters/);
    return match ? `${match[1]} characters` : "Too long";
  }
  
  if (title.toLowerCase().includes("too short")) {
    const match = description.match(/(\d+) characters/);
    return match ? `${match[1]} characters` : "Too short";
  }
  
  return undefined;
}

/**
 * Generate recommended value for the issue
 */
private generateRecommendedValue(title: string, description: string): string | undefined {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("meta description")) {
    return titleLower.includes("missing") 
      ? "Add 120-160 character meta description"
      : "Optimize to 120-160 characters";
  }
  
  if (titleLower.includes("title tag")) {
    return titleLower.includes("missing")
      ? "Add 30-60 character title tag"
      : "Optimize to 30-60 characters";
  }
  
  if (titleLower.includes("alt text")) {
    return "Add descriptive alt text to images";
  }
  
  if (titleLower.includes("h1")) {
    return titleLower.includes("missing")
      ? "Add one H1 heading"
      : "Use only one H1 per page";
  }
  
  return undefined;
}

  private categorizeIssue(title: string): string {
    const titleLower = title.toLowerCase();

    if (
      titleLower.includes("meta") ||
      titleLower.includes("title") ||
      titleLower.includes("schema") ||
      titleLower.includes("viewport")
    ) {
      return "technical";
    }
    if (
      titleLower.includes("content") ||
      titleLower.includes("readability") ||
      titleLower.includes("quality") ||
      titleLower.includes("e-a-t")
    ) {
      return "content";
    }
    if (
      titleLower.includes("speed") ||
      titleLower.includes("performance") ||
      titleLower.includes("mobile")
    ) {
      return "performance";
    }

    return "other";
  }

  private calculateIssuePriority(issue: SEOIssue): number {
    let priority = 5; // Default medium priority

    switch (issue.type) {
      case "critical":
        priority = 9;
        break;
      case "warning":
        priority = 6;
        break;
      case "info":
        priority = 3;
        break;
    }

    // Boost priority for auto-fixable issues
    if (issue.autoFixAvailable) priority += 1;

    // Boost priority for issues affecting multiple pages
    if (issue.affectedPages > 5) priority += 1;

    return Math.min(10, priority);
  }

 private async performAIContentAnalysis(
  content: string,
  title: string,
  description: string,
  targetKeywords: string[],
  userId?: string,
  websiteId?: string
): Promise<ContentAnalysisResult> {
  // Default fallback result
  const defaultResult: ContentAnalysisResult = {
    qualityScore: 70,
    readabilityScore: 70,
    keywordOptimization: {
      primaryKeywordDensity: 2,
      keywordDistribution: "good",
      missingKeywords: [],
      keywordCannibalization: false,
      lsiKeywords: [],
    },
    eatScore: {
      expertise: 70,
      authoritativeness: 70,
      trustworthiness: 70,
      overall: 70,
    },
    contentGaps: [],
    semanticKeywords: [],
    contentStructureScore: 70,
    uniquenessScore: 70,
    userIntentAlignment: 70,
  };

  try {
    const analysisPrompt = `Analyze this webpage content for comprehensive SEO quality assessment:

TITLE: ${title}
META DESCRIPTION: ${description}
TARGET KEYWORDS: ${targetKeywords.join(", ")}

CONTENT:
${content.substring(0, 8000)} ${content.length > 8000 ? "...(truncated)" : ""}

Please provide a detailed SEO content analysis including:

1. CONTENT QUALITY (0-100): Overall content quality, depth, expertise, value to users, comprehensiveness
2. READABILITY (0-100): How easy is the content to read and understand (sentence length, word complexity, structure)
3. KEYWORD OPTIMIZATION:
   - Primary keyword density percentage (calculate based on target keywords)
   - Keyword distribution quality (poor/good/excellent)
   - Missing important keywords that should be included
   - LSI/semantic keywords already present in the content
4. E-A-T SCORING (0-100 each):
   - Expertise: Does content demonstrate subject matter expertise and depth?
   - Authoritativeness: Is the source presented as authoritative with credentials/citations?
   - Trustworthiness: Does content have trust signals, accuracy, transparency?
   - Overall: Combined E-A-T score
5. CONTENT GAPS: What important topics/subtopics are missing that users would expect?
6. SEMANTIC KEYWORDS: Related keywords and phrases that should be included to improve topical relevance
7. CONTENT STRUCTURE (0-100): Organization quality, logical flow, use of headings, scanability
8. UNIQUENESS (0-100): How original and differentiated is this content from typical content on this topic
9. USER INTENT ALIGNMENT (0-100): How well does the content match what users searching for these keywords actually want

Return ONLY valid JSON with this exact structure:
{
  "qualityScore": number,
  "readabilityScore": number,
  "keywordOptimization": {
    "primaryKeywordDensity": number,
    "keywordDistribution": "poor|good|excellent",
    "missingKeywords": ["keyword1", "keyword2"],
    "keywordCannibalization": boolean,
    "lsiKeywords": ["lsi1", "lsi2"]
  },
  "eatScore": {
    "expertise": number,
    "authoritativeness": number,
    "trustworthiness": number,
    "overall": number
  },
  "contentGaps": ["gap1", "gap2"],
  "semanticKeywords": ["semantic1", "semantic2"],
  "contentStructureScore": number,
  "uniquenessScore": number,
  "userIntentAlignment": number
}`;

    let analysisResult: string = "";
    let tokensUsed = 0;
    let aiProvider = "";

    // Get AI providers
    const openai = await this.getUserOpenAI(userId);
    const anthropic = await this.getUserAnthropic(userId);

    // Try OpenAI first
    if (openai) {
      console.log("Using OpenAI GPT-4 for content analysis...");
      try {
        const response = await openai.chat.completions.create({
          //nadagdag
          //gpt-4o-previw dati
          model: "gpt-4o" ,
          messages: [
            { 
              role: "system", 
              content: "You are an SEO expert. Return ONLY valid JSON without any markdown formatting or explanation."
            },
            { role: "user", content: analysisPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        
        analysisResult = response.choices[0].message.content || "";
        tokensUsed = response.usage?.total_tokens || 0;
        aiProvider = "openai";
        
        console.log("OpenAI GPT-4 response received, length:", analysisResult.length);
      } catch (openaiError) {
        console.error("OpenAI API error:", openaiError);
        console.log("OpenAI failed, will try Claude as fallback...");
        
        // Try Claude as fallback
        if (anthropic) {
          console.log("Falling back to Claude for content analysis...");
          try {
            const response = await anthropic.messages.create({
              model: "claude-3-5-sonnet-latest",
              max_tokens: 2000,
              messages: [{ role: "user", content: analysisPrompt }],
              temperature: 0.3,
            });
            
            analysisResult = response.content[0].type === "text" ? response.content[0].text : "";
            tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
            aiProvider = "anthropic";
            
            console.log("Claude fallback response received, length:", analysisResult.length);
          } catch (claudeError) {
            console.error("Claude API also failed:", claudeError);
            console.log("Both AI providers failed, using default analysis");
            return defaultResult;
          }
        } else {
          console.log("No Claude fallback available, using default analysis");
          return defaultResult;
        }
      }
    } else if (anthropic) {
      // No OpenAI configured, use Claude directly
      console.log("OpenAI not configured, using Claude for content analysis...");
      try {
        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 2000,
          messages: [{ role: "user", content: analysisPrompt }],
          temperature: 0.3,
        });
        
        analysisResult = response.content[0].type === "text" ? response.content[0].text : "";
        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        aiProvider = "anthropic";
        
        console.log("Claude response received, length:", analysisResult.length);
      } catch (claudeError) {
        console.error("Claude API error:", claudeError);
        console.log("Claude failed, using default analysis");
        return defaultResult;
      }
    } else {
      console.log("No AI service available, using default analysis");
      return defaultResult;
    }

    // Parse JSON response with better error handling
    let parsed: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("No JSON found in AI response:", analysisResult.substring(0, 500));
        throw new Error("No JSON structure found in AI response");
      }

      parsed = JSON.parse(jsonMatch[0]);
      console.log("Successfully parsed AI response");
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw response:", analysisResult.substring(0, 500));
      
      // Try to salvage what we can from the response
      const fallbackParsed = this.tryExtractScoresFromText(analysisResult);
      if (fallbackParsed) {
        parsed = fallbackParsed;
        console.log("Used fallback parsing for AI response");
      } else {
        console.log("Falling back to default result due to parse error");
        return defaultResult;
      }
    }

    // Validate and ensure all required fields exist with safe defaults
    const result: ContentAnalysisResult = {
      qualityScore: this.safeValidateScore(parsed.qualityScore, 70),
      readabilityScore: this.safeValidateScore(parsed.readabilityScore, 70),
      keywordOptimization: {
        primaryKeywordDensity: Math.max(
          0,
          Math.min(100, Number(parsed.keywordOptimization?.primaryKeywordDensity) || 2)
        ),
        keywordDistribution: ["poor", "good", "excellent"].includes(
          parsed.keywordOptimization?.keywordDistribution
        )
          ? parsed.keywordOptimization.keywordDistribution
          : "good",
        missingKeywords: Array.isArray(
          parsed.keywordOptimization?.missingKeywords
        )
          ? parsed.keywordOptimization.missingKeywords
          : [],
        keywordCannibalization: Boolean(
          parsed.keywordOptimization?.keywordCannibalization
        ),
        lsiKeywords: Array.isArray(parsed.keywordOptimization?.lsiKeywords)
          ? parsed.keywordOptimization.lsiKeywords
          : [],
      },
      eatScore: {
        expertise: this.safeValidateScore(parsed.eatScore?.expertise, 70),
        authoritativeness: this.safeValidateScore(
          parsed.eatScore?.authoritativeness,
          70
        ),
        trustworthiness: this.safeValidateScore(
          parsed.eatScore?.trustworthiness,
          70
        ),
        overall: this.safeValidateScore(parsed.eatScore?.overall, 70),
      },
      contentGaps: Array.isArray(parsed.contentGaps)
        ? parsed.contentGaps
        : [],
      semanticKeywords: Array.isArray(parsed.semanticKeywords)
        ? parsed.semanticKeywords
        : [],
      contentStructureScore: this.safeValidateScore(
        parsed.contentStructureScore,
        70
      ),
      uniquenessScore: this.safeValidateScore(parsed.uniquenessScore, 70),
      userIntentAlignment: this.safeValidateScore(
        parsed.userIntentAlignment,
        70
      ),
    };

    // Track AI usage if successful
    //nadagdag
    if (userId && websiteId && tokensUsed > 0) {
  const costPerToken = aiProvider === "openai" ? 0.01 / 1000 : 0.003 / 1000;
  const costUsd = tokensUsed * costPerToken;

  try {
    // First verify the website exists
    const website = await storage.getUserWebsite(websiteId, userId);
    if (website) {
      await storage.trackAiUsage({
        websiteId: websiteId,
        userId,
        model: aiProvider === "openai" ? "gpt-4-turbo" : "claude-3-5-sonnet-latest",  // Also update model name here
        tokensUsed,
        costUsd: Math.round(costUsd * 100),
        operation: "seo_content_analysis",
      });
    } else {
      console.warn(`Website ${websiteId} not found for user ${userId}, skipping AI usage tracking`);
    }
  } catch (trackingError) {
    console.warn("Failed to track AI usage:", trackingError.message);
  }
}


    
    //wag alisin
    // if (userId && tokensUsed > 0) {
    //   const costPerToken = aiProvider === "openai" ? 0.01 / 1000 : 0.003 / 1000;
    //   const costUsd = tokensUsed * costPerToken;

    //   try {
    //     await storage.trackAiUsage({
    //       websiteId: websiteId || "",
    //       userId,
    //       model: aiProvider === "openai" ? "gpt-4-turbo-preview" : "claude-3-5-sonnet-latest",
    //       tokensUsed,
    //       costUsd: Math.round(costUsd * 100),
    //       operation: "seo_content_analysis",
    //     });
    //   } catch (trackingError) {
    //     console.warn("Failed to track AI usage:", trackingError.message);
    //   }
    // }

    console.log("AI content analysis completed:", {
      provider: aiProvider,
      quality: result.qualityScore,
      readability: result.readabilityScore,
      eatOverall: result.eatScore.overall,
      contentGaps: result.contentGaps.length,
      semanticKeywords: result.semanticKeywords.length,
      tokensUsed,
    });

    return result;
  } catch (error) {
    console.error("AI content analysis failed:", error);
    console.log("Returning default analysis result");
    return defaultResult;
  }
}


// Add new helper method for safe score validation
private safeValidateScore(score: any, defaultValue: number = 70): number {
  try {
    return this.validateScore(score);
  } catch (error) {
    console.warn(`Score validation failed for value: ${score}, using default: ${defaultValue}`);
    return defaultValue;
  }
}

// Add fallback text extraction method
private tryExtractScoresFromText(text: string): any | null {
  try {
    const result: any = {
      qualityScore: 70,
      readabilityScore: 70,
      keywordOptimization: {
        primaryKeywordDensity: 2,
        keywordDistribution: "good",
        missingKeywords: [],
        keywordCannibalization: false,
        lsiKeywords: []
      },
      eatScore: {
        expertise: 70,
        authoritativeness: 70,
        trustworthiness: 70,
        overall: 70
      },
      contentGaps: [],
      semanticKeywords: [],
      contentStructureScore: 70,
      uniquenessScore: 70,
      userIntentAlignment: 70
    };

    // Try to extract numbers from text using regex
    const qualityMatch = text.match(/quality[:\s]+(\d+)/i);
    if (qualityMatch) result.qualityScore = parseInt(qualityMatch[1]);

    const readabilityMatch = text.match(/readability[:\s]+(\d+)/i);
    if (readabilityMatch) result.readabilityScore = parseInt(readabilityMatch[1]);

    const expertiseMatch = text.match(/expertise[:\s]+(\d+)/i);
    if (expertiseMatch) result.eatScore.expertise = parseInt(expertiseMatch[1]);

    const trustMatch = text.match(/trust[:\s]+(\d+)/i);
    if (trustMatch) result.eatScore.trustworthiness = parseInt(trustMatch[1]);

    return result;
  } catch (error) {
    return null;
  }
}

  private validateScore(score: any): number {
  const num = Number(score);
  if (isNaN(num)) {
    throw new Error(
      `Invalid score value: ${score}. Expected a number between 0-100.`
    );
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

  private extractTextContent(html: string): string {
    const $ = cheerio.load(html);

    // Remove script and style elements
    $(
      "script, style, nav, footer, header, aside, .menu, .sidebar, .ads"
    ).remove();

    // Extract main content text
    const mainSelectors = [
      "main",
      "article",
      ".content",
      ".post",
      ".entry-content",
      ".main-content",
      "#content",
    ];
    let mainContent = "";

    for (const selector of mainSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        mainContent = element.text();
        break;
      }
    }

    // Fallback to body if no main content found
    if (!mainContent) {
      mainContent = $("body").text();
    }

    // Clean up whitespace
    return mainContent.replace(/\s+/g, " ").trim();
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    return url;
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
        },
      });
      return response.data;
    } catch (error) {
      if (error.code === "ENOTFOUND") {
        throw new Error(
          `Cannot access website: Domain not found (${error.hostname})`
        );
      } else if (error.code === "ECONNREFUSED") {
        throw new Error(`Cannot access website: Connection refused`);
      } else if (error.code === "ETIMEDOUT") {
        throw new Error(`Cannot access website: Request timeout`);
      } else if (error.response?.status) {
        throw new Error(
          `Cannot access website: HTTP ${error.response.status} ${error.response.statusText}`
        );
      } else {
        throw new Error(`Cannot access website: ${error.message}`);
      }
    }
  }

  private async getPageSpeedScore(
    url: string,
    userId?: string
  ): Promise<number> {
    const googleApiKey = await this.getUserGooglePageSpeedApiKey(userId);

    if (!googleApiKey) {
      console.warn(
        `Google PageSpeed API key not configured${
          userId ? ` for user ${userId}` : ""
        }, using fallback analysis`
      );
      return this.estimatePageSpeedScore(url);
    }

    try {
      const [mobileResponse, desktopResponse] = await Promise.allSettled([
        axios.get(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
            url
          )}&key=${googleApiKey}&strategy=mobile&category=PERFORMANCE`
        ),
        axios.get(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
            url
          )}&key=${googleApiKey}&strategy=desktop&category=PERFORMANCE`
        ),
      ]);

      let mobileScore = 0;
      let desktopScore = 0;

      if (mobileResponse.status === "fulfilled") {
        mobileScore = Math.round(
          (mobileResponse.value.data?.lighthouseResult?.categories?.performance
            ?.score || 0) * 100
        );
      }

      if (desktopResponse.status === "fulfilled") {
        desktopScore = Math.round(
          (desktopResponse.value.data?.lighthouseResult?.categories?.performance
            ?.score || 0) * 100
        );
      }

      if (mobileScore === 0 && desktopScore === 0) {
        throw new Error("No valid PageSpeed data received");
      }

      // Weight mobile more heavily (60/40 split)
      const finalScore = mobileScore * 0.6 + desktopScore * 0.4;
      console.log(
        `PageSpeed scores - Mobile: ${mobileScore}, Desktop: ${desktopScore}, Final: ${Math.round(
          finalScore
        )}`
      );

      return Math.round(finalScore);
    } catch (error) {
      console.error("PageSpeed API failed, using fallback:", error.message);
      return await this.estimatePageSpeedScore(url);
    }
  }

  private async estimatePageSpeedScore(url: string): Promise<number> {
    try {
      const startTime = Date.now();
      await axios.head(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const loadTime = Date.now() - startTime;

      console.log(`Estimated load time: ${loadTime}ms`);

      if (loadTime < 800) return 95;
      if (loadTime < 1500) return 85;
      if (loadTime < 2500) return 75;
      if (loadTime < 4000) return 65;
      if (loadTime < 6000) return 55;
      return 45;
    } catch {
      return 50;
    }
  }
  private async performTechnicalAnalysis(
    url: string
  ): Promise<TechnicalSEODetails> {
    const html = await this.fetchPageContent(url);
    const $ = cheerio.load(html);

    const title = $("title").text().trim();
    const description =
      $('meta[name="description"]').attr("content")?.trim() || "";
    const keywords = $('meta[name="keywords"]').attr("content")?.trim() || "";
    const viewport = $('meta[name="viewport"]').attr("content")?.trim() || "";

    // Enhanced heading analysis
    const h1Count = $("h1").length;
    const h2Count = $("h2").length;
    const h3Count = $("h3").length;

    const headings = [];
    $("h1, h2, h3, h4, h5, h6").each((i, elem) => {
      headings.push(parseInt(elem.tagName.charAt(1)));
    });

    const hasProperHierarchy = this.checkHeadingHierarchy(headings);

    // Enhanced image analysis
    const images = $("img");
    const totalImages = images.length;
    let imagesWithoutAlt = 0;
    let imagesWithoutTitle = 0;

    images.each((i, elem) => {
      const alt = $(elem).attr("alt");
      const title = $(elem).attr("title");

      if (!alt || alt.trim() === "") imagesWithoutAlt++;
      if (!title || title.trim() === "") imagesWithoutTitle++;
    });

    // Enhanced link analysis
    const domain = new URL(url).hostname;
    const allLinks = $("a[href]");
    let internalLinks = 0;
    let externalLinks = 0;

    allLinks.each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        if (href.startsWith("/") || href.includes(domain)) {
          internalLinks++;
        } else if (href.startsWith("http")) {
          externalLinks++;
        }
      }
    });

    // Schema markup detection
    const hasSchemaMarkup =
      $('script[type="application/ld+json"]').length > 0 ||
      $("[itemscope]").length > 0 ||
      $("[typeof]").length > 0;

    // Social media meta tags
    const hasOgTags = $('meta[property^="og:"]').length > 0;
    const hasTwitterCards = $('meta[name^="twitter:"]').length > 0;

    // Enhanced responsive design check
    const responsive = this.checkResponsiveDesign($, html);

    return {
      metaTags: {
        hasTitle: title.length > 0,
        titleLength: title.length,
        hasDescription: description.length > 0,
        descriptionLength: description.length,
        hasKeywords: keywords.length > 0,
        hasOgTags,
        hasTwitterCards,
      },
      headings: {
        h1Count,
        h2Count,
        h3Count,
        hasProperHierarchy,
      },
      images: {
        total: totalImages,
        withoutAlt: imagesWithoutAlt,
        withoutTitle: imagesWithoutTitle,
      },
      links: {
        internal: internalLinks,
        external: externalLinks,
        broken: 0, // Would need additional checking
      },
      performance: {
        pageSize: html.length,
      },
      mobile: {
        responsive,
        viewportMeta: viewport.includes("width=device-width"),
      },
      schema: {
        hasStructuredData: hasSchemaMarkup,
      },
    };
  }

  private checkHeadingHierarchy(headings: number[]): boolean {
    if (headings.length <= 1) return true;

    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        return false; // Skipped a level
      }
    }
    return true;
  }

  private checkResponsiveDesign($: cheerio.CheerioAPI, html: string): boolean {
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    const hasMediaQueries =
      html.includes("@media") || html.includes("screen and (");
    const hasBootstrap =
      html.includes("bootstrap") || $(".container, .row, .col-").length > 0;
    const hasFlexbox =
      html.includes("display:flex") ||
      html.includes("display: flex") ||
      $(".d-flex").length > 0;
    const hasGrid =
      html.includes("display:grid") ||
      html.includes("display: grid") ||
      $(".grid").length > 0;
    const hasResponsiveClasses =
      $(".responsive, .mobile, .tablet, .desktop").length > 0;

    // More sophisticated check
    const responsiveIndicators = [
      hasViewportMeta,
      hasMediaQueries,
      hasBootstrap,
      hasFlexbox,
      hasGrid,
      hasResponsiveClasses,
    ].filter(Boolean).length;

    return responsiveIndicators >= 2; // Need at least 2 indicators
  }

  private analyzeForIssues(
    technicalDetails: TechnicalSEODetails,
    html: string,
    contentAnalysis: ContentAnalysisResult
  ): SEOIssue[] {
    const issues: SEOIssue[] = [];

    // Technical issues
    if (!technicalDetails.metaTags.hasTitle) {
      issues.push({
        type: "critical",
        title: "Missing Page Title",
        description:
          "The page is missing a title tag, which is crucial for SEO and user experience.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (technicalDetails.metaTags.titleLength > 60) {
      issues.push({
        type: "warning",
        title: "Title Tag Too Long",
        description: `Title tag is ${technicalDetails.metaTags.titleLength} characters. Keep it under 60 characters for optimal display.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (technicalDetails.metaTags.titleLength < 10) {
      issues.push({
        type: "warning",
        title: "Title Tag Too Short",
        description: `Title tag is only ${technicalDetails.metaTags.titleLength} characters. Consider expanding for better SEO.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (!technicalDetails.metaTags.hasDescription) {
      issues.push({
        type: "critical",
        title: "Missing Meta Description",
        description:
          "The page lacks a meta description, which impacts search result click-through rates.",
        affectedPages: 1,
        autoFixAvailable: true
      });
    }

    if (technicalDetails.metaTags.descriptionLength > 160) {
      issues.push({
        type: "warning",
        title: "Meta Description Too Long",
        description: `Meta description is ${technicalDetails.metaTags.descriptionLength} characters. Keep it under 160 characters.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Heading issues
    if (technicalDetails.headings.h1Count === 0) {
      issues.push({
        type: "critical",
        title: "Missing H1 Tag",
        description:
          "The page doesn't have an H1 tag, which should contain the main topic/keyword.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (technicalDetails.headings.h1Count > 1) {
      issues.push({
        type: "warning",
        title: "Multiple H1 Tags",
        description: `Found ${technicalDetails.headings.h1Count} H1 tags. Use only one H1 per page.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (!technicalDetails.headings.hasProperHierarchy) {
      issues.push({
        type: "warning",
        title: "Improper Heading Hierarchy",
        description:
          "Heading tags are not in proper hierarchical order (H1, H2, H3, etc.).",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Image issues
    if (technicalDetails.images.withoutAlt > 0) {
      issues.push({
        type: "warning",
        title: "Images Missing Alt Text",
        description: `${technicalDetails.images.withoutAlt} out of ${technicalDetails.images.total} images are missing alt text.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Mobile issues
    if (!technicalDetails.mobile.viewportMeta) {
      issues.push({
        type: "critical",
        title: "Missing Viewport Meta Tag",
        description:
          "The page lacks a viewport meta tag, affecting mobile responsiveness.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (!technicalDetails.mobile.responsive) {
      issues.push({
        type: "warning",
        title: "Not Mobile Responsive",
        description: "The page may not be optimized for mobile devices.",
        affectedPages: 1,
        autoFixAvailable: false,
      });
    }

    // Schema markup
    if (!technicalDetails.schema?.hasStructuredData) {
      issues.push({
        type: "warning",
        title: "Missing Schema Markup",
        description:
          "No structured data found. Schema markup helps search engines understand your content.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Social media tags
    if (!technicalDetails.metaTags.hasOgTags) {
      issues.push({
        type: "info",
        title: "Missing Open Graph Tags",
        description:
          "Open Graph tags improve how your content appears when shared on social media.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Content quality issues
    if (contentAnalysis.qualityScore < 60) {
      issues.push({
        type: "critical",
        title: "Low Content Quality",
        description: `Content quality score is ${contentAnalysis.qualityScore}/100. Content lacks depth, expertise, or value for users.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (contentAnalysis.readabilityScore < 70) {
      issues.push({
        type: "warning",
        title: "Poor Readability",
        description: `Readability score is ${contentAnalysis.readabilityScore}/100. Content is difficult to read and understand.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // E-A-T issues
    if (contentAnalysis.eatScore.overall < 60) {
      issues.push({
        type: "warning",
        title: "Low E-A-T Score",
        description: `E-A-T score is ${contentAnalysis.eatScore.overall}/100. Content lacks expertise, authoritativeness, or trustworthiness signals.`,
        affectedPages: 1,
        autoFixAvailable: false,
      });
    }

    // Keyword optimization issues
    if (contentAnalysis.keywordOptimization.keywordDistribution === "poor") {
      issues.push({
        type: "warning",
        title: "Poor Keyword Distribution",
        description:
          "Keywords are not well distributed throughout the content. Improve keyword placement in headings, body text, and meta tags.",
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (contentAnalysis.keywordOptimization.primaryKeywordDensity > 5) {
      issues.push({
        type: "warning",
        title: "Keyword Over-Optimization",
        description: `Keyword density is ${contentAnalysis.keywordOptimization.primaryKeywordDensity.toFixed(
          1
        )}%. Consider reducing to 1-3% to avoid penalties.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    if (contentAnalysis.keywordOptimization.missingKeywords.length > 0) {
      issues.push({
        type: "info",
        title: "Missing Important Keywords",
        description: `Consider adding these relevant keywords: ${contentAnalysis.keywordOptimization.missingKeywords
          .join(", ")}`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // Content structure issues
    if (contentAnalysis.contentStructureScore < 70) {
      issues.push({
        type: "warning",
        title: "Poor Content Structure",
        description: `Content structure score is ${contentAnalysis.contentStructureScore}/100. Improve organization, use more headings, and create better content flow.`,
        affectedPages: 1,
        autoFixAvailable: true,
      });
    }

    // User intent alignment
    if (contentAnalysis.userIntentAlignment < 70) {
      issues.push({
        type: "warning",
        title: "Poor User Intent Alignment",
        description: `User intent alignment is ${contentAnalysis.userIntentAlignment}/100. Content doesn't match what users are searching for.`,
        affectedPages: 1,
        autoFixAvailable: false,
      });
    }

    // Content uniqueness
    if (contentAnalysis.uniquenessScore < 60) {
      issues.push({
        type: "warning",
        title: "Low Content Uniqueness",
        description: `Uniqueness score is ${contentAnalysis.uniquenessScore}/100. Add more original insights, data, or perspectives.`,
        affectedPages: 1,
        autoFixAvailable: false,
      });
    }

    return issues;
  }

  private generateEnhancedRecommendations(
    issues: SEOIssue[],
    technicalDetails: TechnicalSEODetails,
    contentAnalysis: ContentAnalysisResult
  ): SEORecommendation[] {
    const recommendations: SEORecommendation[] = [];

    // Content-based recommendations
    if (contentAnalysis.contentGaps.length > 0) {
      recommendations.push({
        priority: "high",
        title: "Fill Content Gaps",
        description: `Add content covering these important topics: ${contentAnalysis.contentGaps
          .join(", ")}`,
        impact:
          "Better topic coverage and search visibility for long-tail queries",
      });
    }

    if (contentAnalysis.semanticKeywords.length > 0) {
      recommendations.push({
        priority: "medium",
        title: "Add Semantic Keywords",
        description: `Include these related keywords naturally: ${contentAnalysis.semanticKeywords
          .join(", ")}`,
        impact: "Improved semantic SEO and topical authority",
      });
    }

    if (contentAnalysis.eatScore.overall < 80) {
      recommendations.push({
        priority: "high",
        title: "Improve E-A-T Signals",
        description:
          "Add author bios, credentials, citations, testimonials, and trust signals to improve expertise, authoritativeness, and trustworthiness.",
        impact: "Better rankings for YMYL and competitive queries",
      });
    }

    if (contentAnalysis.uniquenessScore < 70) {
      recommendations.push({
        priority: "high",
        title: "Increase Content Uniqueness",
        description:
          "Add original insights, data, examples, case studies, or unique perspectives to differentiate from competitors.",
        impact: "Better differentiation from competitors and higher rankings",
      });
    }

    if (contentAnalysis.readabilityScore < 80) {
      recommendations.push({
        priority: "medium",
        title: "Improve Content Readability",
        description:
          "Use shorter sentences, simpler words, bullet points, and better formatting to improve readability.",
        impact: "Better user engagement and lower bounce rates",
      });
    }

    if (contentAnalysis.userIntentAlignment < 80) {
      recommendations.push({
        priority: "high",
        title: "Align Content with User Intent",
        description:
          "Restructure content to better match what users are actually searching for when using target keywords.",
        impact: "Higher click-through rates and better search rankings",
      });
    }

    // Technical recommendations
    if (!technicalDetails.schema?.hasStructuredData) {
      recommendations.push({
        priority: "high",
        title: "Implement Schema Markup",
        description:
          "Add structured data (JSON-LD) to help search engines understand your content better.",
        impact: "Improved rich snippets and search visibility",
      });
    }

    if (!technicalDetails.metaTags.hasOgTags) {
      recommendations.push({
        priority: "medium",
        title: "Add Open Graph Tags",
        description:
          "Implement Open Graph meta tags to control how your content appears on social media.",
        impact: "Better social media sharing and potential traffic increase",
      });
    }

    if (technicalDetails.links.internal < 5) {
      recommendations.push({
        priority: "medium",
        title: "Optimize Internal Linking",
        description: `You have ${technicalDetails.links.internal} internal links. Add more contextual internal links to related pages.`,
        impact: "Better page authority distribution and user navigation",
      });
    }

    // Issue-specific recommendations
    const criticalIssues = issues.filter((i) => i.type === "critical");
    if (criticalIssues.length > 0) {
      recommendations.unshift({
        priority: "high",
        title: "Fix Critical SEO Issues",
        description: `Address ${
          criticalIssues.length
        } critical issues: ${criticalIssues
          .map((i) => i.title)
          .join(", ")}`,
        impact: "Significant improvement in search engine rankings",
      });
    }

    if (
      technicalDetails.images.total > 0 &&
      technicalDetails.images.withoutAlt > 0
    ) {
      recommendations.push({
        priority: "medium",
        title: "Optimize Image SEO",
        description:
          "Add descriptive alt text to all images and optimize image file sizes for faster loading.",
        impact: "Better accessibility and image search rankings",
      });
    }

    if (!technicalDetails.mobile.responsive) {
      recommendations.unshift({
        priority: "high",
        title: "Implement Mobile Responsiveness",
        description:
          "Ensure your website works well on all device sizes, especially mobile devices.",
        impact: "Better mobile search rankings and user experience",
      });
    }

    // Performance recommendations
    if (
      technicalDetails.performance.pageSize &&
      technicalDetails.performance.pageSize > 500000
    ) {
      recommendations.push({
        priority: "medium",
        title: "Optimize Page Size",
        description: `Page size is ${Math.round(
          technicalDetails.performance.pageSize / 1024
        )}KB. Consider optimizing images and code.`,
        impact: "Faster loading times and better user experience",
      });
    }

    return recommendations; // Limit to 12 recommendations
  }

  private calculateEnhancedScore(
    issues: SEOIssue[],
    pageSpeedScore: number,
    technicalDetails: TechnicalSEODetails,
    contentAnalysis: ContentAnalysisResult
  ): number {
    let baseScore = 100;

    // Deduct for issues (reduced impact since we have more factors)
    issues.forEach((issue) => {
      switch (issue.type) {
        case "critical":
          baseScore -= 12; // Reduced from 20
          break;
        case "warning":
          baseScore -= 6; // Reduced from 10
          break;
        case "info":
          baseScore -= 2; // Reduced from 5
          break;
      }
    });

    // Content quality weight (35% - most important)
    const contentScore =
      contentAnalysis.qualityScore * 0.3 +
      contentAnalysis.eatScore.overall * 0.25 +
      contentAnalysis.readabilityScore * 0.15 +
      contentAnalysis.userIntentAlignment * 0.15 +
      contentAnalysis.uniquenessScore * 0.15;

    // Technical weight (45%)
    let technicalScore = baseScore;

    // Bonus points for good technical practices
    if (
      technicalDetails.metaTags.hasTitle &&
      technicalDetails.metaTags.titleLength <= 60 &&
      technicalDetails.metaTags.titleLength >= 30
    ) {
      technicalScore += 5;
    }
    if (
      technicalDetails.metaTags.hasDescription &&
      technicalDetails.metaTags.descriptionLength <= 160 &&
      technicalDetails.metaTags.descriptionLength >= 120
    ) {
      technicalScore += 5;
    }
    if (technicalDetails.headings.h1Count === 1) {
      technicalScore += 3;
    }
    if (
      technicalDetails.mobile.responsive &&
      technicalDetails.mobile.viewportMeta
    ) {
      technicalScore += 5;
    }
    if (technicalDetails.schema?.hasStructuredData) {
      technicalScore += 5;
    }
    if (technicalDetails.metaTags.hasOgTags) {
      technicalScore += 3;
    }
    if (
      technicalDetails.images.withoutAlt === 0 &&
      technicalDetails.images.total > 0
    ) {
      technicalScore += 3;
    }

    // Page speed weight (20%)
    const speedScore = pageSpeedScore;

    // Combine all scores with weights
    const finalScore =
      contentScore * 0.35 + technicalScore * 0.45 + speedScore * 0.2;

    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  async performAutoFix(
    websiteId: string,
    issueType: string
  ): Promise<{ success: boolean; message: string }> {
    throw new Error(
      "Auto-fix feature requires WordPress REST API integration or direct CMS access, which is not currently implemented."
    );
  }
}

export const seoService = new EnhancedSEOService();



