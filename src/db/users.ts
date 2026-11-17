import { eq, asc } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';
import type { AppUser, UserRole } from '../types/gimmo.ts';
import { normalizeUserRole } from '../lib/rbac.ts';

function mapRowToAppUser(row: typeof users.$inferSelect): AppUser {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    name: row.name || row.email.split('@')[0],
    role: normalizeUserRole(row.role),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt || new Date().toISOString()),
  };
}

export async function ensureInitialUsers(): Promise<void> {
  try {
    const existing = await db.select().from(users);
    if (existing.length > 0) {
      // S'assurer que les rôles historiques ('agency_admin') sont normalisés vers 'administrateur'
      for (const u of existing) {
        if (
          u.role !== 'administrateur' &&
          u.role !== 'gerant' &&
          u.role !== 'commercial'
        ) {
          await db
            .update(users)
            .set({ role: normalizeUserRole(u.role) })
            .where(eq(users.id, u.id));
        }
      }
      return;
    }

    await db.insert(users).values([
      {
        uid: 'gimmo-admin-principal',
        email: 'assamoighislain@gmail.com',
        name: 'Assamoi Ghislain — Direction Générale',
        role: 'administrateur',
      },
      {
        uid: 'gimmo-gerant-locatif',
        email: 'clarisse.kouame@gimmo.ci',
        name: 'Clarisse Kouamé — Gérante Locative & Comptable',
        role: 'gerant',
      },
      {
        uid: 'gimmo-commercial-terrain',
        email: 'franck.kone@gimmo.ci',
        name: 'Franck Koné — Responsable Commercial & GPS',
        role: 'commercial',
      },
    ]);
  } catch (error) {
    console.error('Database query failed in ensureInitialUsers:', error);
  }
}

export async function getAllUsers(): Promise<AppUser[]> {
  try {
    await ensureInitialUsers();
    const rows = await db.select().from(users).orderBy(asc(users.id));
    return rows.map(mapRowToAppUser);
  } catch (error) {
    console.error('Database query failed in getAllUsers:', error);
    return [
      {
        id: 1,
        uid: 'gimmo-admin-principal',
        email: 'assamoighislain@gmail.com',
        name: 'Assamoi Ghislain — Direction Générale',
        role: 'administrateur',
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        uid: 'gimmo-gerant-locatif',
        email: 'clarisse.kouame@gimmo.ci',
        name: 'Clarisse Kouamé — Gérante Locative & Comptable',
        role: 'gerant',
      createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        uid: 'gimmo-commercial-terrain',
        email: 'franck.kone@gimmo.ci',
        name: 'Franck Koné — Responsable Commercial & GPS',
        role: 'commercial',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  requestedRole?: UserRole
): Promise<AppUser> {
  try {
    await ensureInitialUsers();

    // Vérifier d'abord si un utilisateur avec cet email existe déjà
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (byEmail.length > 0) {
      const existingUser = byEmail[0];
      const nextRole = requestedRole
        ? normalizeUserRole(requestedRole)
        : normalizeUserRole(existingUser.role);
      const updated = await db
        .update(users)
        .set({
          name: name || existingUser.name || email.split('@')[0],
          role: nextRole,
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return mapRowToAppUser(updated[0]);
    }

    const defaultRole: UserRole = requestedRole
      ? normalizeUserRole(requestedRole)
      : 'administrateur';

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
        role: defaultRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: name || email.split('@')[0],
          ...(requestedRole ? { role: normalizeUserRole(requestedRole) } : {}),
        },
      })
      .returning();

    return mapRowToAppUser(result[0]);
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
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
    await ensureInitialUsers();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim() || cleanEmail.split('@')[0];
    const cleanRole = normalizeUserRole(data.role);

    if (data.id) {
      const updated = await db
        .update(users)
        .set({
          email: cleanEmail,
          name: cleanName,
          role: cleanRole,
        })
        .where(eq(users.id, Number(data.id)))
        .returning();
      if (updated.length > 0) {
        return mapRowToAppUser(updated[0]);
      }
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail));

    if (existingByEmail.length > 0) {
      const updated = await db
        .update(users)
        .set({
          name: cleanName,
          role: cleanRole,
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return mapRowToAppUser(updated[0]);
    }

    const generatedUid = `gimmo-${cleanRole}-${Date.now()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid: generatedUid,
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
      })
      .returning();

    return mapRowToAppUser(inserted[0]);
  } catch (error) {
    console.error('Database query failed in upsertUserRecord:', error);
    throw new Error("Impossible d'enregistrer le compte utilisateur.", {
      cause: error,
    });
  }
}

export async function deleteUserRecord(userId: number): Promise<void> {
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (error) {
    console.error('Database query failed in deleteUserRecord:', error);
    throw new Error("Impossible de supprimer l'utilisateur.", { cause: error });
  }
}
