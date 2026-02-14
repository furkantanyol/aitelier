"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addExample, importExamples } from "@/app/(app)/add/actions";

type Project = { id: string; name: string };

export function AddExamples({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No projects yet. Create one first in{" "}
            <a href="/setup" className="text-primary underline">
              Setup
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualAdd projectId={projectId} />
        </TabsContent>
        <TabsContent value="import">
          <BulkImport projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManualAdd({ projectId }: { projectId: string }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [useRating, setUseRating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(0);

  const handleSubmit = async () => {
    if (!input.trim() || !output.trim()) {
      toast.error("Both input and output are required.");
      return;
    }

    setSaving(true);
    const result = await addExample(
      projectId,
      input.trim(),
      output.trim(),
      useRating ? (rating ?? undefined) : undefined,
    );
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const newCount = count + 1;
    setCount(newCount);
    setInput("");
    setOutput("");
    setRating(null);
    toast.success(`Example added (${newCount} this session)`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Example</CardTitle>
        <CardDescription>
          Enter an input/output pair. Optionally rate it now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="input">Input</Label>
            <FormatJsonButton value={input} onChange={setInput} />
          </div>
          <Textarea
            id="input"
            placeholder="What the user says or asks..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="output">Output</Label>
            <FormatJsonButton value={output} onChange={setOutput} />
          </div>
          <Textarea
            id="output"
            placeholder="The ideal response..."
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useRating}
              onChange={(e) => setUseRating(e.target.checked)}
              className="rounded"
            />
            Rate this example now
          </label>

          {useRating && (
            <div className="flex items-center gap-4">
              <Slider
                value={[rating ?? 5]}
                onValueChange={([v]) => setRating(v)}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {rating ?? 5}
              </span>
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Add & Next"}
        </Button>
      </CardContent>
    </Card>
  );
}

function BulkImport({ projectId }: { projectId: string }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<
    { input: string; output: string; rating?: number }[] | null
  >(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const parseInput = useCallback((raw: string) => {
    setText(raw);
    setParsed(null);
    setParseError(null);

    if (!raw.trim()) return;

    try {
      // Try JSONL (one JSON object per line)
      const lines = raw
        .trim()
        .split("\n")
        .filter((l) => l.trim());
      const items = lines.map((line, i) => {
        const obj = JSON.parse(line);
        if (!obj.input || !obj.output) {
          throw new Error(
            `Line ${i + 1}: missing "input" or "output" field`,
          );
        }
        return {
          input: String(obj.input),
          output: String(obj.output),
          rating: obj.rating != null ? Number(obj.rating) : undefined,
        };
      });
      setParsed(items);
    } catch {
      // Try JSON array
      try {
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) {
          setParseError("Expected a JSON array or JSONL (one object per line).");
          return;
        }
        const items = arr.map((obj: Record<string, unknown>, i: number) => {
          if (!obj.input || !obj.output) {
            throw new Error(
              `Item ${i + 1}: missing "input" or "output" field`,
            );
          }
          return {
            input: String(obj.input),
            output: String(obj.output),
            rating: obj.rating != null ? Number(obj.rating) : undefined,
          };
        });
        setParsed(items);
      } catch (e) {
        setParseError(
          e instanceof Error ? e.message : "Invalid JSON. Expected JSONL or a JSON array.",
        );
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string") {
        parseInput(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;

    setImporting(true);
    const result = await importExamples(projectId, parsed);
    setImporting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Imported ${result.count} examples`);
    setText("");
    setParsed(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Import</CardTitle>
        <CardDescription>
          Upload a .jsonl file or paste JSON. Each entry needs{" "}
          <code className="text-xs">{`{"input": "...", "output": "..."}`}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">Upload file</Label>
          <input
            id="file-upload"
            type="file"
            accept=".jsonl,.json"
            onChange={handleFileUpload}
            className="block text-sm text-muted-foreground file:mr-4 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paste">Or paste JSONL / JSON array</Label>
          <Textarea
            id="paste"
            placeholder={`{"input": "Hello", "output": "Hi there!"}\n{"input": "How are you?", "output": "I'm doing well."}`}
            value={text}
            onChange={(e) => parseInput(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        {parseError && (
          <p className="text-sm text-destructive">{parseError}</p>
        )}

        {parsed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {parsed.length} example{parsed.length !== 1 ? "s" : ""} ready to
              import
            </p>

            <div className="max-h-48 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Input</th>
                    <th className="px-3 py-1.5 text-left font-medium">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((ex, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-1.5">
                        {ex.input}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-1.5">
                        {ex.output}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  ...and {parsed.length - 50} more
                </p>
              )}
            </div>

            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${parsed.length} Examples`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FormatJsonButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  if (!value.trim()) return null;

  try {
    const parsed = JSON.parse(value);
    const formatted = JSON.stringify(parsed, null, 2);
    if (formatted === value) return null;

    return (
      <button
        type="button"
        onClick={() => onChange(formatted)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Format JSON
      </button>
    );
  } catch {
    return null;
  }
}
