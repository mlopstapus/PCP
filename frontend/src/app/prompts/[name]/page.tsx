"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Clock,
  Pin,
} from "lucide-react";
import {
  getPrompt,
  getVersions,
  deprecatePrompt,
  pinVersion,
  type Prompt,
  type PromptVersion,
} from "@/lib/api";
import { Playground } from "@/components/playground";

export default function PromptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = params.name as string;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPrompt(name), getVersions(name)])
      .then(([p, v]) => {
        setPrompt(p);
        setVersions(v);
        setSelectedVersion(v[0] ?? null);
        setActiveVersionId((p as unknown as { active_version_id?: string }).active_version_id ?? null);
      })
      .catch(() => router.push("/prompts"))
      .finally(() => setLoading(false));
  }, [name, router]);

  const handleDeprecate = async () => {
    if (!confirm(`Deprecate prompt "${name}"? This cannot be undone.`)) return;
    try {
      await deprecatePrompt(name);
      router.push("/prompts");
    } catch {
      alert("Failed to deprecate prompt.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prompts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {prompt.name}
            </h1>
            {prompt.is_deprecated && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Deprecated
              </Badge>
            )}
          </div>
          {prompt.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {prompt.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/prompts/${name}/new-version`}>
              <Plus className="h-4 w-4 mr-1" />
              New Version
            </Link>
          </Button>
          {!prompt.is_deprecated && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeprecate}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Deprecate
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {selectedVersion && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    System Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedVersion.system_template ? (
                    <pre className="text-sm bg-[#0d0d0d] rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-geist-mono)]">
                      {selectedVersion.system_template}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No system template
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    User Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-[#0d0d0d] rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-geist-mono)]">
                    {selectedVersion.user_template}
                  </pre>
                </CardContent>
              </Card>

              {selectedVersion.input_schema && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Input Schema
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-[#0d0d0d] rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-geist-mono)]">
                      {JSON.stringify(selectedVersion.input_schema, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {selectedVersion.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {selectedVersion.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Playground
                promptName={name}
                versions={versions}
                selectedVersion={selectedVersion}
              />
            </>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Version History
          </h3>
          <div className="space-y-1">
            {versions.map((v) => (
              <div key={v.id} className="space-y-1">
                <button
                  onClick={() => setSelectedVersion(v)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedVersion?.id === v.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">v{v.version}</span>
                      {activeVersionId === v.id && (
                        <Badge variant="default" className="text-[10px] h-4 px-1">
                          active
                        </Badge>
                      )}
                    </div>
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="text-xs mt-0.5">
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </button>
                {activeVersionId !== v.id && (
                  <button
                    onClick={async () => {
                      try {
                        await pinVersion(name, v.version);
                        setActiveVersionId(v.id);
                      } catch {}
                    }}
                    className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5"
                  >
                    <Pin className="h-3 w-3" />
                    Pin as active
                  </button>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/prompts/${name}/new-version`}>
              <Plus className="h-4 w-4 mr-1" />
              Add Version
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
