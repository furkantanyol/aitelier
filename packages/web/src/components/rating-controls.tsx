'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterType, SortType } from '@/app/(app)/rate/actions';

type Props = {
  filter: FilterType;
  sort: SortType;
};

export function RatingControls({ filter, sort }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (newFilter: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('filter', newFilter);
    router.push(`/rate?${params.toString()}`);
  };

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', newSort);
    router.push(`/rate?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">Filter:</label>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unrated">Unrated</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="below-threshold">Below threshold</SelectItem>
            <SelectItem value="needs-rewrite">Needs rewrite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">Sort:</label>
        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="random">Random</SelectItem>
            <SelectItem value="rating-asc">Rating (low to high)</SelectItem>
            <SelectItem value="rating-desc">Rating (high to low)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
