'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const TOGETHER_API_BASE = 'https://api.together.xyz/v1';

// =============================================================================
// PROJECT SETTINGS
// =============================================================================

export async function getProjectSettings(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { project: null, error: 'Not authenticated' };
  }

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

export async function updateProjectBasics(projectId: string, name: string, description: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('projects')
    .update({
      name,
      system_prompt: description || null,
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

export async function validateApiKey(apiKey: string) {
  try {
    const response = await fetch(`${TOGETHER_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to connect to Together.ai' };
  }
}

export type TogetherModel = {
  id: string;
  display_name: string;
  context_length: number;
};

const RECOMMENDED_MODELS = [
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
  'mistralai/Mistral-7B-Instruct-v0.3',
];

export async function fetchModels(apiKey: string) {
  try {
    const response = await fetch(`${TOGETHER_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { models: [], error: 'Failed to fetch models' };
    }

    const data = (await response.json()) as TogetherModel[];

    // Filter to chat/instruct models and sort recommended first
    const chatModels = data
      .filter((m) => m.id.includes('Instruct') || m.id.includes('chat') || m.id.includes('Chat'))
      .map((m) => ({
        id: m.id,
        display_name: m.display_name || m.id.split('/').pop() || m.id,
        context_length: m.context_length,
        recommended: RECOMMENDED_MODELS.includes(m.id),
      }))
      .sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    return { models: chatModels };
  } catch {
    return { models: [], error: 'Failed to connect to Together.ai' };
  }
}

export async function updateProviderConfig(projectId: string, apiKey: string, model: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { members: [], error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Invites require SUPABASE_SECRET_KEY to be configured' };
  }

  const admin = createAdminClient();
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !inviteData?.user) {
    return { error: inviteError?.message ?? 'Failed to send invite' };
  }

  const { error: memberError } = await admin.from('project_members').insert({
    project_id: projectId,
    user_id: inviteData.user.id,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { jsonl: null, error: 'Not authenticated' };
  }

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  // Clear active project cookie
  return { success: true, clearCookie: true };
}
