'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type FilterType = 'unrated' | 'all' | 'below-threshold' | 'needs-rewrite';
export type SortType = 'newest' | 'oldest' | 'random' | 'rating-asc' | 'rating-desc';

export async function getExamples(
  projectId: string,
  filter: FilterType = 'unrated',
  sort: SortType = 'newest',
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { examples: [], error: 'Not authenticated' };
  }

  // Get project quality threshold
  const { data: project } = await supabase
    .from('projects')
    .select('quality_threshold')
    .eq('id', projectId)
    .single();

  const threshold = project?.quality_threshold ?? 8;

  // Build query
  let query = supabase
    .from('examples')
    .select('id, input, output, rating, rewrite, created_at')
    .eq('project_id', projectId);

  // Apply filters
  if (filter === 'unrated') {
    query = query.is('rating', null);
  } else if (filter === 'below-threshold') {
    query = query.not('rating', 'is', null).lt('rating', threshold);
  } else if (filter === 'needs-rewrite') {
    query = query.not('rating', 'is', null).is('rewrite', null);
  }
  // 'all' filter applies no additional constraints

  // Apply sorting
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (sort === 'rating-asc') {
    query = query.order('rating', { ascending: true, nullsFirst: false });
  } else if (sort === 'rating-desc') {
    query = query.order('rating', { ascending: false, nullsFirst: false });
  }
  // 'random' sorting will be handled client-side

  const { data, error } = await query;

  if (error) {
    return { examples: [], error: error.message };
  }

  let examples = data ?? [];

  // Handle random sort client-side
  if (sort === 'random') {
    examples = [...examples].sort(() => Math.random() - 0.5);
  }

  return { examples };
}

// Keep legacy function for backward compatibility
export async function getUnratedExamples(projectId: string) {
  return getExamples(projectId, 'unrated', 'newest');
}

export async function rateExample(exampleId: string, rating: number, rewrite?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const updateData: {
    rating: number;
    rated_by: string;
    rated_at: string;
    rewrite?: string;
  } = {
    rating,
    rated_by: user.id,
    rated_at: new Date().toISOString(),
  };

  // Only include rewrite if provided
  if (rewrite !== undefined) {
    updateData.rewrite = rewrite;
  }

  const { error } = await supabase.from('examples').update(updateData).eq('id', exampleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
