"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";
import {
  createWorkflow,
  listPrompts,
  type Prompt,
  type WorkflowStep_t,
} from "@/lib/api";

function NewWorkflowPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep_t[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPrompts(1, 100)
      .then((res) => setPrompts(res.items))
      .catch(() => {});
  }, []);

  const addStep = () => {
    const idx = steps.length + 1;
    setSteps([
      ...steps,
      {
        id: `step-${idx}`,
        prompt_name: prompts[0]?.name ?? "",
        prompt_version: null,
        input_mapping: {},
        depends_on: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        output_key: `output_${idx}`,
      },
    ]);
  };

  const removeStep = (idx: number) => {
    const removed = steps[idx];
    const updated = steps.filter((_, i) => i !== idx).map((s) => ({
      ...s,
      depends_on: s.depends_on.filter((d) => d !== removed.id),
    }));
    setSteps(updated);
  };

  const updateStep = (idx: number, partial: Partial<WorkflowStep_t>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  const updateInputMapping = (
    stepIdx: number,
    key: string,
    value: string
  ) => {
    const step = steps[stepIdx];
    const mapping = { ...step.input_mapping, [key]: value };
    updateStep(stepIdx, { input_mapping: mapping });
  };

  const removeInputMapping = (stepIdx: number, key: string) => {
    const step = steps[stepIdx];
    const mapping = { ...step.input_mapping };
    delete mapping[key];
    updateStep(stepIdx, { input_mapping: mapping });
  };

  const addInputMapping = (stepIdx: number) => {
    const step = steps[stepIdx];
    const newKey = `var_${Object.keys(step.input_mapping).length + 1}`;
    updateStep(stepIdx, {
      input_mapping: { ...step.input_mapping, [newKey]: "" },
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      const wf = await createWorkflow({
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || undefined,
        steps,
      });
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New Workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chain prompts together into a multi-step pipeline.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PRD Pipeline"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">
              Steps ({steps.length})
            </h2>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card className="py-8">
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  No steps yet. Add a step to start building your workflow.
                </p>
                <Button size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Step
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <Card key={step.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
                          {step.id}
                        </span>
                        {step.depends_on.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            depends on: {step.depends_on.join(", ")}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeStep(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Prompt
                        </label>
                        <select
                          className="w-full mt-1 rounded-md border border-input bg-[#0d0d0d] px-3 py-1.5 text-sm"
                          value={step.prompt_name}
                          onChange={(e) =>
                            updateStep(idx, { prompt_name: e.target.value })
                          }
                        >
                          <option value="">Select prompt...</option>
                          {prompts.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Output Key
                        </label>
                        <Input
                          value={step.output_key}
                          onChange={(e) =>
                            updateStep(idx, { output_key: e.target.value })
                          }
                          className="mt-1"
                          placeholder="output_key"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-muted-foreground">
                          Input Mapping
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => addInputMapping(idx)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      {Object.entries(step.input_mapping).length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          No input mappings. Add one to pass data to this step.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.entries(step.input_mapping).map(
                            ([key, val]) => (
                              <div
                                key={key}
                                className="flex items-center gap-2"
                              >
                                <Input
                                  value={key}
                                  className="h-7 text-xs flex-1"
                                  placeholder="variable"
                                  onChange={(e) => {
                                    const newMapping = {
                                      ...step.input_mapping,
                                    };
                                    delete newMapping[key];
                                    newMapping[e.target.value] = val;
                                    updateStep(idx, {
                                      input_mapping: newMapping,
                                    });
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">
                                  =
                                </span>
                                <Input
                                  value={val}
                                  className="h-7 text-xs flex-1 font-mono"
                                  placeholder='{{ input.key }} or {{ steps.s1.out }}'
                                  onChange={(e) =>
                                    updateInputMapping(
                                      idx,
                                      key,
                                      e.target.value
                                    )
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    removeInputMapping(idx, key)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={!name.trim() || saving}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Create Workflow"}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/workflows">Cancel</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs text-muted-foreground">
                Input Mapping Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground space-y-1.5">
              <p>
                <code className="bg-[#0d0d0d] px-1 rounded font-mono">
                  {"{{ input.key }}"}
                </code>{" "}
                — from workflow input
              </p>
              <p>
                <code className="bg-[#0d0d0d] px-1 rounded font-mono">
                  {"{{ steps.step-1.output_key }}"}
                </code>{" "}
                — from a previous step
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-secondary rounded animate-pulse" />}>
      <NewWorkflowPageInner />
    </Suspense>
  );
}
