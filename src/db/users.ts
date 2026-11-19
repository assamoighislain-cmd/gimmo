import { requireSupabaseAdmin } from './supabase.ts';
import type { AppUser, UserRole } from '../types/gimmo.ts';
import { normalizeUserRole } from '../lib/rbac.ts';

function mapRowToAppUser(row: any): AppUser {
  return {
    id: Number(row.id),
    uid: String(row.uid || ''),
    email: String(row.email || ''),
    name: row.name || String(row.email || '').split('@')[0],
    role: normalizeUserRole(row.role),
    createdAt: row.created_at
      ? String(row.created_at)
      : new Date().toISOString(),
  };
}

export async function ensureInitialUsers(): Promise<void> {
  return;
}

export async function getAllUsers(): Promise<AppUser[]> {
  try {
    const sb = requireSupabaseAdmin();
    const { data, error } = await sb
      .from('users')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapRowToAppUser);
  } catch (error) {
    console.error('Supabase query failed in getAllUsers:', error);
    return [];
  }
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  requestedRole?: UserRole
): Promise<AppUser> {
  try {
    const sb = requireSupabaseAdmin();
    const cleanEmail = email.trim().toLowerCase();

    const { data: byEmail, error: emailErr } = await sb
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .limit(1);
    if (emailErr) throw emailErr;

    if (byEmail && byEmail.length > 0) {
      const existingUser = byEmail[0];
      const nextRole = requestedRole
        ? normalizeUserRole(requestedRole)
        : normalizeUserRole(existingUser.role);
      const { data: updated, error: updateErr } = await sb
        .from('users')
        .update({
          name: name || existingUser.name || cleanEmail.split('@')[0],
          role: nextRole,
        })
        .eq('id', existingUser.id)
        .select('*')
        .single();
      if (updateErr) throw updateErr;
      return mapRowToAppUser(updated);
    }

    const defaultRole: UserRole = requestedRole
      ? normalizeUserRole(requestedRole)
      : 'administrateur';

    const { data: upserted, error: upsertErr } = await sb
      .from('users')
      .upsert(
        {
          uid,
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          role: defaultRole,
        },
        { onConflict: 'uid' }
      )
      .select('*')
      .single();
    if (upsertErr) throw upsertErr;

    return mapRowToAppUser(upserted);
  } catch (error) {
    console.error('Supabase query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function upsertUserRecord(data: {
  id?: number;
  email: string;
  name: string;
  role: UserRole;
}): Promise<AppUser> {
  try {
    const sb = requireSupabaseAdmin();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim() || cleanEmail.split('@')[0];
    const cleanRole = normalizeUserRole(data.role);

    if (data.id) {
      const { data: updated, error } = await sb
        .from('users')
        .update({
          email: cleanEmail,
          name: cleanName,
          role: cleanRole,
        })
        .eq('id', Number(data.id))
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (updated) {
        return mapRowToAppUser(updated);
      }
    }

    const { data: existingByEmail, error: findErr } = await sb
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .limit(1);
    if (findErr) throw findErr;

    if (existingByEmail && existingByEmail.length > 0) {
      const { data: updated, error: updateErr } = await sb
        .from('users')
        .update({
          name: cleanName,
          role: cleanRole,
        })
        .eq('id', existingByEmail[0].id)
        .select('*')
        .single();
      if (updateErr) throw updateErr;
      return mapRowToAppUser(updated);
    }

    const generatedUid = `gimmo-${cleanRole}-${Date.now()}`;
    const { data: inserted, error: insertErr } = await sb
      .from('users')
      .insert({
        uid: generatedUid,
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
      })
      .select('*')
      .single();
    if (insertErr) throw insertErr;

    return mapRowToAppUser(inserted);
  } catch (error) {
    console.error('Supabase query failed in upsertUserRecord:', error);
    throw new Error("Impossible d'enregistrer le compte utilisateur.", {
      cause: error,
    });
  }
}

export async function deleteUserRecord(userId: number): Promise<void> {
  try {
    const sb = requireSupabaseAdmin();
    const { error } = await sb.from('users').delete().eq('id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Supabase query failed in deleteUserRecord:', error);
    throw new Error("Impossible de supprimer l'utilisateur.", { cause: error });
  }
}
