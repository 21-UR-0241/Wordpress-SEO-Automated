"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { useEffect } from "react";

interface PerformanceChartProps {
  stats?: any;
  isLoading?: boolean;
  selectedWebsite?: string | null;
}

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────

const TZ = "Asia/Manila";
const LINE_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

// ────────────────────────────────────────────────────────────
// Helpers (Use exact timestamp instead of hour bucketing)
// ────────────────────────────────────────────────────────────

/** Format timestamp label like "Sep 18, 16:00" in TZ */
const formatTimeLabel = (dateStr: string | Date, tz = TZ) => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

// ────────────────────────────────────────────────────────────

export default function PerformanceChart({ stats, isLoading, selectedWebsite }: PerformanceChartProps) {
  const queryClient = useQueryClient();

  // If external stats changed (e.g., a new analysis), invalidate to refresh.
  useEffect(() => {
    if (stats?.lastAnalysis) {
      queryClient.invalidateQueries({ queryKey: ["seo-reports-chart-data"] });
    }
  }, [stats?.lastAnalysis, queryClient]);

  const {
    data: chartData,
    isLoading: chartLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["seo-reports-chart-data", stats?.avgSeoScore, selectedWebsite],
    queryFn: async () => {
      const websites = await api.getWebsites();
      
      // Filter websites based on selectedWebsite prop from dashboard
      const filteredWebsites = selectedWebsite && selectedWebsite !== "all"
        ? websites.filter((w: any) => w.id === selectedWebsite)
        : websites;

      // Store all data points with exact timestamps
      const allDataPoints: Array<{
        ts: number;
        label: string;
        reportId: string;
        metadata?: Record<string, any>;
        [key: string]: any;
      }> = [];

      const websiteInfo: Array<{
        id: string;
        name: string;
        color: string;
        latestScore: number;
        reportCount: number;
        error?: boolean;
      }> = [];

      let totalReports = 0;

      for (let i = 0; i < filteredWebsites.length; i++) {
        const website = filteredWebsites[i];

        try {
          const reports = await api.getSeoReports(website.id);

          if (reports && reports.length > 0) {
            totalReports += reports.length;

            // Sort by date to get chronological order
            const sortedReports = [...reports].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Latest report is the last one chronologically
            const latestReport = sortedReports[sortedReports.length - 1];
            let latestScore = latestReport?.score || 0;

            // Legend/info
            websiteInfo.push({
              id: website.id,
              name: website.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
              latestScore,
              reportCount: reports.length,
            });

            // Create a data point for each report with exact timestamp
            for (const report of sortedReports) {
              const ts = new Date(report.createdAt).getTime();
              
              // Find existing data point with same timestamp or create new one
              let dataPoint = allDataPoints.find(dp => dp.ts === ts);
              
              if (!dataPoint) {
                dataPoint = {
                  ts,
                  label: formatTimeLabel(report.createdAt, TZ),
                  reportId: report.id,
                };
                allDataPoints.push(dataPoint);
              }
              
              // Add the score for this website
              const score = report.score || 0;
              dataPoint[website.name] = score;
              
              // Add metadata
              if (!dataPoint.metadata) dataPoint.metadata = {};
              dataPoint.metadata[website.name] = {
                score,
                pageSpeedScore: report.pageSpeedScore,
                issuesCount: report.fixableIssuesCount || 0,
                criticalIssues: report.criticalIssuesCount || 0,
                reportId: report.id,
                createdAt: report.createdAt,
              };
            }
          } else {
            websiteInfo.push({
              id: website.id,
              name: website.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
              latestScore: 0,
              reportCount: 0,
            });
          }
        } catch {
          websiteInfo.push({
            id: website.id,
            name: website.name,
            color: LINE_COLORS[i % LINE_COLORS.length],
            latestScore: 0,
            reportCount: 0,
            error: true,
          });
        }
      }

      // Sort all data points by timestamp
      const sortedData = allDataPoints.sort((a, b) => a.ts - b.ts);

      // Keep recent data points (last 100 or so)
      const recentData = sortedData.slice(-100);

      return {
        data: recentData,
        websites: websiteInfo,
        hasData: recentData.length > 0,
        totalReports,
        lastFetch: new Date().toISOString(),
      };
    },
    enabled: !isLoading,
    refetchInterval: 30000,
    staleTime: 5000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const loading = isLoading || chartLoading;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["seo-reports-chart-data"] });
    refetch();
  };

  if (loading && !isFetching) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SEO Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Tooltip uses the exact timestamp label and site-specific metadata
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload;
      const metadata = row?.metadata;

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-sm mb-2">{row?.label}</p>
          {payload.map((entry: any) => {
            const siteMetadata = metadata?.[entry.name];
            return (
              <div key={entry.name} className="mb-2 pb-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-medium text-sm">{entry.name}</span>
                </div>
                <div className="ml-5 mt-1 space-y-0.5">
                  <div className="text-sm">
                    <span className="text-gray-600">SEO Score:</span>
                    <span className="font-bold ml-1">
                      {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
                    </span>
                  </div>
                  {siteMetadata && (
                    <>
                      {siteMetadata.pageSpeedScore && (
                        <div className="text-xs text-gray-600">
                          Page Speed: {siteMetadata.pageSpeedScore}
                        </div>
                      )}
                      {siteMetadata.criticalIssues > 0 && (
                        <div className="text-xs text-red-600">
                          Critical Issues: {siteMetadata.criticalIssues}
                        </div>
                      )}
                      {siteMetadata.issuesCount > 0 && (
                        <div className="text-xs text-yellow-600">
                          Fixable Issues: {siteMetadata.issuesCount}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            SEO Performance Trend
            {selectedWebsite && selectedWebsite !== "all" && chartData?.websites?.length === 1 && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                - {chartData.websites[0].name}
              </span>
            )}
          </CardTitle>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh chart data"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {chartData?.websites && chartData.websites.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-3 text-sm">
              {chartData.websites
                .filter((site: any) => site.reportCount > 0)
                .map((site: any) => (
                  <div key={site.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: site.color }}
                    />
                    <span className="text-gray-600">{site.name}</span>
                    <span className="font-semibold text-gray-900">
                      {typeof site.latestScore === "number"
                        ? site.latestScore.toFixed(1)
                        : "0.0"}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({site.reportCount} reports)
                    </span>
                  </div>
                ))}
            </div>
            {chartData?.lastFetch && (
              <div className="text-xs text-gray-500">
                Last updated: {new Date(chartData.lastFetch).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {chartData?.hasData ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData.data}
                margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => formatTimeLabel(new Date(v), TZ)}
                  tick={{ fontSize: 11 }}
                  tickMargin={10}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fontSize: 12 }}
                  tickMargin={8}
                  label={{
                    value: "SEO Score",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12, fill: "#666" },
                  }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  labelFormatter={(v) => formatTimeLabel(new Date(v), TZ)}
                />
                <Legend />

                {chartData.websites
                  .filter((site: any) => site.reportCount > 0)
                  .map((site: any) => (
                    <Line
                      key={site.id}
                      type="monotone"
                      dataKey={site.name}
                      stroke={site.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: site.color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
            
            {/* Latest Performance vs Historical Average */}
            {chartData?.websites && chartData.websites.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  {/* Latest Performance */}
                  <div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Latest Performance</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(() => {
                        const activeWebsites = chartData.websites.filter((s: any) => s.reportCount > 0);
                        if (activeWebsites.length === 0) return "0.0";
                        
                        // For single website, show its latest score
                        if (activeWebsites.length === 1) {
                          return activeWebsites[0].latestScore.toFixed(1);
                        }
                        
                        // For multiple websites, show average of latest scores
                        const avgLatest = activeWebsites.reduce((sum: number, w: any) => 
                          sum + w.latestScore, 0) / activeWebsites.length;
                        return avgLatest.toFixed(1);
                      })()}
                      <span className="text-sm text-gray-500 ml-1">/ 100</span>
                    </div>
                  </div>
                  
                  {/* Historical Average */}
                  <div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Historical Average</span>
                      <span className="text-xs text-gray-500 ml-2">
                        (All-time)
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(() => {
                        const activeWebsites = chartData.websites.filter((s: any) => s.reportCount > 0);
                        if (activeWebsites.length === 0) return "0.0";
                        
                        // Calculate average based on ALL historical scores
                        let totalScoreSum = 0;
                        let totalScoreCount = 0;
                        
                        for (const website of activeWebsites) {
                          for (const dataPoint of chartData.data) {
                            const score = dataPoint[website.name];
                            if (score !== undefined && score !== null) {
                              totalScoreSum += score;
                              totalScoreCount++;
                            }
                          }
                        }
                        
                        if (totalScoreCount === 0) return "0.0";
                        const overallAverage = totalScoreSum / totalScoreCount;
                        
                        return overallAverage.toFixed(1);
                      })()}
                      <span className="text-sm text-gray-500 ml-1">/ 100</span>
                    </div>
                  </div>
                </div>
                
                {/* Show breakdown by website if multiple */}
                {chartData.websites.filter((s: any) => s.reportCount > 0).length > 1 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium text-gray-500 mb-1">Latest scores by website:</div>
                    {chartData.websites
                      .filter((s: any) => s.reportCount > 0)
                      .map((website: any) => (
                        <div key={website.id} className="flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: website.color }}
                            />
                            <span>{website.name}</span>
                          </div>
                          <span className="font-medium">
                            {website.latestScore.toFixed(1)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-[350px] flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No SEO Reports Found</h3>
              <p className="text-sm text-gray-600">
                Run an SEO analysis to start tracking performance.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}