"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, AlertTriangle } from "lucide-react";
import { listPrompts, type Prompt, type PromptListResponse } from "@/lib/api";

export default function PromptsPage() {
  const [data, setData] = useState<PromptListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    listPrompts(page, 20, activeTag ?? undefined)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, activeTag]);

  const allTags = Array.from(
    new Set(
      data?.items.flatMap((p) => p.latest_version?.tags ?? []) ?? []
    )
  ).sort();

  const filtered = data?.items.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.total} prompts` : "Loading..."}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/prompts/new">
            <Plus className="h-4 w-4 mr-1" />
            New Prompt
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {activeTag && (
            <Badge
              variant="outline"
              className="cursor-pointer border-primary text-primary"
              onClick={() => { setActiveTag(null); setPage(1); }}
            >
              {activeTag} ✕
            </Badge>
          )}
          {allTags
            .filter((t) => t !== activeTag)
            .slice(0, 8)
            .map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer hover:border-primary hover:text-primary transition-colors"
                onClick={() => { setActiveTag(tag); setPage(1); }}
              >
                {tag}
              </Badge>
            ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-secondary rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              {search ? "No prompts match your search." : "No prompts yet."}
            </p>
            <Button size="sm" asChild>
              <Link href="/prompts/new">
                <Plus className="h-4 w-4 mr-1" />
                Create your first prompt
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <Link href={`/prompts/${prompt.name}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              {prompt.name}
            </CardTitle>
            {prompt.is_deprecated && (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {prompt.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {prompt.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            {prompt.latest_version && (
              <Badge variant="secondary" className="text-xs">
                v{prompt.latest_version.version}
              </Badge>
            )}
            <div className="flex gap-1">
              {prompt.latest_version?.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
