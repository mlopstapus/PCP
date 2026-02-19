"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Clock,
  AlertTriangle,
  FileText,
  Layers,
  Zap,
} from "lucide-react";
import {
  getDashboardStats,
  type DashboardStats,
} from "@/lib/api";

export default function MetricsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        <p className="text-muted-foreground">Failed to load dashboard stats.</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Prompts",
      value: stats.total_prompts,
      icon: FileText,
    },
    {
      label: "Total Versions",
      value: stats.total_versions,
      icon: Layers,
    },
    {
      label: "Total Expands",
      value: stats.total_expands.toLocaleString(),
      icon: Zap,
    },
    {
      label: "Expands (24h)",
      value: stats.expands_24h.toLocaleString(),
      icon: Activity,
    },
    {
      label: "Avg Latency",
      value: `${stats.avg_latency_ms}ms`,
      icon: Clock,
    },
    {
      label: "Error Rate",
      value: `${stats.error_rate_pct}%`,
      icon: AlertTriangle,
    },
  ];

  const maxDailyCount = Math.max(...stats.daily_usage.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Usage analytics and governance dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold mt-1">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Usage (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.daily_usage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No usage data yet. Expand a prompt to start tracking.
              </p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {stats.daily_usage.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {d.count}
                    </span>
                    <div
                      className="w-full bg-primary rounded-t"
                      style={{
                        height: `${Math.max((d.count / maxDailyCount) * 120, 4)}px`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Prompts (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.top_prompts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No usage data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.top_prompts.map((p, i) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 text-right">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/prompts/${p.name}`}
                        className="hover:underline font-medium"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{p.count.toLocaleString()} calls</span>
                      <span>{p.avg_latency_ms}ms avg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
