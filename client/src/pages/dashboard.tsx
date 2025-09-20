//client/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Globe, Bot, Search, Calendar, TrendingUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/pages/authentication"; // Import useAuth (NOT useAuthContext)
import StatsCard from "@/components/dashboard/stats-card";
import PerformanceChart from "@/components/dashboard/performance-chart";
import RecentActivity from "@/components/dashboard/recent-activity";
import WebsitesTable from "@/components/dashboard/websites-table";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper function to calculate percentage change
const calculatePercentageChange = (
  current: number,
  previous: number
): { percentage: string; type: "positive" | "negative" | "neutral" } => {
  if (!previous || previous === 0) {
    return { percentage: "N/A", type: "neutral" };
  }

  const change = ((current - previous) / previous) * 100;
  const roundedChange = Math.round(change * 10) / 10; // Round to 1 decimal place

  if (roundedChange > 0) {
    return { percentage: `+${roundedChange}%`, type: "positive" };
  } else if (roundedChange < 0) {
    return { percentage: `${roundedChange}%`, type: "negative" };
  } else {
    return { percentage: "0%", type: "neutral" };
  }
};

// Helper function to format SEO score display
const formatSeoScore = (score: number): string => {
  if (!score) return "0";
  return Math.round(score * 10) / 10; // Round to 1 decimal place
};

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);

  // Fetch list of websites
  const { data: websites, isLoading: websitesLoading } = useQuery({
    queryKey: ["websites-list"],
    queryFn: api.getWebsites,
    enabled: isAuthenticated,
    staleTime: 5000,
  });

  // Set default website when websites load
  useEffect(() => {
    if (websites && websites.length > 0 && !selectedWebsite) {
      setSelectedWebsite("all"); // Default to "all websites"
    }
  }, [websites, selectedWebsite]);

  // Fetch stats based on selected website
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["dashboard-stats", selectedWebsite],
    queryFn: async () => {
      if (selectedWebsite === "all" || !selectedWebsite) {
        // Get overall stats for all websites
        const dashboardStats = await api.getDashboardStats();
        return dashboardStats;
      } else {
        // Get stats for specific website - calculate from actual data
        try {
          // Fetch reports for the specific website
          const reports = await api.getSeoReports(selectedWebsite);
          
          // Try to fetch content for the website
          let contents = [];
          try {
            // Check if api has getContentByWebsite method
            if (typeof api.getContentByWebsite === 'function') {
              contents = await api.getContentByWebsite(selectedWebsite);
            } else if (typeof api.getContent === 'function') {
              // Alternative: fetch all content and filter
              const allContent = await api.getContent();
              contents = Array.isArray(allContent) 
                ? allContent.filter((c: any) => c.websiteId === selectedWebsite || c.website_id === selectedWebsite)
                : [];
            } else if (typeof api.getWebsiteContent === 'function') {
              // Another possible API method name
              contents = await api.getWebsiteContent(selectedWebsite);
            }
          } catch (error) {
            contents = [];
          }
          
          // Ensure reports is an array
          const reportsArray = Array.isArray(reports) ? reports : [];
          
          // Calculate stats from reports
          const sortedReports = reportsArray.length > 0
            ? [...reportsArray].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            : [];
          
          const latestScore = sortedReports.length > 0 ? (sortedReports[0].score || 0) : 0;
          
          const avgSeoScore = reportsArray.length > 0
            ? reportsArray.reduce((sum, r) => sum + (r.score || 0), 0) / reportsArray.length
            : 0;
          
          const previousScore = sortedReports.length > 1
            ? (sortedReports[1].score || 0)
            : sortedReports.length === 1
            ? (sortedReports[0].score || 0)
            : 0;
          
          // Calculate scheduled posts (if content has status field)
          const scheduledCount = Array.isArray(contents) 
            ? contents.filter((c: any) => 
                c.status === 'scheduled' || c.isScheduled || c.scheduledAt
              ).length
            : 0;

          const websiteStats = {
            websiteCount: 1,
            contentCount: Array.isArray(contents) ? contents.length : 0,
            avgSeoScore: latestScore || avgSeoScore,
            previousAvgSeoScore: previousScore,
            scheduledPosts: scheduledCount,
            reportCount: reportsArray.length,
          };
          
          return websiteStats;
        } catch (error) {
          console.error('Error fetching website stats:', error);
          // Return empty stats on error
          return {
            websiteCount: 1,
            contentCount: 0,
            avgSeoScore: 0,
            previousAvgSeoScore: 0,
            scheduledPosts: 0,
            reportCount: 0,
          };
        }
      }
    },
    enabled: isAuthenticated && !!selectedWebsite,
    retry: 1,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  // Calculate SEO score percentage change
  const seoScoreChange =
    stats?.avgSeoScore && stats?.previousAvgSeoScore && stats.avgSeoScore > 0
      ? calculatePercentageChange(stats.avgSeoScore, stats.previousAvgSeoScore)
      : { percentage: "N/A", type: "neutral" as const };

  // Alternative calculation if your API returns historical data differently
  const calculateSeoChangeFromHistory = () => {
    if (!stats?.seoScoreHistory || stats.seoScoreHistory.length < 2) {
      return { percentage: "N/A", type: "neutral" as const };
    }

    const currentScore =
      stats.seoScoreHistory[stats.seoScoreHistory.length - 1];
    const previousScore =
      stats.seoScoreHistory[stats.seoScoreHistory.length - 2];

    return calculatePercentageChange(currentScore, previousScore);
  };

  // Use whichever method fits your API structure
  const finalSeoChange = stats?.avgSeoScore > 0 && stats?.previousAvgSeoScore
    ? seoScoreChange
    : calculateSeoChangeFromHistory();

  // Add debug logging
  useEffect(() => {
    if (statsError) {
      console.error('Stats query error:', statsError);
    }
  }, [statsError]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

  const selectedWebsiteName = selectedWebsite === "all" 
    ? "All Websites" 
    : websites?.find(w => w.id === selectedWebsite)?.name || "Select Website";

  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-7 text-gray-900 truncate">
              Dashboard Overview
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitor your WordPress sites and AI-powered SEO optimization
            </p>
          </div>
          {/* Website Selector */}
          {websites && websites.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mt-4 sm:mt-0">
                  <Globe className="h-4 w-4 mr-2" />
                  {selectedWebsiteName}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Select Website</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedWebsite("all")}>
                  <Globe className="h-4 w-4 mr-2" />
                  All Websites
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {websites.map((website: any) => (
                  <DropdownMenuItem
                    key={website.id}
                    onClick={() => setSelectedWebsite(website.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{website.name}</span>
                      {website.url && (
                        <span className="text-xs text-gray-500 ml-2 truncate">
                          {new URL(website.url).hostname}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <StatsCard
            title={selectedWebsite === "all" ? "Active Websites" : "Website Reports"}
            value={
              statsLoading ? "..." : 
              selectedWebsite === "all" 
                ? (stats?.websiteCount || 0) 
                : (stats?.reportCount !== undefined ? stats.reportCount : 0)
            }
            icon={Globe}
            iconColor="bg-blue-500"
          />
          <StatsCard
            title="Content Generated"
            value={statsLoading ? "..." : (stats?.contentCount !== undefined ? stats.contentCount : 0)}
            icon={Bot}
            iconColor="bg-green-500"
          />
          <StatsCard
            title="Current Seo Score"
            value={
              statsLoading ? "..." : 
              stats?.avgSeoScore !== undefined && stats.avgSeoScore > 0
                ? formatSeoScore(stats.avgSeoScore)
                : "0"
            }
            icon={Search}
            iconColor="bg-yellow-500"
            change={
              statsLoading 
                ? "..." 
                : stats?.avgSeoScore > 0 && stats?.previousAvgSeoScore > 0
                  ? finalSeoChange.percentage 
                  : stats?.avgSeoScore > 0 
                    ? "â€”"
                    : ""
            }
            changeType={stats?.avgSeoScore > 0 ? finalSeoChange.type : "neutral"}
          />
          <StatsCard
            title="Scheduled Posts"
            value={statsLoading ? "..." : (stats?.scheduledPosts !== undefined ? stats.scheduledPosts : 0)}
            icon={Calendar}
            iconColor="bg-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         <div className="lg:col-span-2">
            <PerformanceChart 
              stats={stats} 
              isLoading={statsLoading}
              selectedWebsite={selectedWebsite}
            />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>

        <div className="mb-8">
          <WebsitesTable />
        </div>
      </div>
    </div>
  );
}