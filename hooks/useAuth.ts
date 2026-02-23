import { useState, useEffect } from 'react';
import { auth, githubProvider, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { userService, UserProfile, AuthProvider } from '../lib/userService';

export interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    isLoading: boolean;
    error: string | null;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        isLoading: true,
        error: null
    });

    useEffect(() => {
        if (!auth) {
            // If Firebase is not configured, just stop loading and stay logged out
            setState({ user: null, profile: null, isLoading: false, error: "Firebase configuration is missing in .env.local" });
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Identify provider
                    const providerId = firebaseUser.providerData[0]?.providerId || '';
                    const provider: AuthProvider = providerId.includes('github') ? 'github' : 'google';

                    // Sync profile in Firestore
                    const profile = await userService.syncUserAfterLogin(
                        firebaseUser.uid,
                        firebaseUser.email,
                        firebaseUser.displayName,
                        firebaseUser.photoURL,
                        provider
                    );

                    setState({ user: firebaseUser, profile, isLoading: false, error: null });
                } catch (error: any) {
                    console.error("Error fetching/syncing profile:", error);
                    setState({ user: firebaseUser, profile: null, isLoading: false, error: "Failed to load user profile" });
                }
            } else {
                setState({ user: null, profile: null, isLoading: false, error: null });
            }
        });

        return () => unsubscribe();
    }, []);

    const loginWithGithub = async () => {
        if (!auth) return;
        try {
            setState(s => ({ ...s, isLoading: true, error: null }));
            await signInWithPopup(auth, githubProvider);
        } catch (error: any) {
            console.error("GitHub Login Error:", error);
            setState(s => ({ ...s, isLoading: false, error: error.message }));
        }
    };

    const loginWithGoogle = async () => {
        if (!auth) return;
        try {
            setState(s => ({ ...s, isLoading: true, error: null }));
            await signInWithPopup(auth, googleProvider);
        } catch (error: any) {
            console.error("Google Login Error:", error);
            setState(s => ({ ...s, isLoading: false, error: error.message }));
        }
    };

    const logout = async () => {
        if (!auth) return;
        try {
            setState(s => ({ ...s, isLoading: true }));
            await firebaseSignOut(auth);
        } catch (error: any) {
            console.error("Logout Error:", error);
            setState(s => ({ ...s, isLoading: false, error: error.message }));
        }
    };

    return {
        ...state,
        loginWithGithub,
        loginWithGoogle,
        logout
    };
}
