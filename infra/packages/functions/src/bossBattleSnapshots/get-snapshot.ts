/**
 * GET /bossBattleSnapshots/{snapshot_id}
 * Get snapshot by ID
 */

import { getSnapshot } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const snapshotId = event.pathParameters?.snapshot_id;
        if (!snapshotId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "snapshot_id is required" }),
            };
        }

        // TODO: Authorization - TEACHER only (or students if showing roster)

        const snapshot = await getSnapshot(snapshotId);

        if (!snapshot) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Snapshot not found" }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(snapshot),
        };
    } catch (error: any) {
        console.error("Error getting snapshot:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};
