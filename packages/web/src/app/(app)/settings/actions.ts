'use server';

import { getAuthUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { validateApiKey, fetchModels, type TogetherModel } from '@/lib/providers/together';

// Re-export provider functions so existing imports from settings/actions still work
export { validateApiKey, fetchModels, type TogetherModel };

// =============================================================================
// PROJECT SETTINGS
// =============================================================================

export async function getProjectSettings(projectId: string) {
  const { supabase } = await getAuthUser();

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      'id, name, system_prompt, provider, base_model, provider_config, training_config, quality_threshold',
    )
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return { project: null, error: error?.message ?? 'Project not found' };
  }

  return { project };
}

export async function updateProjectBasics(
  projectId: string,
  name: string,
  description: string,
  qualityThreshold?: number,
) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('projects')
    .update({
      name,
      system_prompt: description || null,
      ...(qualityThreshold !== undefined && { quality_threshold: qualityThreshold }),
    })
    .eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

// =============================================================================
// PROVIDER CONFIG
// =============================================================================

export async function updateProviderConfig(projectId: string, apiKey: string, model: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('projects')
    .update({
      provider_config: { api_key: apiKey },
      base_model: model,
    })
    .eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateBaseModel(projectId: string, model: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('projects')
    .update({ base_model: model })
    .eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

// =============================================================================
// TRAINING DEFAULTS
// =============================================================================

export async function updateTrainingDefaults(
  projectId: string,
  config: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
    lora_r: number;
    lora_alpha: number;
    lora_dropout: number;
  },
) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('projects')
    .update({
      training_config: config,
    })
    .eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  revalidatePath('/train');
  return { success: true };
}

// =============================================================================
// TEAM MANAGEMENT
// =============================================================================

export type TeamMember = {
  user_id: string;
  email: string;
  role: 'owner' | 'trainer' | 'rater';
  invited_at: string;
};

export async function getTeamMembers(projectId: string) {
  const { supabase, user } = await getAuthUser();

  // Join project_members with auth.users to get email addresses
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, invited_at')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true });

  if (error) {
    return { members: [], error: error.message };
  }

  // Try to fetch user emails via admin client (requires SUPABASE_SERVICE_ROLE_KEY)
  const members: TeamMember[] = [];
  const hasServiceKey = !!(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (hasServiceKey) {
    const admin = createAdminClient();
    for (const member of data) {
      const { data: userData } = await admin.auth.admin.getUserById(member.user_id);
      members.push({
        user_id: member.user_id,
        email: userData?.user?.email ?? member.user_id.slice(0, 8) + '...',
        role: member.role as 'owner' | 'trainer' | 'rater',
        invited_at: member.invited_at,
      });
    }
  } else {
    // Fallback: show current user's email, truncated IDs for others
    for (const member of data) {
      members.push({
        user_id: member.user_id,
        email:
          member.user_id === user.id ? (user.email ?? 'you') : member.user_id.slice(0, 8) + '...',
        role: member.role as 'owner' | 'trainer' | 'rater',
        invited_at: member.invited_at,
      });
    }
  }

  return { members };
}

export async function inviteTeamMember(
  projectId: string,
  email: string,
  role: 'trainer' | 'rater',
) {
  await getAuthUser(); // Verify caller is authenticated

  const hasServiceKey = !!(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!hasServiceKey) {
    return { error: 'Invites require SUPABASE_SECRET_KEY to be configured' };
  }

  const admin = createAdminClient();

  // Check if user already exists in Supabase Auth
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId: string;

  if (existingUser) {
    // User already has an account — just add them to the project
    userId = existingUser.id;
  } else {
    // New user — send invite email via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !inviteData?.user) {
      return { error: inviteError?.message ?? 'Failed to send invite' };
    }
    userId = inviteData.user.id;
  }

  // Check if already a member of this project
  const { data: existing } = await admin
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return { error: 'This user is already a member of this project' };
  }

  const { error: memberError } = await admin.from('project_members').insert({
    project_id: projectId,
    user_id: userId,
    role,
  });

  if (memberError) {
    return { error: memberError.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: 'trainer' | 'rater',
) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

export async function removeMember(projectId: string, userId: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/settings');
  return { success: true };
}

// =============================================================================
// EXPORT
// =============================================================================

export async function exportDataset(projectId: string) {
  const { supabase } = await getAuthUser();

  // Fetch all examples for this project
  const { data: examples, error } = await supabase
    .from('examples')
    .select('input, output, rewrite, rating, split, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    return { jsonl: null, error: error.message };
  }

  // Convert to JSONL format
  const jsonl = examples
    .map((ex) =>
      JSON.stringify({
        input: ex.input,
        output: ex.rewrite ?? ex.output,
        rating: ex.rating,
        split: ex.split,
        created_at: ex.created_at,
      }),
    )
    .join('\n');

  return { jsonl };
}

// =============================================================================
// DELETE PROJECT
// =============================================================================

export async function deleteProject(projectId: string) {
  const { supabase } = await getAuthUser();

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  // Clear active project cookie
  return { success: true, clearCookie: true };
}
