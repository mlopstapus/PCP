"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Key, Plus, Copy, Check, Trash2, AlertCircle } from "lucide-react";
import {
  listProjects,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type Project_t,
  type ApiKey_t,
} from "@/lib/api";

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project_t[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project_t | null>(null);
  const [keys, setKeys] = useState<ApiKey_t[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    listApiKeys(selectedProject.id)
      .then(setKeys)
      .catch(() => setKeys([]));
  }, [selectedProject]);

  const handleCreate = async () => {
    if (!selectedProject || !newKeyName.trim()) return;
    try {
      const res = await createApiKey(selectedProject.id, {
        name: newKeyName.trim(),
        scopes: ["read", "expand", "write"],
      });
      setRawKey(res.raw_key);
      setKeys([res.key, ...keys]);
      setNewKeyName("");
      setCreating(false);
    } catch {
      // handle error
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    try {
      await revokeApiKey(keyId);
      setKeys(keys.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)));
    } catch {
      // handle error
    }
  };

  const handleCopy = () => {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage API keys and project configuration.
        </p>
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

          {rawKey && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">
                      API key created. Copy it now — it won&apos;t be shown again.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-[#0d0d0d] rounded px-3 py-2 font-[family-name:var(--font-geist-mono)] break-all">
                        {rawKey}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => setRawKey(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">API Keys</CardTitle>
              {creating ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Key name (e.g. production)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setCreating(false);
                    }}
                    className="h-8 w-48 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCreate}>
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Key
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {keys.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No API keys yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {keys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{key.name}</span>
                          {!key.is_active && (
                            <Badge variant="destructive" className="text-xs">
                              Revoked
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <code className="font-[family-name:var(--font-geist-mono)]">
                            {key.prefix}...
                          </code>
                          <Separator orientation="vertical" className="h-3" />
                          <span>
                            {key.scopes.join(", ")}
                          </span>
                          <Separator orientation="vertical" className="h-3" />
                          <span>
                            Created {new Date(key.created_at).toLocaleDateString()}
                          </span>
                          {key.last_used_at && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>
                                Last used {new Date(key.last_used_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {key.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
