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
// Helpers (LOCAL time bucketing + labeling)
// ────────────────────────────────────────────────────────────

/** Round a Date to the start of its hour in a specific TZ and return a stable key + numeric ts. */
const getHourBucket = (input: string | number | Date, tz = TZ) => {
  const d =
    typeof input === "number" && input < 1e12 ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(d.getTime())) return { key: "", ts: NaN };

  // Build parts in TZ
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  const y = parts.year;
  const m = parts.month;
  const day = parts.day;
  const hour = parts.hour;

  // Hour bucket key (YYYY-MM-DDTHH)
  const key = `${y}-${m}-${day}T${hour}`;

  // Create a timestamp representing local hour start.
  // NOTE: This uses the browser's local zone to build the Date object;
  // for strict Manila alignment regardless of client TZ, we compute via Date.UTC
  // then offset using the reported TZ hours. For simplicity we parse to a Date first:
  const ts = new Date(`${y}-${m}-${day}T${hour}:00:00`).getTime();

  return { key, ts };
};

/** Format an hour bucket label like "Sep 18, 16:00" in TZ */
const formatHourLabel = (ts: number, tz = TZ) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ts);

// ────────────────────────────────────────────────────────────

export default function PerformanceChart({ stats, isLoading }: PerformanceChartProps) {
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
    queryKey: ["seo-reports-chart-data", stats?.avgSeoScore],
    queryFn: async () => {
      const websites = await api.getWebsites();

      // hourKey -> aggregated row for that hour across sites
      const byHour = new Map<
        string,
        {
          ts: number;              // numeric timestamp (hour start)
          label: string;           // "Sep 18, 16:00"
          metadata?: Record<
            string,
            {
              score: number;
              pageSpeedScore?: number;
              issuesCount?: number;
              criticalIssues?: number;
              reportId?: string;
              createdAt?: string;
              isSynthetic?: boolean;
            }
          >;
          // dynamic site score fields: row[siteName] = score
        } & Record<string, any>
      >();

      const websiteInfo: Array<{
        id: string;
        name: string;
        color: string;
        latestScore: number;
        reportCount: number;
        error?: boolean;
      }> = [];

      let totalReports = 0;

      for (let i = 0; i < websites.length; i++) {
        const website = websites[i];

        try {
          const reports = await api.getSeoReports(website.id);

          if (reports && reports.length > 0) {
            totalReports += reports.length;

            // Sort newest first just for "latestScore" derivation
            const sortedReports = [...reports].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            const latestReport = sortedReports[0];
            let latestScore = latestReport?.score || 0;

            // Optional: patch a synthetic "now" point if dashboard avg differs
            let syntheticInserted = false;
            if (stats?.avgSeoScore && Math.abs(stats.avgSeoScore - latestScore) > 0.1) {
              const synthetic = {
                id: "synthetic-latest",
                score: stats.avgSeoScore,
                createdAt: new Date().toISOString(),
                pageSpeedScore: latestReport?.pageSpeedScore,
                fixableIssuesCount: latestReport?.fixableIssuesCount || 0,
                criticalIssuesCount: latestReport?.criticalIssuesCount || 0,
              };
              reports.push(synthetic);
              latestScore = stats.avgSeoScore;
              syntheticInserted = true;
            }

            // Legend/info
            websiteInfo.push({
              id: website.id,
              name: website.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
              latestScore,
              reportCount: reports.length - (syntheticInserted ? 1 : 0),
            });

            // Fill rows per hour (no day dedupe)
            for (const report of reports) {
              const { key: hourKey, ts } = getHourBucket(report.createdAt, TZ);
              if (!hourKey) continue;

              if (!byHour.has(hourKey)) {
                byHour.set(hourKey, {
                  ts,
                  label: formatHourLabel(ts, TZ),
                });
              }
              const row = byHour.get(hourKey)!;

              const score = report.score || 0;
              row[website.name] = score;

              if (!row.metadata) row.metadata = {};
              row.metadata[website.name] = {
                score,
                pageSpeedScore: report.pageSpeedScore,
                issuesCount: report.fixableIssuesCount || 0,
                criticalIssues: report.criticalIssuesCount || 0,
                reportId: report.id,
                createdAt: report.createdAt,
                isSynthetic: report.id === "synthetic-latest",
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

      // To a sorted array by ts
      const rows = Array.from(byHour.values()).sort((a, b) => a.ts - b.ts);

      // Keep last N hours (e.g., ~10 days = 240 hours); adjust as needed
      const recent = rows.slice(-240);

      return {
        data: recent,
        websites: websiteInfo,
        hasData: recent.length > 0,
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

  // Tooltip uses the hour label and site-specific metadata
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
                    {siteMetadata?.isSynthetic && (
                      <span className="text-xs text-amber-600 ml-2">(synced)</span>
                    )}
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
          <CardTitle>SEO Performance Trend</CardTitle>
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
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={chartData.data}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* Numeric time axis (per-hour ts) */}
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => formatHourLabel(v as number, TZ)}
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
                labelFormatter={(v) => formatHourLabel(v as number, TZ)}
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
