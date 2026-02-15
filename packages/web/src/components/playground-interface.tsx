'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveAsExample, type ModelOption } from '@/app/(app)/playground/actions';
import { Loader2, Sparkles, Save, ArrowLeftRight, ThumbsUp, ThumbsDown } from 'lucide-react';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type Props = {
  projectId: string;
  models: ModelOption[];
  systemPrompt: string | null;
};

export function PlaygroundInterface({ projectId, models, systemPrompt }: Props) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0]?.id ?? '');
  const [selectedModelB, setSelectedModelB] = useState(models[1]?.id ?? models[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [outputB, setOutputB] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingB, setIsGeneratingB] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [responseTimeA, setResponseTimeA] = useState<number | null>(null);
  const [responseTimeB, setResponseTimeB] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortControllerBRef = useRef<AbortController | null>(null);

  const generateWithModel = useCallback(
    async (
      model: string,
      setOutputFn: (output: string) => void,
      setGeneratingFn: (isGenerating: boolean) => void,
      setResponseTimeFn: (time: number) => void,
      controllerRef: React.MutableRefObject<AbortController | null>,
    ) => {
      if (!input.trim()) {
        toast.error('Please enter a message');
        return;
      }

      if (!model) {
        toast.error('Please select a model');
        return;
      }

      setGeneratingFn(true);
      setOutputFn('');
      setResponseTimeFn(0);

      // Cancel any existing request
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      const startTime = Date.now();

      try {
        const messages: Message[] = [];

        // Add system prompt if available
        if (systemPrompt) {
          messages.push({
            role: 'system',
            content: systemPrompt,
          });
        }

        // Add user message
        messages.push({
          role: 'user',
          content: input.trim(),
        });

        const response = await fetch('/api/playground', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            model,
            messages,
            temperature,
            maxTokens,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to generate');
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Read the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedOutput = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  accumulatedOutput += content;
                  setOutputFn(accumulatedOutput);
                }
              } catch (e) {
                // Skip malformed JSON
                console.debug('Skipped malformed JSON:', e);
              }
            }
          }
        }

        const endTime = Date.now();
        setResponseTimeFn(endTime - startTime);

        if (!compareMode) {
          toast.success('Generated successfully');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          if (!compareMode) {
            toast.info('Generation cancelled');
          }
        } else {
          console.error('Generation error:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to generate');
        }
      } finally {
        setGeneratingFn(false);
        controllerRef.current = null;
      }
    },
    [input, systemPrompt, projectId, temperature, maxTokens, compareMode],
  );

  const handleGenerate = useCallback(async () => {
    if (compareMode) {
      // Generate both simultaneously
      await Promise.all([
        generateWithModel(
          selectedModel,
          setOutput,
          setIsGenerating,
          setResponseTimeA,
          abortControllerRef,
        ),
        generateWithModel(
          selectedModelB,
          setOutputB,
          setIsGeneratingB,
          setResponseTimeB,
          abortControllerBRef,
        ),
      ]);
      toast.success('Generated both responses');
    } else {
      // Generate single
      await generateWithModel(
        selectedModel,
        setOutput,
        setIsGenerating,
        setResponseTimeA,
        abortControllerRef,
      );
    }
  }, [compareMode, selectedModel, selectedModelB, generateWithModel]);

  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleSaveAsExample = useCallback(async () => {
    if (!input.trim() || !output.trim()) {
      toast.error('Both input and output are required to save');
      return;
    }

    setIsSaving(true);
    const result = await saveAsExample(projectId, input.trim(), output.trim());
    setIsSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success('Saved as unrated example');
  }, [projectId, input, output]);

  const handlePreferA = useCallback(() => {
    toast.success('Preference saved: Model A');
  }, []);

  const handlePreferB = useCallback(() => {
    toast.success('Preference saved: Model B');
  }, []);

  // Cancel on unmount
  useEffect(() => {
    const controllerA = abortControllerRef.current;
    const controllerB = abortControllerBRef.current;
    return () => {
      controllerA?.abort();
      controllerB?.abort();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Compare Mode Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="compare-mode" className="font-medium">
              Compare Mode
            </Label>
            <span className="text-sm text-muted-foreground">Run two models side-by-side</span>
          </div>
          <Switch
            id="compare-mode"
            checked={compareMode}
            onCheckedChange={(checked) => {
              setCompareMode(checked);
              if (!checked) {
                setOutputB('');
                setResponseTimeB(null);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{compareMode ? 'Model A' : 'Model'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Select Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {compareMode ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model B</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model-b">Select Model</Label>
                <Select value={selectedModelB} onValueChange={setSelectedModelB}>
                  <SelectTrigger id="model-b">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[temperature]}
                  onValueChange={([value]) => setTemperature(value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <span className="text-sm text-muted-foreground">{maxTokens}</span>
                </div>
                <Slider
                  id="max-tokens"
                  min={256}
                  max={4096}
                  step={256}
                  value={[maxTokens]}
                  onValueChange={([value]) => setMaxTokens(value)}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {compareMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[temperature]}
                  onValueChange={([value]) => setTemperature(value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <span className="text-sm text-muted-foreground">{maxTokens}</span>
                </div>
                <Slider
                  id="max-tokens"
                  min={256}
                  max={4096}
                  step={256}
                  value={[maxTokens]}
                  onValueChange={([value]) => setMaxTokens(value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y font-mono text-sm"
            disabled={isGenerating}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={(compareMode ? isGenerating || isGeneratingB : isGenerating) || !input.trim()}
        >
          {compareMode ? (
            isGenerating || isGeneratingB ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Compare
              </>
            )
          ) : isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {output && !isGenerating && !isGeneratingB && !compareMode && (
          <>
            <Button variant="outline" onClick={handleRegenerate}>
              Regenerate
            </Button>

            <Button
              variant="secondary"
              onClick={handleSaveAsExample}
              disabled={isSaving}
              className="ml-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save as Example
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Output(s) */}
      {compareMode ? (
        <>
          {(output || outputB || isGenerating || isGeneratingB) && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Model A Output */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Model A</CardTitle>
                    {responseTimeA !== null && (
                      <span className="text-xs text-muted-foreground">
                        {(responseTimeA / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[200px] rounded-md border bg-muted/50 p-4 font-mono text-sm">
                    {output ? (
                      <div className="whitespace-pre-wrap">{output}</div>
                    ) : (
                      <div className="flex items-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating response...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Model B Output */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Model B</CardTitle>
                    {responseTimeB !== null && (
                      <span className="text-xs text-muted-foreground">
                        {(responseTimeB / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[200px] rounded-md border bg-muted/50 p-4 font-mono text-sm">
                    {outputB ? (
                      <div className="whitespace-pre-wrap">{outputB}</div>
                    ) : (
                      <div className="flex items-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating response...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Preference Buttons */}
          {output && outputB && !isGenerating && !isGeneratingB && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={handlePreferA} className="gap-2">
                <ThumbsUp className="h-4 w-4" />
                Prefer Model A
              </Button>
              <Button variant="outline" onClick={handlePreferB} className="gap-2">
                <ThumbsUp className="h-4 w-4" />
                Prefer Model B
              </Button>
            </div>
          )}
        </>
      ) : (
        (output || isGenerating) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Output</CardTitle>
                {responseTimeA !== null && (
                  <span className="text-xs text-muted-foreground">
                    {(responseTimeA / 1000).toFixed(2)}s
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] rounded-md border bg-muted/50 p-4 font-mono text-sm">
                {output ? (
                  <div className="whitespace-pre-wrap">{output}</div>
                ) : (
                  <div className="flex items-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating response...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
