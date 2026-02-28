import { useState, useEffect, useRef } from 'react';
import { auth, githubProvider, googleProvider } from '../lib/firebase';
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    GithubAuthProvider,
    signInWithCredential,
    User
} from 'firebase/auth';
import { userService, UserProfile, AuthProvider } from '../lib/userService';

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;

export interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    error: string | null;
}

/** Map Firebase error codes to human-readable messages */
function friendlyAuthError(error: any): string {
    const code = error?.code || '';
    switch (code) {
        case 'auth/account-exists-with-different-credential':
            return 'This email is already linked to a different sign-in method. Try the other provider instead.';
        case 'auth/popup-closed-by-user':
            return 'Sign-in was cancelled.';
        case 'auth/cancelled-popup-request':
            return 'Sign-in was cancelled.';
        case 'auth/popup-blocked':
            return 'Popup was blocked. Please allow popups for this app.';
        default:
            return error?.message || 'Authentication failed.';
    }
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        isLoading: true,
        error: null
    });

    // Guard against stale async callbacks overwriting fresh state
    const currentUidRef = useRef<string | null>(null);

    // Stash OAuth info decoded from id_token BEFORE signInWithCredential fires
    // onAuthStateChanged, since firebaseUser fields can be null in Electron.
    const pendingOAuthInfoRef = useRef<{ email?: string; name?: string; photoURL?: string } | null>(null);

    useEffect(() => {
        if (!auth) {
            setState({ user: null, profile: null, isLoading: false, error: "Firebase configuration is missing in .env.local" });
            return;
        }

        let unsubscribeProfile: (() => void) | null = null;

        // Add a safety timeout to prevent infinite Skeletons if Firebase hangs
        const timeoutId = setTimeout(() => {
            console.warn("[useAuth] Firebase Auth initialization timed out after 5 seconds!");
            setState(s => s.isLoading ? { ...s, isLoading: false, error: 'Auth Initialization Timeout - Clear site data or check IndexedDB' } : s);
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeoutId);
            console.log("[useAuth] onAuthStateChanged fired. User:", firebaseUser?.uid || 'null');
            // Track the current user's UID to prevent race conditions
            const uid = firebaseUser?.uid ?? null;
            currentUidRef.current = uid;

            // Clean up previous profile listener
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }

            if (firebaseUser) {
                try {
                    const providerInfo = firebaseUser.providerData?.[0] || null;
                    const providerId = providerInfo?.providerId || firebaseUser.providerId || '';
                    const provider: AuthProvider = providerId.includes('github') ? 'github' : 'google';

                    const pending = pendingOAuthInfoRef.current;
                    const email = firebaseUser.email || providerInfo?.email || pending?.email || null;
                    const displayName = firebaseUser.displayName || providerInfo?.displayName || pending?.name || null;
                    const photoURL = firebaseUser.photoURL || providerInfo?.photoURL || pending?.photoURL || null;
                    pendingOAuthInfoRef.current = null; // Clear after use

                    console.log("[useAuth] Attempting to sync profile...");
                    const profile = await userService.syncUserAfterLogin(
                        firebaseUser.uid,
                        email,
                        displayName,
                        photoURL,
                        provider
                    );
                    console.log("[useAuth] Profile sync successful:", profile.uid);

                    if (currentUidRef.current === uid) {
                        setState({ user: firebaseUser, profile, isLoading: false, error: null });
                    }

                    const { doc: firestoreDoc, onSnapshot: firestoreOnSnapshot } = await import('firebase/firestore');
                    const { db } = await import('../lib/firebase');
                    const userDocRef = firestoreDoc(db, 'users', profile.uid);
                    unsubscribeProfile = firestoreOnSnapshot(userDocRef, (snap) => {
                        if (snap.exists() && currentUidRef.current === uid) {
                            const updatedProfile = snap.data() as UserProfile;
                            setState(prev => ({ ...prev, profile: updatedProfile }));
                        }
                    });
                } catch (error: any) {
                    console.error("[useAuth] Error fetching/syncing profile:", error);
                    if (currentUidRef.current === uid) {
                        setState({ user: firebaseUser, profile: null, isLoading: false, error: error.message });
                    }
                }
            } else {
                if (currentUidRef.current === uid) {
                    setState({ user: null, profile: null, isLoading: false, error: null });
                }
            }
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    /**
     * In Electron: use IPC to open the auth page in the system browser,
     * capture the OAuth token, and use signInWithCredential.
     * In web: use signInWithPopup (works fine without COOP issues).
     */
    const electronOAuthSignIn = async (providerId: string, scopes: string) => {
        if (!auth) return;

        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
        const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        const electronAPI = (window as any).electronAPI;
        const result = await electronAPI.auth.oauthSignIn({ authDomain, apiKey, providerId, scopes, googleClientId });

        if (!result.success) {
            throw new Error(result.error || 'OAuth sign-in failed');
        }

        // Build Firebase credential from the OAuth token
        let credential;
        if (providerId === 'google.com') {
            credential = GoogleAuthProvider.credential(result.idToken || null, result.accessToken || null);

            // Pre-decode Google id_token BEFORE signInWithCredential so that
            // onAuthStateChanged has access to email/name/photo via the ref.
            if (result.idToken) {
                try {
                    const payload = JSON.parse(atob(result.idToken.split('.')[1]));
                    pendingOAuthInfoRef.current = {
                        email: payload.email || undefined,
                        name: payload.name || undefined,
                        photoURL: payload.picture || undefined,
                    };
                    console.log('[Auth] Pre-decoded id_token:', payload.email, payload.name);
                } catch (e) {
                    console.warn('[Auth] Failed to pre-decode id_token:', e);
                }
            }
        } else if (providerId === 'github.com') {
            credential = GithubAuthProvider.credential(result.accessToken || '');
        } else {
            throw new Error(`Unsupported provider: ${providerId}`);
        }

        // Sign in with the credential — this triggers onAuthStateChanged
        const userCredential = await signInWithCredential(auth, credential);

        // For Google: also update the Firebase Auth profile if fields are missing
        if (providerId === 'google.com' && result.idToken && userCredential.user) {
            try {
                const payload = JSON.parse(atob(result.idToken.split('.')[1]));
                const needsUpdate = !userCredential.user.displayName || !userCredential.user.photoURL;
                if (needsUpdate) {
                    const { updateProfile } = await import('firebase/auth');
                    await updateProfile(userCredential.user, {
                        displayName: payload.name || userCredential.user.displayName || null,
                        photoURL: payload.picture || userCredential.user.photoURL || null,
                    });
                    console.log('[Auth] Updated Firebase user profile from id_token:', payload.name, payload.picture);
                }
            } catch (e) {
                console.warn('[Auth] Failed to decode id_token for profile update:', e);
            }
        }
    };

    const loginWithGithub = async () => {
        if (!auth) return;
        try {
            setState(s => ({ ...s, isLoading: true, error: null }));
            await signInWithPopup(auth, githubProvider);
        } catch (error: any) {
            console.error("GitHub Login Error:", error);
            const msg = friendlyAuthError(error);
            setState(s => ({ ...s, isLoading: false, error: msg }));
        }
    };

    const loginWithGoogle = async () => {
        if (!auth) return;
        try {
            setState(s => ({ ...s, isLoading: true, error: null }));
            if (isElectron) {
                await electronOAuthSignIn('google.com', 'openid,profile,email');
            } else {
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error: any) {
            console.error("Google Login Error:", error);
            // Silent cancel — don't show error notification
            if (error?.message === '__cancelled__') {
                setState(s => ({ ...s, isLoading: false, error: null }));
                return;
            }
            const msg = friendlyAuthError(error);
            setState(s => ({ ...s, isLoading: false, error: msg }));
        }
    };

    const cancelAuth = async () => {
        // Cancel an in-progress Electron OAuth flow (Google tab)
        if (isElectron) {
            try {
                await (window as any).electronAPI.auth.oauthCancel();
            } catch (e) {
                // Ignore — may not have a pending flow
            }
        }
        setState(s => ({ ...s, isLoading: false, error: null }));
    };

    const logout = async () => {
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
            // onAuthStateChanged will handle setting state to null
        } catch (error: any) {
            console.error("Logout Error:", error);
            setState(s => ({ ...s, isLoading: false, error: error.message }));
        }
    };

    return {
        ...state,
        loginWithGithub,
        loginWithGoogle,
        cancelAuth,
        logout
    };
}
