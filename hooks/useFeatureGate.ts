/**
 * React hook for feature gating.
 * 
 * Accepts the user profile from the parent (avoids creating a second useAuth listener).
 * Fetches the user's plan data from Firestore and provides
 * easy-to-use functions for checking capabilities and limits.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    canAccess as checkAccess,
    getLimit as checkLimit,
    isOverLimit as checkOverLimit,
    getRemainingUsage as checkRemaining,
    resolveAllCapabilities,
    type PlanData,
    type UserProfile as GateUserProfile,
} from '../lib/featureGate';
import type { UserProfile } from '../lib/userService';

export function useFeatureGate(profile: UserProfile | null | undefined) {
    const [planData, setPlanData] = useState<PlanData | null>(null);

    // Listen to the user's plan document in real-time
    useEffect(() => {
        if (!db) return;
        const planId = profile?.plan || 'free';
        const unsub = onSnapshot(doc(db, 'plans', planId), (snap) => {
            if (snap.exists()) {
                setPlanData(snap.data() as PlanData);
            }
        });
        return () => unsub();
    }, [profile?.plan]);

    const gateProfile: GateUserProfile | null = profile
        ? {
            plan: profile.plan,
            featureOverrides: (profile as any).featureOverrides,
            capabilityOverrides: (profile as any).capabilityOverrides,
            usage: (profile as any).usage,
        }
        : null;

    const capabilities = useMemo(
        () => resolveAllCapabilities(gateProfile, planData),
        [gateProfile, planData]
    );

    const canAccess = useCallback(
        (capability: string) => checkAccess(capability, gateProfile, planData),
        [gateProfile, planData]
    );

    return {
        isLoaded: planData !== null,
        planData,
        capabilities,
        canAccess,
        getLimit: (feature: string) => checkLimit(feature, gateProfile, planData),
        isOverLimit: (feature: string) => checkOverLimit(feature, gateProfile, planData),
        getRemainingUsage: (feature: string) => checkRemaining(feature, gateProfile, planData),
        currentPlan: profile?.plan || 'free',
    };
}
