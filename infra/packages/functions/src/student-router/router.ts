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

// RewardMilestones (student view)
import { handler as rmStudentList }     from "../rewardMilestones/list-student-rewards.js";

// StudentRewardClaims (student routes)
import { handler as srcListByStudent }  from "../studentRewardClaims/list-by-student.js";
import { handler as srcClaimReward }    from "../studentRewardClaims/claim-reward.js";
import { handler as srcRewardsState }   from "../studentRewardClaims/rewards-state.js";

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

    // RewardMilestones (student view)
    "GET /student/classes/{class_id}/rewards":                         rmStudentList,

    // StudentRewardClaims (student routes)
    "GET /student/classes/{class_id}/reward-claims":                   srcListByStudent,
    "POST /student/rewards/{reward_id}/claim":                         srcClaimReward,
    "GET /student/classes/{class_id}/rewards-state":                   srcRewardsState,
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
