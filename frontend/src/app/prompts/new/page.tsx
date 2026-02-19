"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X } from "lucide-react";
import { createPrompt, APIError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function CreatePromptPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [systemTemplate, setSystemTemplate] = useState("");
  const [userTemplate, setUserTemplate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [inputSchema, setInputSchema] = useState(
    JSON.stringify(
      {
        type: "object",
        properties: { input: { type: "string", description: "" } },
        required: ["input"],
      },
      null,
      2
    )
  );
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");

  const validateName = (v: string) => {
    if (!/^[a-z0-9-]*$/.test(v)) {
      setNameError("Only lowercase letters, numbers, and hyphens allowed");
    } else {
      setNameError("");
    }
    setName(v);
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !userTemplate || nameError) return;

    let schema: Record<string, unknown> | undefined;
    try {
      schema = inputSchema ? JSON.parse(inputSchema) : undefined;
    } catch {
      toast({ title: "Invalid JSON", description: "Input schema is not valid JSON.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await createPrompt({
        name,
        description: description || undefined,
        version: {
          version,
          system_template: systemTemplate || undefined,
          user_template: userTemplate,
          input_schema: schema,
          tags: tags.length > 0 ? tags : undefined,
        },
      });
      toast({ title: "Prompt created", description: `${name} v${version}` });
      router.push(`/prompts/${name}`);
    } catch (err) {
      const msg = err instanceof APIError ? err.body : "Unknown error";
      toast({ title: "Failed to create prompt", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prompts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Prompt</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new prompt with its initial version.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                placeholder="my-prompt"
                value={name}
                onChange={(e) => validateName(e.target.value)}
                required
              />
              {nameError && (
                <p className="text-xs text-destructive mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Input
                placeholder="What does this prompt do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Version</label>
              <Input
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                System Template <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="You are a senior software engineer..."
                value={systemTemplate}
                onChange={(e) => setSystemTemplate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">User Template</label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Implement the following: {{ input }}"
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tags</label>
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
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Input Schema (JSON)</label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-[#0d0d0d] px-3 py-2 text-sm font-[family-name:var(--font-geist-mono)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={inputSchema}
                onChange={(e) => setInputSchema(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !name || !userTemplate || !!nameError}>
            {submitting ? "Creating..." : "Create Prompt"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
