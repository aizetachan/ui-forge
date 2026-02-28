/**
 * Feature Gate Service
 * 
 * Resolves whether a user can access a platform capability or has
 * remaining usage for a feature limit. Uses the priority chain:
 *   1. user.featureOverrides (per-user admin overrides)
 *   2. plan.capabilities / plan.features (plan defaults)
 * 
 * Usage:
 *   const gate = useFeatureGate();
 *   if (!gate.canAccess('aiChat')) showUpgradePrompt();
 *   if (gate.isOverLimit('aiMessages')) showLimitReached();
 */

export interface PlanData {
    name: string;
    tier: number;
    features: Record<string, { enabled: boolean; limit: number }>;
    capabilities: Record<string, boolean>;
}

export interface UserProfile {
    plan?: string;
    featureOverrides?: Record<string, { enabled?: boolean; limit?: number }>;
    capabilityOverrides?: Record<string, boolean>;
    usage?: Record<string, number>;
}

/**
 * Check if a user can access a platform capability.
 * Priority: capabilityOverrides > plan.capabilities
 */
export function canAccess(
    capability: string,
    profile: UserProfile | null,
    planData: PlanData | null
): boolean {
    if (!profile || !planData) return false;

    // Check user-level capability overrides first
    if (profile.capabilityOverrides && capability in profile.capabilityOverrides) {
        return profile.capabilityOverrides[capability];
    }

    // Fall back to plan capabilities
    return planData.capabilities?.[capability] ?? false;
}

/**
 * Get the limit for a numeric feature.
 * Priority: featureOverrides > plan.features
 */
export function getLimit(
    feature: string,
    profile: UserProfile | null,
    planData: PlanData | null
): { enabled: boolean; limit: number } {
    if (!profile || !planData) return { enabled: false, limit: 0 };

    // Check user-level feature overrides first
    if (profile.featureOverrides && feature in profile.featureOverrides) {
        const override = profile.featureOverrides[feature];
        const planFeature = planData.features?.[feature] || { enabled: false, limit: 0 };
        return {
            enabled: override.enabled ?? planFeature.enabled,
            limit: override.limit ?? planFeature.limit,
        };
    }

    // Fall back to plan features
    return planData.features?.[feature] || { enabled: false, limit: 0 };
}

/**
 * Check if user has exceeded their usage for a feature.
 */
export function isOverLimit(
    feature: string,
    profile: UserProfile | null,
    planData: PlanData | null
): boolean {
    const { enabled, limit } = getLimit(feature, profile, planData);
    if (!enabled) return true;
    if (limit >= 99999999) return false; // unlimited

    const currentUsage = profile?.usage?.[feature] ?? 0;
    return currentUsage >= limit;
}

/**
 * Get remaining usage for a feature.
 */
export function getRemainingUsage(
    feature: string,
    profile: UserProfile | null,
    planData: PlanData | null
): number {
    const { enabled, limit } = getLimit(feature, profile, planData);
    if (!enabled) return 0;
    if (limit >= 99999999) return Infinity;

    const currentUsage = profile?.usage?.[feature] ?? 0;
    return Math.max(0, limit - currentUsage);
}

/**
 * Get all capabilities resolved for a user.
 */
export function resolveAllCapabilities(
    profile: UserProfile | null,
    planData: PlanData | null
): Record<string, boolean> {
    if (!planData) return {};

    const resolved: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(planData.capabilities || {})) {
        resolved[key] = value;
    }

    // Apply user overrides
    if (profile?.capabilityOverrides) {
        for (const [key, value] of Object.entries(profile.capabilityOverrides)) {
            resolved[key] = value;
        }
    }

    return resolved;
}
