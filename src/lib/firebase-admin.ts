import fs from 'fs';
import path from 'path';

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT.trim();
  }
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed?.projectId) {
        return String(parsed.projectId);
      }
    }
  } catch {
    // Ignore missing/unreadable local config in serverless environments
  }
  return undefined;
}

export async function getAdminAuth() {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : undefined);
  }
  return getAuth();
}
