"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X, ChevronDown, ChevronRight } from "lucide-react";
import { getVersions, createVersion, APIError, type PromptVersion } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function NewVersionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const name = params.name as string;

  const [latest, setLatest] = useState<PromptVersion | null>(null);
  const [version, setVersion] = useState("");
  const [systemTemplate, setSystemTemplate] = useState("");
  const [userTemplate, setUserTemplate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [inputSchema, setInputSchema] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getVersions(name)
      .then((versions) => {
        const v = versions[0];
        if (v) {
          setLatest(v);
          setSystemTemplate(v.system_template ?? "");
          setUserTemplate(v.user_template ?? "");
          setTags(v.tags ?? []);
          setInputSchema(
            v.input_schema ? JSON.stringify(v.input_schema, null, 2) : ""
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;

    let schema: Record<string, unknown> | undefined;
    try {
      schema = inputSchema ? JSON.parse(inputSchema) : undefined;
    } catch {
      toast({ title: "Invalid JSON", description: "Input schema is not valid JSON.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await createVersion(name, {
        version,
        system_template: systemTemplate || undefined,
        user_template: userTemplate || undefined,
        input_schema: schema,
        tags: tags.length > 0 ? tags : undefined,
      });
      toast({ title: "Version created", description: `${name} v${version}` });
      router.push(`/prompts/${name}`);
    } catch (err) {
      const msg = err instanceof APIError ? err.body : "Unknown error";
      toast({ title: "Failed to create version", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/prompts/${name}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {name}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New Version — {name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {latest
            ? `Pre-filled from v${latest.version}. Change what you need.`
            : "Create the first version."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Version</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="2.0.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                System Template
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={systemTemplate}
                onChange={(e) => setSystemTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The main prompt content. Use {"{{ input }}"} to reference the user&apos;s input.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-base">Advanced</CardTitle>
              <span className="text-xs text-muted-foreground ml-auto">Optional</span>
            </button>
          </CardHeader>
          {showAdvanced && (
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  User Template
                </label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Leave empty to pass user input directly"
                  value={userTemplate}
                  onChange={(e) => setUserTemplate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If empty, the user&apos;s raw input is used as the user message.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Input Schema (JSON)</label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={inputSchema}
                  onChange={(e) => setInputSchema(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defaults to a single &quot;input&quot; string field. Only change for multi-variable prompts.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !version}>
            {submitting ? "Creating..." : "Create Version"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
