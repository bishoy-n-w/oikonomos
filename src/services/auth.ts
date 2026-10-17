import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type UserCredential
} from 'firebase/auth';
import { auth } from './firebase';

export const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts';

// Stored OAuth Access Token for Google People API calls
let currentGoogleAccessToken: string | null = null;

export function getGoogleAccessToken(): string | null {
  if (!currentGoogleAccessToken) {
    currentGoogleAccessToken = localStorage.getItem('oikonomos_google_access_token');
  }
  return currentGoogleAccessToken;
}

export function setGoogleAccessToken(token: string | null): void {
  currentGoogleAccessToken = token;
  if (token) {
    localStorage.setItem('oikonomos_google_access_token', token);
  } else {
    localStorage.removeItem('oikonomos_google_access_token');
  }
}

export async function checkRedirectResult(): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const oauthCredential = GoogleAuthProvider.credentialFromResult(result);
      if (oauthCredential?.accessToken) {
        setGoogleAccessToken(oauthCredential.accessToken);
      }
    }
    return result;
  } catch (err) {
    console.warn('Redirect auth check error:', err);
    return null;
  }
}

export async function signInWithGoogle(options?: {
  forceSelect?: boolean;
  requestContactsScope?: boolean;
  useRedirect?: boolean;
}): Promise<UserCredential | void> {
  const provider = new GoogleAuthProvider();

  if (options?.forceSelect) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }

  if (options?.requestContactsScope) {
    provider.addScope(CONTACTS_SCOPE);
  }

  if (options?.useRedirect) {
    return await signInWithRedirect(auth, provider);
  }

  try {
    const credential = await signInWithPopup(auth, provider);
    const oauthCredential = GoogleAuthProvider.credentialFromResult(credential);
    if (oauthCredential?.accessToken) {
      setGoogleAccessToken(oauthCredential.accessToken);
    }
    return credential;
  } catch (err: any) {
    // If popup was blocked by browser, attempt redirect fallback
    if (err.code === 'auth/popup-blocked') {
      console.warn('Popup blocked, attempting signInWithRedirect fallback...');
      return await signInWithRedirect(auth, provider);
    }
    throw err;
  }
}

export async function requestContactsPermission(): Promise<string | null> {
  const provider = new GoogleAuthProvider();
  provider.addScope(CONTACTS_SCOPE);
  provider.setCustomParameters({ prompt: 'consent' });

  try {
    const credential = await signInWithPopup(auth, provider);
    const oauthCredential = GoogleAuthProvider.credentialFromResult(credential);
    if (oauthCredential?.accessToken) {
      setGoogleAccessToken(oauthCredential.accessToken);
      return oauthCredential.accessToken;
    }
  } catch (err) {
    console.error('Failed to request Google Contacts permission', err);
    throw err;
  }
  return null;
}

export async function signOut(): Promise<void> {
  setGoogleAccessToken(null);
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
