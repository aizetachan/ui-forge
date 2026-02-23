import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    limit,
    serverTimestamp
} from 'firebase/firestore';

export type UserRole = 'master_admin' | 'admin' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type AuthProvider = 'github' | 'google' | 'password';

export interface UserProfile {
    uid: string;
    email: string;
    name: string;
    company?: string;
    avatarUrl: string;
    role: UserRole;
    status: UserStatus;
    authProvider: AuthProvider;
    createdAt: any;
    lastLoginAt: any;
}

const USERS_COLLECTION = 'users';

export const userService = {
    /**
     * Fetches a user's profile from Firestore.
     */
    async getUserProfile(uid: string): Promise<UserProfile | null> {
        try {
            const docRef = doc(db, USERS_COLLECTION, uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    },

    /**
     * Creates or updates a user profile after an OAuth login.
     * Enforces the 'first user is master_admin' rule.
     */
    async syncUserAfterLogin(
        uid: string,
        email: string | null,
        name: string | null,
        avatarUrl: string | null,
        provider: AuthProvider,
        company?: string
    ): Promise<UserProfile> {
        const docRef = doc(db, USERS_COLLECTION, uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // User exists, just update last login
            await setDoc(docRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            return (await getDoc(docRef)).data() as UserProfile;
        }

        // Enforce specific Master Admin email
        const isMaster = email && email.trim().toLowerCase() === 'santiago.fernandez@nakamateam.com';

        const newProfile: UserProfile = {
            uid,
            email: email || '',
            name: name || 'Unknown User',
            company: company || '',
            avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`,
            role: isMaster ? 'master_admin' : 'user',
            status: isMaster ? 'approved' : 'pending',
            authProvider: provider,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
        };

        await setDoc(docRef, newProfile);
        return newProfile;
    }
};
