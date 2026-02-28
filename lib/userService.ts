import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    limit,
    serverTimestamp
} from 'firebase/firestore';

export type UserRole = 'master_admin' | 'admin' | 'free' | 'user';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type AuthProvider = 'github' | 'google' | 'password';

export interface ConnectedProvider {
    provider: AuthProvider;
    uid: string;         // Firebase Auth UID for this provider
    connectedAt: any;
}

export interface UserProfile {
    uid: string;          // Primary UID (first provider used)
    email: string;
    name: string;
    company?: string;
    avatarUrl: string;
    role: UserRole;
    plan?: string;        // Subscription plan: free | pro | team | enterprise
    status: UserStatus;
    authProvider: AuthProvider;           // Original sign-up provider
    connectedProviders: ConnectedProvider[];  // All linked providers
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
            // Also check if this UID is a secondary provider on another profile
            return await this.findProfileByProviderUid(uid);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    },

    /**
     * Find a profile where this UID appears in connectedProviders.
     */
    async findProfileByProviderUid(uid: string): Promise<UserProfile | null> {
        try {
            const q = query(collection(db, USERS_COLLECTION));
            const snapshot = await getDocs(q);
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data() as UserProfile;
                if (data.connectedProviders?.some(p => p.uid === uid)) {
                    return data;
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding profile by provider UID:', error);
            return null;
        }
    },

    /**
     * Find a profile by email address.
     */
    async findProfileByEmail(email: string): Promise<UserProfile | null> {
        try {
            const q = query(
                collection(db, USERS_COLLECTION),
                where('email', '==', email),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return snapshot.docs[0].data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error('Error finding profile by email:', error);
            return null;
        }
    },

    /**
     * Creates or updates a user profile after an OAuth login.
     * If the email already exists under a different UID, links the new provider
     * to the existing profile instead of creating a duplicate.
     */
    async syncUserAfterLogin(
        uid: string,
        email: string | null,
        name: string | null,
        avatarUrl: string | null,
        provider: AuthProvider,
        company?: string
    ): Promise<UserProfile> {
        // 1. Check if this UID already has a profile
        const docRef = doc(db, USERS_COLLECTION, uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // User exists — update last login, refresh name/avatar, ensure provider is in connectedProviders
            const existing = docSnap.data() as UserProfile;
            const providers = existing.connectedProviders || [];
            const alreadyConnected = providers.some(p => p.uid === uid && p.provider === provider);

            if (!alreadyConnected) {
                providers.push({ provider, uid, connectedAt: new Date().toISOString() });
            }

            // Refresh name, email, and avatar if they were missing or stale
            const updates: Record<string, any> = {
                lastLoginAt: serverTimestamp(),
                connectedProviders: providers,
            };

            if (name && (existing.name === 'Unknown User' || !existing.name)) {
                updates.name = name;
            }
            if (email && !existing.email) {
                updates.email = email;
            }
            if (avatarUrl && (!existing.avatarUrl || existing.avatarUrl.includes('ui-avatars.com'))) {
                updates.avatarUrl = avatarUrl;
            }

            await setDoc(docRef, updates, { merge: true });

            return (await getDoc(docRef)).data() as UserProfile;
        }

        // 2. Check if email already exists under a different profile (email linking)
        if (email) {
            const existingByEmail = await this.findProfileByEmail(email);
            if (existingByEmail) {
                // Link this new provider to the existing profile
                const providers = existingByEmail.connectedProviders || [];
                const alreadyConnected = providers.some(p => p.uid === uid && p.provider === provider);

                if (!alreadyConnected) {
                    providers.push({ provider, uid, connectedAt: new Date().toISOString() });
                }

                const existingDocRef = doc(db, USERS_COLLECTION, existingByEmail.uid);
                await setDoc(existingDocRef, {
                    lastLoginAt: serverTimestamp(),
                    connectedProviders: providers
                }, { merge: true });

                console.log(`[UserService] Linked ${provider} (${uid}) to existing profile ${existingByEmail.uid} by email ${email}`);
                return (await getDoc(existingDocRef)).data() as UserProfile;
            }
        }

        // 3. Brand new user — create profile
        const newProfile: UserProfile = {
            uid,
            email: email || '',
            name: name || 'Unknown User',
            company: company || '',
            avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`,
            role: 'free',
            status: 'approved',
            authProvider: provider,
            connectedProviders: [
                { provider, uid, connectedAt: new Date().toISOString() }
            ],
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
        };

        await setDoc(docRef, newProfile);
        return newProfile;
    }
};
