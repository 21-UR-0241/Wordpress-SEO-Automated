
//client/src/lib/api.ts
import { apiRequest } from "./queryClient";

// Complete user-scoped API client
export const api = {

  getContentById: (contentId: string) => 
  fetch(`/api/user/content/${contentId}`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch content details');
    return res.json();
  }),

  changePassword: (data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  console.log("🔐 Changing user password");
  return fetch("/api/auth/change-password", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }).then(res => {
    if (!res.ok) {
      return res.json().then(error => {
        throw new Error(error.message || 'Failed to change password');
      });
    }
    return res.json();
  });
},


  fixWithAI: async (websiteId: string, dryRun: boolean = false, options?: {
    fixTypes?: string[];
    maxChanges?: number;
    skipBackup?: boolean;
  }) => {
    const response = await fetch(`/api/user/websites/${websiteId}/ai-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dryRun,
        ...options 
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'AI fix failed' }));
      throw new Error(error.message || 'Failed to apply AI fixes');
    }
    
    return response.json();
  },

  // MOVED: Iterative AI fix method (was incorrectly in seoHelpers)
  iterativeFixWithAI: async (websiteId: string, options?: {
    targetScore?: number;
    maxIterations?: number;
    minImprovementThreshold?: number;
    fixTypes?: string[];
    maxChangesPerIteration?: number;
    skipBackup?: boolean;
  }) => {
    const response = await fetch(`/api/user/websites/${websiteId}/iterative-ai-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {})
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Iterative AI fix failed' }));
      throw new Error(error.message || 'Failed to complete iterative AI fixes');
    }
    
    return response.json();
  },

  // Get available AI fix types
  getAvailableAIFixes: async (websiteId: string) => {
    const response = await fetch(`/api/user/websites/${websiteId}/available-fixes`);
    if (!response.ok) throw new Error('Failed to get available fixes');
    return response.json();
  },

  // Authentication
  getCurrentUser: () => fetch("/api/auth/me").then(res => {
    if (!res.ok) throw new Error('Authentication required');
    return res.json();
  }),
  
  // User-scoped websites
  getWebsites: () => fetch("/api/user/websites").then(res => {
    if (!res.ok) throw new Error('Failed to fetch websites');
    return res.json();
  }),
  
  getWebsite: (id: string) => fetch(`/api/user/websites/${id}`).then(res => {
    if (!res.ok) throw new Error('Website not found or access denied');
    return res.json();
  }),
  
  createWebsite: (data: {
    name: string;
    url: string;
    wpApplicationName: string;
    wpApplicationPassword: string;
    wpUsername?: string;
    aiModel?: string;
    brandVoice?: string;
    targetAudience?: string;
    autoPosting?: boolean;
    requireApproval?: boolean;
    contentGuidelines?: string;
  }) => {
    console.log("🚀 Creating website with data:", data);
    return apiRequest("POST", "/api/user/websites", data);
  },
  
  updateWebsite: (id: string, data: any) => apiRequest("PUT", `/api/user/websites/${id}`, data),
  
  deleteWebsite: (id: string) => apiRequest("DELETE", `/api/user/websites/${id}`),

  // Website ownership validation
  validateWebsiteOwnership: async (websiteId: string): Promise<void> => {
    const response = await fetch(`/api/user/websites/${websiteId}/validate-ownership`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Website access denied - not owned by current user');
    }
  },

  
  // User-scoped content
  getWebsiteContent: (websiteId: string) => 
    fetch(`/api/user/websites/${websiteId}/content`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch content or access denied');
      return res.json();
    }),
  
generateContent: (data: {
  websiteId: string;
  topic: string;
  keywords?: string[];
  tone?: string;
  wordCount?: number;
  brandVoice?: string;
  targetAudience?: string;
  eatCompliance?: boolean;
  aiProvider?: 'openai' | 'anthropic' | 'gemini'; // Updated to include gemini
}) => {
  console.log("🤖 Generating content with data:", data);
  return apiRequest("POST", "/api/user/content/generate", data);
},
  
updateContent: (id: string, data: {
  title?: string;
  body?: string;
  excerpt?: string;
  metaDescription?: string;
  metaTitle?: string;
  websiteId?: string;
  tone?: string;
  brandVoice?: string;
  targetAudience?: string;
  eatCompliance?: boolean;
  aiProvider?: 'openai' | 'anthropic' | 'gemini'; // Updated to include gemini
}) => apiRequest("PUT", `/api/user/content/${id}`, data),
  
  publishContent: (id: string) => apiRequest("POST", `/api/user/content/${id}/publish`),

  // User-scoped SEO
  getSeoReports: (websiteId: string) => 
    fetch(`/api/user/websites/${websiteId}/seo-reports`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch SEO reports or access denied');
      return res.json();
    }),
  
  runSeoAnalysis: (websiteId: string, data?: { targetKeywords?: string[] }) => 
    fetch(`/api/user/websites/${websiteId}/seo-analysis`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    }).then(res => {
      if (!res.ok) throw new Error('Failed to run SEO analysis or access denied');
      return res.json();
    }),

  // Global endpoints (no user scoping needed)
  getSeoHealth: () => fetch('/api/seo/health').then(res => {
    if (!res.ok) throw new Error('Failed to check SEO service health');
    return res.json();
  }),

  getAiProviderStatus: () => fetch('/api/ai-providers/status').then(res => {
    if (!res.ok) throw new Error('Failed to check AI provider status');
    return res.json();
  }),

  // User-scoped dashboard
  getDashboardStats: () => fetch("/api/user/dashboard/stats").then(res => {
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  }),
  
  getPerformanceData: () => fetch("/api/user/dashboard/performance").then(res => {
    if (!res.ok) throw new Error('Failed to fetch performance data');
    return res.json();
  }),

  // User-scoped activity logs
  getActivityLogs: (websiteId?: string) => {
    const url = websiteId ? 
      `/api/user/activity-logs?websiteId=${websiteId}` : 
      "/api/user/activity-logs";
    return fetch(url).then(res => {
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    });
  },

  // URL validation (global utility)
  validateUrl: async (url: string) => {
    try {
      const response = await fetch('/api/validate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      return response.json();
    } catch (error) {
      return {
        valid: false,
        error: 'URL validation failed',
        message: error.message
      };
    }
  },

  // Helper method to validate iterative fix options
  validateIterativeFixOptions: (options: {
    targetScore?: number;
    maxIterations?: number;
    minImprovementThreshold?: number;
  }): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (options.targetScore !== undefined) {
      if (options.targetScore < 50 || options.targetScore > 100) {
        errors.push('Target score must be between 50 and 100');
      }
    }
    
    if (options.maxIterations !== undefined) {
      if (options.maxIterations < 1 || options.maxIterations > 10) {
        errors.push('Max iterations must be between 1 and 10');
      }
    }
    
    if (options.minImprovementThreshold !== undefined) {
      if (options.minImprovementThreshold < 0.5 || options.minImprovementThreshold > 10) {
        errors.push('Min improvement threshold must be between 0.5 and 10');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Method to get iterative fix recommendations
  getIterativeFixRecommendations: async (websiteId: string) => {
    const [website, reports, availableFixes] = await Promise.all([
      api.getWebsite(websiteId),
      api.getSeoReports(websiteId),
      api.getAvailableAIFixes(websiteId)
    ]);
    
    const currentScore = reports[0]?.score || 0;
    
    // Determine recommended target score based on current score
    let recommendedTarget = 85;
    if (currentScore >= 80) recommendedTarget = 95;
    else if (currentScore >= 60) recommendedTarget = 85;
    else if (currentScore >= 40) recommendedTarget = 70;
    else recommendedTarget = 60;
    
    // Estimate iterations needed
    const averageImprovementPerIteration = 8; // Based on typical improvements
    const pointsNeeded = Math.max(0, recommendedTarget - currentScore);
    const estimatedIterations = Math.min(5, Math.ceil(pointsNeeded / averageImprovementPerIteration));
    
    return {
      websiteId,
      websiteName: website.name,
      currentScore,
      recommendedTarget,
      estimatedIterations,
      availableFixTypes: availableFixes.availableFixes || [],
      totalFixableIssues: availableFixes.totalFixableIssues || 0,
      estimatedTime: estimatedIterations > 0 ? 
        `${estimatedIterations * 8}-${estimatedIterations * 12} minutes` : '0 minutes',
      difficulty: currentScore < 40 ? 'high' : currentScore < 70 ? 'medium' : 'low',
      priority: currentScore < 50 ? 'critical' : currentScore < 75 ? 'high' : 'medium'
    };
  },

  // Batch operations
  batchAnalyzeSites: async (websiteIds: string[], options?: {
    includeContentAnalysis?: boolean;
    targetKeywords?: string[];
  }) => {
    const analyses = await Promise.allSettled(
      websiteIds.map(id => api.runSeoAnalysis(id, options))
    );
    
    return analyses.map((result, index) => ({
      websiteId: websiteIds[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  },

  // SEO comparison across user's websites
  compareSeoScores: async (websiteIds: string[]) => {
    const reports = await Promise.all(
      websiteIds.map(async (id) => {
        try {
          const [reports, website] = await Promise.all([
            api.getSeoReports(id),
            api.getWebsite(id)
          ]);
          return {
            websiteId: id,
            websiteName: website.name,
            websiteUrl: website.url,
            latestScore: reports[0]?.score || 0,
            latestAnalysis: reports[0]?.createdAt || null,
            hasAiAnalysis: reports[0]?.metadata?.aiAnalysisPerformed || false
          };
        } catch (error) {
          return {
            websiteId: id,
            error: error.message
          };
        }
      })
    );
    
    return reports;
  },

  // SEO trend analysis for user's websites
  getSeoTrends: async (websiteId: string, days: number = 30) => {
    const reports = await api.getSeoReports(websiteId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentReports = reports.filter(report => 
      new Date(report.createdAt) >= cutoffDate
    );
    
    return {
      websiteId,
      period: `${days} days`,
      totalAnalyses: recentReports.length,
      scoreHistory: recentReports.map(report => ({
        date: report.createdAt,
        score: report.score,
        pageSpeedScore: report.pageSpeedScore,
        issuesCount: report.issues?.length || 0,
        hasAiAnalysis: report.metadata?.aiAnalysisPerformed || false
      })),
      averageScore: recentReports.length > 0 ? 
        Math.round(recentReports.reduce((sum, r) => sum + r.score, 0) / recentReports.length) : 0,
      scoreImprovement: recentReports.length >= 2 ? 
        recentReports[0].score - recentReports[recentReports.length - 1].score : 0
    };
  },

  getClientReports: (websiteId?: string) => {
    const url = websiteId ? 
      `/api/user/websites/${websiteId}/reports` : 
      "/api/user/reports";
    console.log(`Fetching reports from: ${url}`);
    return fetch(url).then(res => {
      console.log(`Reports response status: ${res.status}`);
      if (!res.ok) {
        console.error(`Failed to fetch reports: ${res.status} ${res.statusText}`);
        throw new Error('Failed to fetch client reports');
      }
      return res.json();
    }).then(data => {
      console.log(`Fetched ${data.length} reports`);
      return data;
    });
  },






  



//nadagdag
// Modify your existing api.generateClientReport function:
generateClientReport: async (
  websiteId: string, 
  data: { 
    reportType: 'weekly' | 'monthly' | 'quarterly',
    reportId?: string | number  // Add this optional parameter
  }
) => {
  const response = await fetch('/api/user/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      websiteId, 
      ...data 
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate report');
  }
  
  return response.json();
},



  generateBulkReports: async (websiteIds: string[], reportType: 'weekly' | 'monthly' | 'quarterly' = 'monthly') => {
    console.log(`Generating bulk reports for ${websiteIds.length} websites`);
    
    const reports = await Promise.allSettled(
      websiteIds.map(id => api.generateClientReport(id, { reportType }))
    );
    
    return reports.map((result, index) => ({
      websiteId: websiteIds[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  },


  // ===============================
// CONTENT SCHEDULING METHODS (Updated for Existing Content)
// ===============================

// Get scheduled content for a specific website
getContentSchedule: (websiteId: string) => 
  fetch(`/api/user/websites/${websiteId}/content-schedule`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch content schedule');
    return res.json();
  }),

// Get all scheduled content for user (across all websites)
getAllScheduledContent: () => 
  fetch('/api/user/content-schedule').then(res => {
    if (!res.ok) throw new Error('Failed to fetch scheduled content');
    return res.json();
  }),

// Schedule existing content for publication
scheduleExistingContent: (websiteId: string, data: {
  contentId: string;
  scheduledDate: string;
}) => {
  console.log("📅 Scheduling existing content:", data);
  return fetch(`/api/user/websites/${websiteId}/schedule-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => {
    if (!res.ok) throw new Error('Failed to schedule content');
    return res.json();
  });
},

// Update scheduled content
updateScheduledContent: (websiteId: string, scheduleId: string, data: {
  scheduledDate?: string;
  status?: string;
}) => {
  console.log("✏️ Updating scheduled content:", { scheduleId, data });
  return fetch(`/api/user/websites/${websiteId}/content-schedule/${scheduleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => {
    if (!res.ok) throw new Error('Failed to update scheduled content');
    return res.json();
  });
},

// Delete scheduled content (unschedule)
deleteScheduledContent: (websiteId: string, scheduleId: string) => {
  console.log("🗑️ Unscheduling content:", scheduleId);
  return fetch(`/api/user/websites/${websiteId}/content-schedule/${scheduleId}`, {
    method: 'DELETE'
  }).then(res => {
    if (!res.ok) throw new Error('Failed to unschedule content');
  });
},

// Get unpublished content available for scheduling
getAvailableContentForScheduling: (websiteId: string) => 
  fetch(`/api/user/websites/${websiteId}/content`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch content');
    return res.json();
  }).then(content => 
    content.filter((c: any) => c.status === 'ready' || c.status === 'pending_approval')
  ),

// Bulk schedule multiple content pieces
batchScheduleContent: async (websiteId: string, schedules: Array<{
  contentId: string;
  scheduledDate: string;
}>) => {
  console.log(`📅 Batch scheduling ${schedules.length} content pieces`);
  
  const results = await Promise.allSettled(
    schedules.map(schedule => api.scheduleExistingContent(websiteId, schedule))
  );
  
  return results.map((result, index) => ({
    schedule: schedules[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason.message : null
  }));
},

// Get scheduled content statistics
getScheduleStats: async (websiteId?: string) => {
  try {
    const scheduledContent = websiteId 
      ? await api.getContentSchedule(websiteId)
      : await api.getAllScheduledContent();
    
    const now = new Date();
    const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const scheduled = scheduledContent.filter((c: any) => c.status === 'scheduled');
    const published = scheduledContent.filter((c: any) => c.status === 'published');
    const overdue = scheduled.filter((c: any) => new Date(c.scheduledDate) <= now);
    const upcoming = scheduled.filter((c: any) => 
      new Date(c.scheduledDate) <= thisWeek && new Date(c.scheduledDate) > now
    );
    const thisMonthCount = scheduled.filter((c: any) => {
      const scheduleDate = new Date(c.scheduledDate);
      return scheduleDate.getMonth() === now.getMonth() && 
             scheduleDate.getFullYear() === now.getFullYear();
    });
    
    return {
      total: scheduledContent.length,
      scheduled: scheduled.length,
      published: published.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      thisMonth: thisMonthCount.length,
      nextScheduled: scheduled.length > 0 
        ? scheduled.sort((a: any, b: any) => 
            new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
          )[0]
        : null
    };
  } catch (error) {
    console.error('Failed to get schedule stats:', error);
    return {
      total: 0, scheduled: 0, published: 0, overdue: 0, 
      upcoming: 0, thisMonth: 0, nextScheduled: null
    };
  }
},

// Check if content is already scheduled
isContentScheduled: async (contentId: string) => {
  try {
    // This would need a new endpoint, or you can check in the frontend
    const allScheduled = await api.getAllScheduledContent();
    return allScheduled.some((s: any) => 
      s.contentId === contentId && (s.status === 'scheduled' || s.status === 'publishing')
    );
  } catch (error) {
    console.error('Failed to check if content is scheduled:', error);
    return false;
  }
},

// Quick schedule content for immediate publication
scheduleContentForNow: (websiteId: string, contentId: string) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1); // Schedule for 1 minute from now
  
  return api.scheduleExistingContent(websiteId, {
    contentId,
    scheduledDate: now.toISOString()
  });
},

// Reschedule content to a new date
rescheduleContent: (websiteId: string, scheduleId: string, newDate: string) => {
  return api.updateScheduledContent(websiteId, scheduleId, {
    scheduledDate: newDate
  });
},

// Cancel scheduled content (mark as cancelled)
cancelScheduledContent: (websiteId: string, scheduleId: string) => {
  return api.updateScheduledContent(websiteId, scheduleId, {
    status: 'cancelled'
  });
},

// Get scheduling dashboard data
getSchedulingDashboard: async () => {
  try {
    const [scheduledContent, websites] = await Promise.all([
      api.getAllScheduledContent(),
      api.getWebsites()
    ]);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const todayScheduled = scheduledContent.filter((c: any) => {
      const scheduleDate = new Date(c.scheduledDate);
      return scheduleDate >= today && scheduleDate < tomorrow && c.status === 'scheduled';
    });
    
    const weekScheduled = scheduledContent.filter((c: any) => {
      const scheduleDate = new Date(c.scheduledDate);
      return scheduleDate >= today && scheduleDate <= nextWeek && c.status === 'scheduled';
    });
    
    const overdue = scheduledContent.filter((c: any) => 
      new Date(c.scheduledDate) < now && c.status === 'scheduled'
    );
    
    const recentlyPublished = scheduledContent.filter((c: any) => {
      const publishDate = new Date(c.publishedAt || c.scheduledDate);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return publishDate >= weekAgo && c.status === 'published';
    });
    
    return {
      stats: {
        todayCount: todayScheduled.length,
        weekCount: weekScheduled.length,
        overdueCount: overdue.length,
        recentlyPublishedCount: recentlyPublished.length,
        totalActiveSchedules: scheduledContent.filter((c: any) => c.status === 'scheduled').length
      },
      upcomingToday: todayScheduled,
      upcomingWeek: weekScheduled.slice(0, 10), // Limit to 10 items
      overdueItems: overdue,
      websiteStats: websites?.map((website: any) => {
        const websiteSchedules = scheduledContent.filter((c: any) => c.websiteId === website.id);
        return {
          websiteId: website.id,
          websiteName: website.name,
          scheduledCount: websiteSchedules.filter((c: any) => c.status === 'scheduled').length,
          publishedCount: websiteSchedules.filter((c: any) => c.status === 'published').length,
          overdueCount: websiteSchedules.filter((c: any) => 
            new Date(c.scheduledDate) < now && c.status === 'scheduled'
          ).length
        };
      }) || []
    };
  } catch (error) {
    console.error('Failed to get scheduling dashboard:', error);
    return {
      stats: {
        todayCount: 0,
        weekCount: 0,
        overdueCount: 0,
        recentlyPublishedCount: 0,
        totalActiveSchedules: 0
      },
      upcomingToday: [],
      upcomingWeek: [],
      overdueItems: [],
      websiteStats: []
    };
  }
},

// In your api object, temporarily replace uploadImages:
uploadImages: async (files, websiteId, contentId) => {
  console.log("Mock upload - files:", files);
  
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create mock response with data URLs for immediate display
  const mockImages = await Promise.all(
    Array.from(files).map(async (file, index) => {
      // Read file as data URL for preview
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      
      return {
        id: `temp_${Date.now()}_${index}`,
        url: dataUrl,
        altText: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        filename: file.name,
        size: file.size
      };
    })
  );
  
  return { 
    success: true,
    images: mockImages,
    message: "Mock upload - implement backend endpoint"
  };
},

getUserImages: (filters?: {
  websiteId?: string;
  contentId?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.websiteId) params.append('websiteId', filters.websiteId);
  if (filters?.contentId) params.append('contentId', filters.contentId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());
  
  return fetch(`/api/user/content/images?${params}`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch images');
    return res.json();
  });
},

replaceContentImage: (contentId: string, oldImageUrl: string, newImageUrl: string, newAltText: string) => {
  return fetch('/api/user/content/replace-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      oldImageUrl,
      newImageUrl,
      newAltText
    })
  }).then(res => {
    if (!res.ok) throw new Error('Failed to replace image');
    return res.json();
  });
}



};

// SEO helpers
export const seoHelpers = {
  getScoreCategory: (score: number): 'excellent' | 'good' | 'needs-improvement' | 'critical' => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'needs-improvement';
    return 'critical';
  },

  getScoreColor: (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  },

  prioritizeIssues: (issues: any[]): any[] => {
    const priority = { critical: 3, warning: 2, info: 1 };
    return issues.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));
  },

  calculateProgress: (current: number, previous: number): {
    change: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  } => {
    const change = current - previous;
    const percentage = previous > 0 ? (change / previous) * 100 : 0;
    
    return {
      change,
      percentage: Math.abs(percentage),
      trend: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down'
    };
  },
};






export default api;