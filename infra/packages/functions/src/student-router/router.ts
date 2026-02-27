// Student domain router — replaces 8 individual Lambda functions with one bundled router.
// API Gateway sets event.routeKey to "METHOD /path" with {param} placeholders verbatim.
// esbuild bundles all imports into a single zip; no runtime module resolution issues.

// StudentProfiles
import { handler as spCreate }          from "../student-profiles/create.js";
import { handler as spGet }             from "../student-profiles/get.js";
import { handler as spUpdate }          from "../student-profiles/update.js";
import { handler as spListBySchool }    from "../student-profiles/list-by-school.js";
import { handler as spSetPassword }     from "../student-profiles/set-password.js";

// PlayerStates
import { handler as psUpsert }          from "../playerStates/upsert-state.js";
import { handler as psGet }             from "../playerStates/get.js";
import { handler as psLeaderboard }     from "../playerStates/get-leaderboard.js";

// Dispatch table: keys must exactly match the routeKey API Gateway sets on event.routeKey
const ROUTES: Record<string, (event: any) => Promise<any>> = {
    // StudentProfiles
    "POST /student-profiles":                                          spCreate,
    "GET /student-profiles/{student_id}":                              spGet,
    "PATCH /student-profiles/{student_id}":                            spUpdate,
    "GET /schools/{school_id}/students":                               spListBySchool,
    "POST /students/{student_id}/set-password":                        spSetPassword,

    // PlayerStates
    "PUT /classes/{class_id}/players/{student_id}/state":              psUpsert,
    "GET /classes/{class_id}/players/{student_id}/state":              psGet,
    "GET /classes/{class_id}/leaderboard":                             psLeaderboard,
};

export const handler = async (event: any): Promise<any> => {
    const routeKey = event.routeKey as string;
    const fn = ROUTES[routeKey];
    if (!fn) {
        console.error("StudentRouter: no handler for routeKey", routeKey);
        return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Not found", routeKey }),
        };
    }
    return fn(event);
};
