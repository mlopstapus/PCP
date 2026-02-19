"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  Columns2,
  AlertCircle,
} from "lucide-react";
import { expandPrompt, type ExpandResponse, type PromptVersion } from "@/lib/api";

interface PlaygroundProps {
  promptName: string;
  versions: PromptVersion[];
  selectedVersion: PromptVersion | null;
}

function extractFields(
  schema: Record<string, unknown> | null
): { name: string; description: string }[] {
  if (!schema) return [{ name: "input", description: "" }];
  const props = (schema as { properties?: Record<string, { description?: string }> })
    .properties;
  if (!props) return [{ name: "input", description: "" }];
  return Object.entries(props).map(([name, val]) => ({
    name,
    description: val?.description ?? "",
  }));
}

export function Playground({
  promptName,
  versions,
  selectedVersion,
}: PlaygroundProps) {
  const [open, setOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const [leftVersion, setLeftVersion] = useState(selectedVersion?.version ?? "");
  const [rightVersion, setRightVersion] = useState("");

  const fields = extractFields(selectedVersion?.input_schema ?? null);
  const [values, setValues] = useState<Record<string, string>>({});

  const [leftResult, setLeftResult] = useState<ExpandResponse | null>(null);
  const [rightResult, setRightResult] = useState<ExpandResponse | null>(null);
  const [leftError, setLeftError] = useState("");
  const [rightError, setRightError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExpand = async () => {
    setLoading(true);
    setLeftResult(null);
    setRightResult(null);
    setLeftError("");
    setRightError("");

    const input: Record<string, unknown> = {};
    for (const f of fields) {
      input[f.name] = values[f.name] ?? "";
    }

    try {
      const res = await expandPrompt(
        promptName,
        input,
        leftVersion || undefined
      );
      setLeftResult(res);
    } catch (err) {
      setLeftError(err instanceof Error ? err.message : "Expand failed");
    }

    if (compareMode && rightVersion) {
      try {
        const res = await expandPrompt(promptName, input, rightVersion);
        setRightResult(res);
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Expand failed");
      }
    }

    setLoading(false);
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Playground
          </CardTitle>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Version:</label>
              <select
                className="rounded-md border border-input bg-[#0d0d0d] px-2 py-1 text-sm"
                value={leftVersion}
                onChange={(e) => setLeftVersion(e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={compareMode ? "border-primary text-primary" : ""}
              onClick={() => {
                setCompareMode(!compareMode);
                if (!compareMode && versions.length > 1) {
                  setRightVersion(
                    versions.find((v) => v.version !== leftVersion)?.version ??
                      versions[0].version
                  );
                }
              }}
            >
              <Columns2 className="h-4 w-4 mr-1" />
              Compare
            </Button>

            {compareMode && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">vs:</label>
                <select
                  className="rounded-md border border-input bg-[#0d0d0d] px-2 py-1 text-sm"
                  value={rightVersion}
                  onChange={(e) => setRightVersion(e.target.value)}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Input Fields
            </p>
            {fields.map((field) => (
              <div key={field.name}>
                <label className="text-sm font-medium mb-1 block">
                  {field.name}
                  {field.description && (
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      {field.description}
                    </span>
                  )}
                </label>
                <Input
                  placeholder={`Enter ${field.name}...`}
                  value={values[field.name] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [field.name]: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <Button onClick={handleExpand} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Expand
          </Button>

          {(leftResult || leftError || rightResult || rightError) && (
            <div
              className={
                compareMode
                  ? "grid grid-cols-2 gap-4"
                  : "space-y-3"
              }
            >
              <ExpandOutput
                label={compareMode ? `v${leftVersion}` : undefined}
                result={leftResult}
                error={leftError}
              />
              {compareMode && (
                <ExpandOutput
                  label={`v${rightVersion}`}
                  result={rightResult}
                  error={rightError}
                />
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ExpandOutput({
  label,
  result,
  error,
}: {
  label?: string;
  result: ExpandResponse | null;
  error: string;
}) {
  if (error) {
    return (
      <div className="space-y-2">
        {label && (
          <Badge variant="outline" className="text-xs">
            {label}
          </Badge>
        )}
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-2">
      {label && (
        <Badge variant="outline" className="text-xs">
          {label}
        </Badge>
      )}
      {result.system_message && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">
            System Message
          </p>
          <pre className="text-sm bg-[#0d0d0d] rounded-md p-3 overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] border border-border">
            {result.system_message}
          </pre>
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">
          User Message
        </p>
        <pre className="text-sm bg-[#0d0d0d] rounded-md p-3 overflow-x-auto whitespace-pre-wrap font-[family-name:var(--font-geist-mono)] border border-border">
          {result.user_message}
        </pre>
      </div>
    </div>
  );
}
