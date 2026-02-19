"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Layers,
  Plus,
  Zap,
  Activity,
  Clock,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Key,
} from "lucide-react";
import {
  listPrompts,
  getDashboardStats,
  type PromptListResponse,
  type DashboardStats,
} from "@/lib/api";

export default function DashboardPage() {
  const [prompts, setPrompts] = useState<PromptListResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listPrompts(1, 5), getDashboardStats()])
      .then(([p, s]) => {
        setPrompts(p);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = stats
    ? [
        { label: "Prompts", value: stats.total_prompts, icon: FileText },
        { label: "Versions", value: stats.total_versions, icon: Layers },
        { label: "Total Expands", value: stats.total_expands.toLocaleString(), icon: Zap },
        { label: "Expands (24h)", value: stats.expands_24h.toLocaleString(), icon: Activity },
        { label: "Avg Latency", value: `${stats.avg_latency_ms}ms`, icon: Clock },
        { label: "Error Rate", value: `${stats.error_rate_pct}%`, icon: AlertTriangle },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SpecHub overview
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
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
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Prompts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/prompts">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!prompts || prompts.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No prompts yet. Create your first one!
              </p>
            ) : (
              <div className="space-y-3">
                {prompts.items.map((p) => (
                  <Link
                    key={p.name}
                    href={`/prompts/${p.name}`}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.latest_version && (
                        <span className="text-xs text-muted-foreground ml-2">
                          v{p.latest_version.version}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {p.is_deprecated && (
                        <Badge variant="destructive" className="text-[10px]">
                          deprecated
                        </Badge>
                      )}
                      {p.latest_version?.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-base font-medium">Quick Actions</h2>
          <div className="grid gap-3">
            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link href="/prompts/new">
                <Plus className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-medium">New Prompt</div>
                  <div className="text-xs text-muted-foreground">
                    Create a prompt with an initial version
                  </div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link href="/metrics">
                <BarChart3 className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Metrics</div>
                  <div className="text-xs text-muted-foreground">
                    Usage analytics and governance
                  </div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 justify-start" asChild>
              <Link href="/settings">
                <Key className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <div className="font-medium">API Keys</div>
                  <div className="text-xs text-muted-foreground">
                    Manage keys and project settings
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
