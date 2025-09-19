
//client/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Globe, Bot, Search, Calendar, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/pages/authentication"; // Import useAuth (NOT useAuthContext)
import StatsCard from "@/components/dashboard/stats-card";
import PerformanceChart from "@/components/dashboard/performance-chart";
import RecentActivity from "@/components/dashboard/recent-activity";
import WebsitesTable from "@/components/dashboard/websites-table";
import ContentQueue from "@/components/dashboard/content-queue";
import SEOIssues from "@/components/dashboard/seo-issues";
import ClientReports from "@/components/dashboard/client-reports";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"], // Simple key, no user ID needed
    queryFn: api.getDashboardStats,
    enabled: isAuthenticated, // Only when logged in
  });

  // Calculate SEO score percentage change
  const seoScoreChange =
    stats?.avgSeoScore && stats?.previousAvgSeoScore
      ? calculatePercentageChange(stats.avgSeoScore, stats.previousAvgSeoScore)
      : { percentage: " ", type: "neutral" as const };

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
  const finalSeoChange = stats?.previousAvgSeoScore
    ? seoScoreChange
    : calculateSeoChangeFromHistory();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

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
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <StatsCard
            title="Active Websites"
            value={statsLoading ? "..." : stats?.websiteCount || 0}
            icon={Globe}
            iconColor="bg-blue-500"
          />
          <StatsCard
            title="Content Generated"
            value={statsLoading ? "..." : stats?.contentCount || 0}
            icon={Bot}
            iconColor="bg-green-500"
          />
          <StatsCard
            title="Avg SEO Score"
            value={
              statsLoading ? "..." : formatSeoScore(stats?.avgSeoScore || 0)
            }
            icon={Search}
            iconColor="bg-yellow-500"
            change={statsLoading ? "..." : finalSeoChange.percentage}
            changeType={finalSeoChange.type}
          />
          <StatsCard
            title="Scheduled Posts"
            value={statsLoading ? "..." : stats?.scheduledPosts || 0}
            icon={Calendar}
            iconColor="bg-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         <div className="lg:col-span-2">
            <PerformanceChart stats={stats} isLoading={statsLoading} />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>

        <div className="mb-8">
          <WebsitesTable />
        </div>

        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ContentQueue />
          <SEOIssues />
        </div> */}

        {/* <ClientReports /> */}
      </div>
    </div>
  );
}
