"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  getWorkflow,
  updateWorkflow,
  runWorkflow,
  listPrompts,
  type Workflow_t,
  type WorkflowStep_t,
  type WorkflowRunResponse,
  type Prompt,
} from "@/lib/api";

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow_t | null>(null);
  const [steps, setSteps] = useState<WorkflowStep_t[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Run state
  const [runInput, setRunInput] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<WorkflowRunResponse | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([getWorkflow(id), listPrompts(1, 100)])
      .then(([wf, pl]) => {
        setWorkflow(wf);
        setName(wf.name);
        setDescription(wf.description ?? "");
        setSteps(wf.steps);
        setPrompts(pl.items);
      })
      .catch(() => router.push("/workflows"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateWorkflow(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        steps,
      });
      setWorkflow(updated);
      setDirty(false);
    } catch {}
    setSaving(false);
  };

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runWorkflow(id, runInput);
      setRunResult(result);
    } catch {}
    setRunning(false);
  };

  const addStep = () => {
    const idx = steps.length + 1;
    const newSteps = [
      ...steps,
      {
        id: `step-${idx}`,
        prompt_name: prompts[0]?.name ?? "",
        prompt_version: null,
        input_mapping: {},
        depends_on: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        output_key: `output_${idx}`,
      },
    ];
    setSteps(newSteps);
    setDirty(true);
  };

  const removeStep = (idx: number) => {
    const removed = steps[idx];
    const updated = steps
      .filter((_, i) => i !== idx)
      .map((s) => ({
        ...s,
        depends_on: s.depends_on.filter((d) => d !== removed.id),
      }));
    setSteps(updated);
    setDirty(true);
  };

  const updateStep = (idx: number, partial: Partial<WorkflowStep_t>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
    setDirty(true);
  };

  const addInputMapping = (stepIdx: number) => {
    const step = steps[stepIdx];
    const newKey = `var_${Object.keys(step.input_mapping).length + 1}`;
    updateStep(stepIdx, {
      input_mapping: { ...step.input_mapping, [newKey]: "" },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  if (!workflow) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/workflows">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {workflow.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {workflow.steps.length} step
              {workflow.steps.length !== 1 ? "s" : ""} · Updated{" "}
              {new Date(workflow.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="outline" className="text-xs">
              Unsaved
            </Badge>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Editor */}
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
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Description
                </label>
                <Input
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">Steps ({steps.length})</h2>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>

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
                        → {step.depends_on.join(", ")}
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
                      No input mappings.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(step.input_mapping).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Input
                            value={key}
                            className="h-7 text-xs flex-1"
                            onChange={(e) => {
                              const m = { ...step.input_mapping };
                              delete m[key];
                              m[e.target.value] = val;
                              updateStep(idx, { input_mapping: m });
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            =
                          </span>
                          <Input
                            value={val}
                            className="h-7 text-xs flex-1 font-mono"
                            placeholder='{{ input.key }}'
                            onChange={(e) => {
                              updateStep(idx, {
                                input_mapping: {
                                  ...step.input_mapping,
                                  [key]: e.target.value,
                                },
                              });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const m = { ...step.input_mapping };
                              delete m[key];
                              updateStep(idx, { input_mapping: m });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sidebar: Test Runner */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Runner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Workflow Input (JSON keys)
                </label>
                <div className="space-y-1.5">
                  {Object.entries(runInput).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input
                        value={key}
                        className="h-7 text-xs flex-1"
                        onChange={(e) => {
                          const newInput = { ...runInput };
                          delete newInput[key];
                          newInput[e.target.value] = val;
                          setRunInput(newInput);
                        }}
                      />
                      <Input
                        value={val}
                        className="h-7 text-xs flex-1"
                        onChange={(e) =>
                          setRunInput({ ...runInput, [key]: e.target.value })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const newInput = { ...runInput };
                          delete newInput[key];
                          setRunInput(newInput);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 text-xs"
                  onClick={() =>
                    setRunInput({
                      ...runInput,
                      [`key_${Object.keys(runInput).length + 1}`]: "",
                    })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Input
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={handleRun}
                disabled={running || steps.length === 0}
              >
                {running ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                {running ? "Running..." : "Run Workflow"}
              </Button>
            </CardContent>
          </Card>

          {runResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {runResult.steps.map((sr) => (
                  <div
                    key={sr.step_id}
                    className="rounded-md border border-border p-3 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      {sr.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="text-xs font-mono">{sr.step_id}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {sr.prompt_name} v{sr.prompt_version}
                      </Badge>
                    </div>
                    {sr.error ? (
                      <p className="text-xs text-destructive">{sr.error}</p>
                    ) : (
                      <>
                        {sr.system_message && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">
                              System:
                            </p>
                            <pre className="text-xs bg-[#0d0d0d] rounded p-2 mt-0.5 whitespace-pre-wrap font-mono">
                              {sr.system_message}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            User:
                          </p>
                          <pre className="text-xs bg-[#0d0d0d] rounded p-2 mt-0.5 whitespace-pre-wrap font-mono">
                            {sr.user_message}
                          </pre>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Final Outputs:
                  </p>
                  <pre className="text-xs bg-[#0d0d0d] rounded p-2 whitespace-pre-wrap font-mono">
                    {JSON.stringify(runResult.outputs, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
