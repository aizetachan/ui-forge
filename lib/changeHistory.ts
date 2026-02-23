/**
 * ChangeHistory — Core engine for tracking all edits made in UI Forge.
 * 
 * Records every CSS, prop, and token change with previous/new values.
 * Provides undo/redo stack for Cmd+Z / Shift+Cmd+Z.
 * 
 * Designed to be extensible for:
 * - Pull diff review (compare snapshots vs remote)
 * - Activity timeline UI
 * - Collaboration features
 * - Analytics
 */

// ─── Types ───────────────────────────────────────────────────

export type ChangeType = 'css' | 'prop' | 'token';

export interface ChangeEntry {
    /** Unique identifier for this change */
    id: string;
    /** Type of change */
    type: ChangeType;
    /** When the change was made */
    timestamp: number;
    /** Component affected (null for token changes) */
    componentId?: string;
    componentName?: string;

    /** What was changed */
    target: {
        /** Absolute path to the file on disk */
        filePath: string;
        /** CSS selector (for css type changes) */
        selector?: string;
        /** Property name: CSS prop, forgecore prop, or token name */
        property: string;
    };

    /** Value before the change */
    previousValue: string;
    /** Value after the change */
    newValue: string;

    /** Human-readable label for UI display */
    label: string;
}

export interface FileSnapshot {
    /** Absolute path to the file */
    filePath: string;
    /** Full file content at capture time */
    content: string;
    /** When the snapshot was taken */
    capturedAt: number;
}

// ─── Engine ──────────────────────────────────────────────────

const MAX_HISTORY = 100; // Maximum undo steps

let idCounter = 0;
function generateId(): string {
    return `ch_${Date.now()}_${++idCounter}`;
}

export class ChangeHistory {
    private past: ChangeEntry[] = [];
    private future: ChangeEntry[] = [];
    private snapshots: Map<string, FileSnapshot> = new Map();
    private listeners: Set<() => void> = new Set();

    // ─── Stack Operations ────────────────────────────────────

    /**
     * Record a new change. Clears the redo stack.
     */
    push(entry: Omit<ChangeEntry, 'id' | 'timestamp'>): ChangeEntry {
        const fullEntry: ChangeEntry = {
            ...entry,
            id: generateId(),
            timestamp: Date.now(),
        };

        this.past.push(fullEntry);

        // Trim if exceeding max
        if (this.past.length > MAX_HISTORY) {
            this.past = this.past.slice(-MAX_HISTORY);
        }

        // Clear future (new action invalidates redo stack)
        this.future = [];

        this.notify();
        return fullEntry;
    }

    /**
     * Undo the last change. Returns the entry to revert, or null if nothing to undo.
     */
    undo(): ChangeEntry | null {
        const entry = this.past.pop();
        if (!entry) return null;

        this.future.push(entry);
        this.notify();
        return entry;
    }

    /**
     * Redo the last undone change. Returns the entry to re-apply, or null.
     */
    redo(): ChangeEntry | null {
        const entry = this.future.pop();
        if (!entry) return null;

        this.past.push(entry);
        this.notify();
        return entry;
    }

    // ─── Queries ─────────────────────────────────────────────

    get canUndo(): boolean {
        return this.past.length > 0;
    }

    get canRedo(): boolean {
        return this.future.length > 0;
    }

    get undoLabel(): string | null {
        const last = this.past[this.past.length - 1];
        return last ? last.label : null;
    }

    get redoLabel(): string | null {
        const next = this.future[this.future.length - 1];
        return next ? next.label : null;
    }

    /**
     * Get full history (past entries, oldest first)
     */
    getAll(): ChangeEntry[] {
        return [...this.past];
    }

    /**
     * Get number of changes made since repo load
     */
    get changeCount(): number {
        return this.past.length;
    }

    // ─── Snapshots ───────────────────────────────────────────

    /**
     * Store an initial file snapshot (called on repo parse)
     */
    setSnapshot(filePath: string, content: string): void {
        this.snapshots.set(filePath, {
            filePath,
            content,
            capturedAt: Date.now(),
        });
    }

    /**
     * Get a stored snapshot for a file
     */
    getSnapshot(filePath: string): FileSnapshot | undefined {
        return this.snapshots.get(filePath);
    }

    /**
     * Get all stored snapshots
     */
    getAllSnapshots(): FileSnapshot[] {
        return Array.from(this.snapshots.values());
    }

    /**
     * Check if a file has been modified since its snapshot
     */
    hasChangesForFile(filePath: string): boolean {
        return this.past.some(e => e.target.filePath === filePath);
    }

    /**
     * Get all changes for a specific file
     */
    getChangesForFile(filePath: string): ChangeEntry[] {
        return this.past.filter(e => e.target.filePath === filePath);
    }

    // ─── Lifecycle ───────────────────────────────────────────

    /**
     * Clear all history and snapshots (called on repo switch)
     */
    clear(): void {
        this.past = [];
        this.future = [];
        this.snapshots.clear();
        this.notify();
    }

    // ─── Subscription (for React re-renders) ─────────────────

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

// ─── Singleton Instance ──────────────────────────────────────

export const changeHistory = new ChangeHistory();

// ─── Helper: Build human-readable label ──────────────────────

export function buildChangeLabel(type: ChangeType, property: string, newValue: string, componentName?: string): string {
    const prop = property.replace(/([A-Z])/g, '-$1').toLowerCase();
    const truncatedValue = newValue.length > 20 ? newValue.substring(0, 20) + '…' : newValue;
    const prefix = componentName ? `${componentName}: ` : '';

    switch (type) {
        case 'css':
            return `${prefix}${prop}: ${truncatedValue}`;
        case 'prop':
            return `${prefix}${property} = ${truncatedValue}`;
        case 'token':
            return `${property}: ${truncatedValue}`;
    }
}
