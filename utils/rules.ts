/**
 * Rules Summaries Utility
 * Handles syncing AI-generated rules from Supabase to local SQLite for offline access
 */

import { getDatabase } from './database';
import { supabase } from './matchplay';

export interface MachineRules {
    opdb_id: string;
    summary: string;
    key_shots: string[];
    modes: string[];
    scoring_tips: string;
    updated_at?: string;
}

/**
 * Sync all rules summaries from Supabase to local SQLite
 * Call this on app startup or periodically to keep cache fresh
 */
export async function syncRulesSummaries(): Promise<number> {
    try {
        // Paginate because Supabase has a default limit of 1000 rows
        let allRules: any[] = [];
        let page = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabase
                .from('machine_rules')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('Failed to fetch rules from Supabase:', error);
                return 0;
            }

            if (!data || data.length === 0) break;

            allRules = [...allRules, ...data];

            if (data.length < pageSize) break; // Last page
            page++;
        }

        if (allRules.length === 0) {
            console.log('No rules summaries found in Supabase');
            return 0;
        }

        const db = await getDatabase();
        let syncedCount = 0;

        for (const rule of allRules) {
            try {
                await db.runAsync(
                    `INSERT OR REPLACE INTO machine_rules 
                     (opdb_id, summary, key_shots, modes, scoring_tips, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    rule.opdb_id,
                    rule.summary,
                    JSON.stringify(rule.key_shots || []),
                    JSON.stringify(rule.modes || []),
                    rule.scoring_tips || '',
                    rule.updated_at || new Date().toISOString()
                );
                syncedCount++;
            } catch (e) {
                console.error(`Failed to sync rule for ${rule.opdb_id}:`, e);
            }
        }

        console.log(`Synced ${syncedCount} rules summaries to local cache`);
        return syncedCount;
    } catch (e) {
        console.error('syncRulesSummaries error:', e);
        return 0;
    }
}

/**
 * Get cached rules summary for a specific machine
 * Returns null if no summary exists
 */
export async function getRulesSummary(opdb_id: string): Promise<MachineRules | null> {
    try {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{
            opdb_id: string;
            summary: string;
            key_shots: string;
            modes: string;
            scoring_tips: string;
            updated_at: string;
        }>(
            'SELECT * FROM machine_rules WHERE opdb_id = ?',
            opdb_id
        );

        if (!result) {
            return null;
        }

        return {
            opdb_id: result.opdb_id,
            summary: result.summary,
            key_shots: JSON.parse(result.key_shots || '[]'),
            modes: JSON.parse(result.modes || '[]'),
            scoring_tips: result.scoring_tips,
            updated_at: result.updated_at
        };
    } catch (e) {
        console.error('getRulesSummary error:', e);
        return null;
    }
}

/**
 * Check if we have any cached rules
 */
export async function hasLocalRules(): Promise<boolean> {
    try {
        const db = await getDatabase();
        const result = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM machine_rules'
        );
        return (result?.count || 0) > 0;
    } catch {
        return false;
    }
}
