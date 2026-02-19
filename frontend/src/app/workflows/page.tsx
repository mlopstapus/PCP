"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Workflow as WorkflowIcon,
  Plus,
  Trash2,
  Play,
  AlertCircle,
} from "lucide-react";
import {
  listProjects,
  listWorkflows,
  deleteWorkflow,
  type Project_t,
  type Workflow_t,
} from "@/lib/api";

export default function WorkflowsPage() {
  const [projects, setProjects] = useState<Project_t[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project_t | null>(null);
  const [workflows, setWorkflows] = useState<Workflow_t[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects()
      .then((res) => {
        setProjects(res.items);
        if (res.items.length > 0) setSelectedProject(res.items[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    listWorkflows(selectedProject.id)
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  }, [selectedProject]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    try {
      await deleteWorkflow(id);
      setWorkflows(workflows.filter((w) => w.id !== id));
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chain prompts together into multi-step workflows.
          </p>
        </div>
        {selectedProject && (
          <Button asChild>
            <Link href={`/workflows/new?project=${selectedProject.id}`}>
              <Plus className="h-4 w-4 mr-1" />
              New Workflow
            </Link>
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Create a project first using the project switcher in the navbar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Project:</label>
            <select
              className="rounded-md border border-input bg-[#0d0d0d] px-3 py-1.5 text-sm"
              value={selectedProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value);
                setSelectedProject(p ?? null);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {workflows.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <WorkflowIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">
                  No workflows yet. Create one to chain prompts together.
                </p>
                {selectedProject && (
                  <Button asChild>
                    <Link href={`/workflows/new?project=${selectedProject.id}`}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create Workflow
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workflows.map((wf) => (
                <Card key={wf.id} className="group">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Link
                          href={`/workflows/${wf.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {wf.name}
                        </Link>
                        {wf.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {wf.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(wf.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Updated {new Date(wf.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/workflows/${wf.id}`}>
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
