// Teacher domain router — replaces 31 individual Lambda functions with one bundled router.
// API Gateway sets event.routeKey to "METHOD /path" with {param} placeholders verbatim.
// esbuild bundles all imports into a single zip; no runtime module resolution issues.

// Schools
import { handler as schoolsList }                   from "../schools/list.js";
import { handler as schoolsCreate }                 from "../schools/create.js";
import { handler as schoolsGet }                    from "../schools/get.js";

// TeacherProfiles
import { handler as tpCreate }                      from "../teacher-profiles/create.js";
import { handler as tpGet }                         from "../teacher-profiles/get.js";
import { handler as tpListBySchool }                from "../teacher-profiles/list-by-school.js";

// Classes
import { handler as classesCreate }                 from "../classes/create.js";
import { handler as classesGet }                    from "../classes/get.js";
import { handler as classesGetByJoinCode }          from "../classes/get-by-join-code.js";
import { handler as classesListByTeacher }          from "../classes/list-by-teacher.js";
import { handler as classesListBySchool }           from "../classes/list-by-school.js";
import { handler as classesDeactivate }             from "../classes/deactivate.js";

// ClassEnrollments
import { handler as ceEnroll }                      from "../classEnrollments/enroll.js";
import { handler as ceUnenroll }                    from "../classEnrollments/unenroll.js";
import { handler as ceListByClass }                 from "../classEnrollments/list-by-class.js";
import { handler as ceListByStudent }               from "../classEnrollments/list-by-student.js";
import { handler as ceGet }                         from "../classEnrollments/get.js";

// QuestInstances
import { handler as qiCreate }                      from "../questInstances/create.js";
import { handler as qiGet }                         from "../questInstances/get.js";
import { handler as qiListByClass }                 from "../questInstances/list-by-class.js";
import { handler as qiListByTemplate }              from "../questInstances/list-by-template.js";
import { handler as qiUpdateStatus }                from "../questInstances/update-status.js";
import { handler as qiUpdateDates }                 from "../questInstances/update-dates.js";

// Guilds
import { handler as guildsCreate }                  from "../guilds/create.js";
import { handler as guildsGet }                     from "../guilds/get.js";
import { handler as guildsListByClass }             from "../guilds/list-by-class.js";
import { handler as guildsUpdate }                  from "../guilds/update.js";
import { handler as guildsDeactivate }              from "../guilds/deactivate.js";

// GuildMemberships
import { handler as gmUpsert }                      from "../guildMemberships/upsert-membership.js";
import { handler as gmGet }                         from "../guildMemberships/get.js";
import { handler as gmListByGuild }                 from "../guildMemberships/list-by-guild.js";
import { handler as gmListByStudent }               from "../guildMemberships/list-by-student.js";
import { handler as gmLeave }                       from "../guildMemberships/leave.js";

// Dispatch table: keys must exactly match the routeKey API Gateway sets on event.routeKey
const ROUTES: Record<string, (event: any) => Promise<any>> = {
    // Schools
    "GET /schools":                                                          schoolsList,
    "POST /schools":                                                         schoolsCreate,
    "GET /schools/{school_id}":                                              schoolsGet,

    // TeacherProfiles
    "POST /teacher-profiles":                                                tpCreate,
    "GET /teacher-profiles/{teacher_id}":                                    tpGet,
    "GET /schools/{school_id}/teachers":                                     tpListBySchool,

    // Classes
    "POST /classes":                                                         classesCreate,
    "GET /classes/{class_id}":                                               classesGet,
    "GET /classes/join/{join_code}":                                         classesGetByJoinCode,
    "GET /teachers/{teacher_id}/classes":                                    classesListByTeacher,
    "GET /schools/{school_id}/classes":                                      classesListBySchool,
    "PATCH /classes/{class_id}/deactivate":                                  classesDeactivate,

    // ClassEnrollments
    "POST /classes/{class_id}/enroll":                                       ceEnroll,
    "DELETE /enrollments/{enrollment_id}":                                   ceUnenroll,
    "GET /classes/{class_id}/students":                                      ceListByClass,
    "GET /students/{student_id}/classes":                                    ceListByStudent,
    "GET /enrollments/{enrollment_id}":                                      ceGet,

    // QuestInstances
    "POST /classes/{class_id}/quest-instances":                              qiCreate,
    "GET /quest-instances/{quest_instance_id}":                              qiGet,
    "GET /classes/{class_id}/quest-instances":                               qiListByClass,
    "GET /quest-templates/{quest_template_id}/quest-instances":              qiListByTemplate,
    "PATCH /quest-instances/{quest_instance_id}/status":                     qiUpdateStatus,
    "PATCH /quest-instances/{quest_instance_id}/dates":                      qiUpdateDates,

    // Guilds
    "POST /classes/{class_id}/guilds":                                       guildsCreate,
    "GET /guilds/{guild_id}":                                                guildsGet,
    "GET /classes/{class_id}/guilds":                                        guildsListByClass,
    "PATCH /guilds/{guild_id}":                                              guildsUpdate,
    "PATCH /guilds/{guild_id}/deactivate":                                   guildsDeactivate,

    // GuildMemberships
    "PUT /classes/{class_id}/guild-memberships/{student_id}":                gmUpsert,
    "GET /classes/{class_id}/guild-memberships/{student_id}":                gmGet,
    "GET /guilds/{guild_id}/members":                                        gmListByGuild,
    "GET /students/{student_id}/guild-memberships":                          gmListByStudent,
    "PATCH /classes/{class_id}/guild-memberships/{student_id}/leave":        gmLeave,
};

export const handler = async (event: any): Promise<any> => {
    const routeKey = event.routeKey as string;
    const fn = ROUTES[routeKey];
    if (!fn) {
        console.error("TeacherRouter: no handler for routeKey", routeKey);
        return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Not found", routeKey }),
        };
    }
    return fn(event);
};
