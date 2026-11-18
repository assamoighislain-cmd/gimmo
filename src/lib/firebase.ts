import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export { firebaseConfig };

export interface DomainAuthCheckResult {
  authorized: boolean;
  currentDomain: string;
  authorizedDomains: string[];
  projectId: string;
  firebaseSettingsUrl: string;
}

export async function checkCurrentDomainAuthorized(): Promise<DomainAuthCheckResult> {
  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname.trim() : '';
  const projectId = firebaseConfig.projectId || '';
  const firebaseSettingsUrl = projectId
    ? `https://console.firebase.google.com/project/${encodeURIComponent(projectId)}/authentication/settings`
    : 'https://console.firebase.google.com/';

  if (!currentDomain || !firebaseConfig.apiKey) {
    return {
      authorized: true,
      currentDomain,
      authorizedDomains: [],
      projectId,
      firebaseSettingsUrl,
    };
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return {
        authorized: true,
        currentDomain,
        authorizedDomains: [],
        projectId,
        firebaseSettingsUrl,
      };
    }

    const data = (await res.json()) as { authorizedDomains?: string[] };
    const authorizedDomains = Array.isArray(data?.authorizedDomains)
      ? data.authorizedDomains.map((d) => String(d).trim().toLowerCase())
      : [];

    if (authorizedDomains.length === 0) {
      return {
        authorized: true,
        currentDomain,
        authorizedDomains: [],
        projectId,
        firebaseSettingsUrl,
      };
    }

    const normalizedHost = currentDomain.toLowerCase();
    const authorized = authorizedDomains.includes(normalizedHost);

    return {
      authorized,
      currentDomain,
      authorizedDomains,
      projectId,
      firebaseSettingsUrl,
    };
  } catch {
    return {
      authorized: true,
      currentDomain,
      authorizedDomains: [],
      projectId,
      firebaseSettingsUrl,
    };
  }
}

export function isFirebaseUnauthorizedDomainError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string } | null;
  const code = String(anyErr?.code || '');
  const message = String(anyErr?.message || '');
  return (
    code === 'auth/unauthorized-domain' ||
    message.includes('auth/unauthorized-domain')
  );
}

export function formatFirebaseAuthErrorFr(err: unknown): string {
  const anyErr = err as { code?: string; message?: string } | null;
  const code = String(anyErr?.code || '');
  const message = String(anyErr?.message || '');
  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname : 'ce domaine';

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return '';
  }

  if (isFirebaseUnauthorizedDomainError(err)) {
    return `Le domaine « ${currentDomain} » n’est pas encore déclaré dans les Domaines autorisés de Firebase Authentication (projet ${firebaseConfig.projectId}). Ajoutez « ${currentDomain} » dans la console Firebase ou connectez-vous directement ci-dessus par Email et Mot de passe.`;
  }

  if (code === 'auth/popup-blocked') {
    return 'La fenêtre pop-up Google a été bloquée par votre navigateur. Autorisez les fenêtres pop-up pour ce site ou connectez-vous par Email et Mot de passe.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Erreur réseau lors de la communication avec Google. Vérifiez votre connexion Internet ou connectez-vous par Email et Mot de passe.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'La connexion Google n’est pas activée dans Firebase Authentication pour ce projet.';
  }

  return message || 'Erreur lors de la connexion avec Google.';
}
