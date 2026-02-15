'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RatingDistribution, SplitStats } from '@/app/(app)/dashboard/actions';

const chartConfig = {
  trainCount: {
    label: 'Train',
    color: 'hsl(var(--chart-1))',
  },
  valCount: {
    label: 'Validation',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function RatingDistributionChart({
  distribution,
  splitStats,
}: {
  distribution: RatingDistribution[];
  splitStats: SplitStats;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <CardDescription>
          {splitStats.trainCount > 0 || splitStats.valCount > 0
            ? `${splitStats.trainCount} train, ${splitStats.valCount} validation${splitStats.unassignedCount > 0 ? `, ${splitStats.unassignedCount} unassigned` : ''}`
            : 'No rated examples assigned to splits yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="rating"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: 'Rating', position: 'insideBottom', offset: -5 }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="trainCount" fill="var(--color-trainCount)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="valCount" fill="var(--color-valCount)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
