'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChartContainer, ChartConfig, ChartTooltip, ChartLegend } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  CheckCircle2,
  XCircle,
  Minus,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import type { EvaluationResults, HistoricalEvalTrend } from '../../actions';

type ResultsRevealProps = {
  results: EvaluationResults;
  trends: HistoricalEvalTrend[];
};

export function ResultsReveal({ results, trends }: ResultsRevealProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const {
    modelId,
    baseModel,
    totalEvaluations,
    modelWins,
    baselineWins,
    ties,
    avgModelScore,
    avgBaselineScore,
    items,
  } = results;

  // Calculate win rate
  const modelWinRate = totalEvaluations > 0 ? (modelWins / totalEvaluations) * 100 : 0;
  const baselineWinRate = totalEvaluations > 0 ? (baselineWins / totalEvaluations) * 100 : 0;
  const tieRate = totalEvaluations > 0 ? (ties / totalEvaluations) * 100 : 0;

  // Determine verdict
  const getVerdict = () => {
    if (modelWinRate >= 60) {
      return {
        text: 'SHIP IT',
        description: 'Your fine-tuned model significantly outperforms the baseline.',
        icon: Trophy,
        color: 'text-green-600',
      };
    } else if (modelWinRate >= 45) {
      return {
        text: 'PROMISING',
        description: 'Your model shows improvement but could benefit from more training data.',
        icon: TrendingUp,
        color: 'text-blue-600',
      };
    } else {
      return {
        text: 'NEED MORE DATA',
        description: 'Consider adding more high-quality examples and retraining.',
        icon: AlertTriangle,
        color: 'text-amber-600',
      };
    }
  };

  const verdict = getVerdict();

  return (
    <div className="container max-w-6xl py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Evaluation Results</h1>
          <p className="text-muted-foreground">
            Blind comparison results for your fine-tuned model vs baseline
          </p>
        </div>

        {/* Reveal Button */}
        <AnimatePresence mode="wait">
          {!isRevealed ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-center py-12"
            >
              <Button size="lg" onClick={() => setIsRevealed(true)} className="min-w-48">
                Reveal Model Identities
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Model Identity Reveal */}
              <Card>
                <CardHeader>
                  <CardTitle>Model Identities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                      <div className="mb-2 text-sm font-medium text-muted-foreground">
                        Fine-Tuned Model
                      </div>
                      <div className="font-mono text-sm">{modelId}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                      <div className="mb-2 text-sm font-medium text-muted-foreground">Baseline</div>
                      <div className="font-mono text-sm">{baseModel}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Win/Loss/Tie Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Performance</CardTitle>
                  <CardDescription>{totalEvaluations} blind comparisons completed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Win Rate Bars */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Fine-Tuned Wins</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {modelWins} ({modelWinRate.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={modelWinRate} className="h-3 [&>div]:bg-green-600" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium">Baseline Wins</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {baselineWins} ({baselineWinRate.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={baselineWinRate} className="h-3 [&>div]:bg-red-600" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">Ties</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {ties} ({tieRate.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={tieRate} className="h-3 [&>div]:bg-gray-600" />
                  </div>

                  {/* Average Scores */}
                  {avgModelScore !== null && avgBaselineScore !== null && (
                    <div className="grid gap-4 border-t border-border pt-6 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">
                          Avg Fine-Tuned Score
                        </div>
                        <div className="text-2xl font-bold">{avgModelScore.toFixed(1)}/10</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-muted-foreground">
                          Avg Baseline Score
                        </div>
                        <div className="text-2xl font-bold">{avgBaselineScore.toFixed(1)}/10</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verdict */}
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full p-3 ${verdict.color} bg-muted`}>
                      <verdict.icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-2xl font-bold ${verdict.color}`}>{verdict.text}</h3>
                      <p className="mt-1 text-muted-foreground">{verdict.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Historical Trends */}
              {trends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Historical Trends</CardTitle>
                    <CardDescription>Performance across training iterations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HistoricalTrendsChart trends={trends} />
                  </CardContent>
                </Card>
              )}

              {/* Per-Example Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Per-Example Breakdown</CardTitle>
                  <CardDescription>Detailed comparison for each validation example</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((item, index) => (
                    <ExampleBreakdown key={item.id} item={item} index={index} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type ExampleBreakdownProps = {
  item: EvaluationResults['items'][0];
  index: number;
};

function ExampleBreakdown({ item, index }: ExampleBreakdownProps) {
  const getPreferenceIcon = () => {
    if (item.preferred === 'model') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    } else if (item.preferred === 'baseline') {
      return <XCircle className="h-5 w-5 text-red-600" />;
    } else {
      return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getPreferenceLabel = () => {
    if (item.preferred === 'model') return 'Fine-Tuned Wins';
    if (item.preferred === 'baseline') return 'Baseline Wins';
    return 'Tie';
  };

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 text-left hover:bg-muted/50">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
        <div className="flex flex-1 items-center gap-4">
          <Badge variant="outline" className="font-mono">
            #{index + 1}
          </Badge>
          <div className="flex-1 truncate text-sm text-muted-foreground">{item.input}</div>
          <div className="flex items-center gap-2">
            {getPreferenceIcon()}
            <span className="text-sm font-medium">{getPreferenceLabel()}</span>
          </div>
          {item.model_score !== null && item.baseline_score !== null && (
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
              <span className="text-green-600">{item.model_score}</span>
              <span>vs</span>
              <span className="text-red-600">{item.baseline_score}</span>
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-x border-b border-border bg-background p-6">
        <div className="space-y-6">
          {/* Input */}
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Input</div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap text-sm">{item.input}</p>
            </div>
          </div>

          {/* Outputs */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-medium">Fine-Tuned Output</div>
                {item.preferred === 'model' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm">{item.model_output}</p>
              </div>
              {item.model_score !== null && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Score: {item.model_score}/10
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-medium">Baseline Output</div>
                {item.preferred === 'baseline' && <XCircle className="h-4 w-4 text-red-600" />}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm">{item.baseline_output}</p>
              </div>
              {item.baseline_score !== null && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Score: {item.baseline_score}/10
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type HistoricalTrendsChartProps = {
  trends: HistoricalEvalTrend[];
};

function HistoricalTrendsChart({ trends }: HistoricalTrendsChartProps) {
  const chartConfig = {
    winRate: {
      label: 'Win Rate',
      color: 'hsl(var(--chart-1))',
    },
    modelScore: {
      label: 'Model Score',
      color: 'hsl(var(--chart-2))',
    },
    baselineScore: {
      label: 'Baseline Score',
      color: 'hsl(var(--chart-3))',
    },
  } satisfies ChartConfig;

  const chartData = trends.map((trend) => ({
    version: `v${trend.version}`,
    winRate: trend.modelWinRate,
    modelScore: trend.avgModelScore,
    baselineScore: trend.avgBaselineScore,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="version"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            domain={[0, 100]}
          />
          <ChartTooltip />
          <ChartLegend />
          <Line
            type="monotone"
            dataKey="winRate"
            stroke="var(--color-winRate)"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Win Rate %"
          />
          {chartData.some((d) => d.modelScore !== null) && (
            <Line
              type="monotone"
              dataKey="modelScore"
              stroke="var(--color-modelScore)"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Model Score"
            />
          )}
          {chartData.some((d) => d.baselineScore !== null) && (
            <Line
              type="monotone"
              dataKey="baselineScore"
              stroke="var(--color-baselineScore)"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Baseline Score"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
