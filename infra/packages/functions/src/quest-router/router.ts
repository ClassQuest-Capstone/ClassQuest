// Quest domain router — replaces 58 individual Lambda functions with one bundled router.
// API Gateway sets event.routeKey to "METHOD /path" (e.g. "GET /health"),
// including path parameter placeholders verbatim (e.g. "GET /quest-templates/{quest_template_id}").
// esbuild bundles all imports into a single zip; no runtime module resolution issues.

import { handler as healthHandler }            from "../health.js";
import { handler as debugCreateHandler }       from "../debug-create.js";

// QuestTemplates
import { handler as qtCreate }                 from "../questTemplates/create.js";
import { handler as qtListPublic }             from "../questTemplates/list-public.js";
import { handler as qtGet }                    from "../questTemplates/get.js";
import { handler as qtListByOwner }            from "../questTemplates/list-by-owner.js";
import { handler as qtUpdate }                 from "../questTemplates/update.js";
import { handler as qtSoftDelete }             from "../questTemplates/soft-delete.js";

// QuestQuestions
import { handler as qqCreate }                 from "../questQuestions/create.js";
import { handler as qqListByTemplate }         from "../questQuestions/list-by-template.js";
import { handler as qqGet }                    from "../questQuestions/get.js";
import { handler as qqUpdate }                 from "../questQuestions/update.js";
import { handler as qqDelete }                 from "../questQuestions/delete.js";

// QuestQuestionResponses
import { handler as qrUpsert }                 from "../questQuestionResponses/upsert-response.js";
import { handler as qrGetByInstanceAndStudent } from "../questQuestionResponses/get-by-instance-and-student.js";
import { handler as qrListByInstance }         from "../questQuestionResponses/list-by-instance.js";
import { handler as qrListByStudent }          from "../questQuestionResponses/list-by-student.js";
import { handler as qrListByQuestion }         from "../questQuestionResponses/list-by-question.js";
import { handler as qrGrade }                  from "../questQuestionResponses/grade-response.js";
import { handler as qrMarkRewardApplied }      from "../questQuestionResponses/mark-reward-applied.js";
import { handler as qrMarkRewardReversed }     from "../questQuestionResponses/mark-reward-reversed.js";

// BossQuestions
import { handler as bqCreate }                 from "../bossQuestions/create.js";
import { handler as bqGet }                    from "../bossQuestions/get.js";
import { handler as bqListByTemplate }         from "../bossQuestions/list-by-template.js";
import { handler as bqUpdate }                 from "../bossQuestions/update.js";
import { handler as bqDelete }                 from "../bossQuestions/delete.js";

// BossBattleTemplates
import { handler as bbtCreate }                from "../bossBattleTemplates/create.js";
import { handler as bbtGet }                   from "../bossBattleTemplates/get.js";
import { handler as bbtListByOwner }           from "../bossBattleTemplates/list-by-owner.js";
import { handler as bbtListPublic }            from "../bossBattleTemplates/list-public.js";

// RewardTransactions
import { handler as rtCreate }                 from "../rewardTransactions/create-transaction.js";
import { handler as rtGet }                    from "../rewardTransactions/get-transaction.js";
import { handler as rtListByStudent }          from "../rewardTransactions/list-by-student.js";
import { handler as rtListByStudentAndClass }  from "../rewardTransactions/list-by-student-and-class.js";
import { handler as rtListBySource }           from "../rewardTransactions/list-by-source.js";

// QuestAnswerAttempts
import { handler as qaCreate }                 from "../questAnswerAttempts/create-attempt.js";
import { handler as qaListByPK }               from "../questAnswerAttempts/list-by-pk.js";
import { handler as qaListByGSI1 }             from "../questAnswerAttempts/list-by-gsi1.js";
import { handler as qaListByGSI2 }             from "../questAnswerAttempts/list-by-gsi2.js";
import { handler as qaGrade }                  from "../questAnswerAttempts/grade-attempt.js";

// BossBattleInstances
import { handler as bbiCreate }                from "../bossBattleInstances/create.js";
import { handler as bbiGet }                   from "../bossBattleInstances/get.js";
import { handler as bbiListByClass }           from "../bossBattleInstances/list-by-class.js";
import { handler as bbiListByTemplate }        from "../bossBattleInstances/list-by-template.js";
import { handler as bbiUpdate }                from "../bossBattleInstances/update.js";

// BossBattleParticipants
import { handler as bbpJoin }                  from "../bossBattleParticipants/join.js";
import { handler as bbpSpectate }              from "../bossBattleParticipants/spectate.js";
import { handler as bbpLeave }                 from "../bossBattleParticipants/leave.js";
import { handler as bbpList }                  from "../bossBattleParticipants/list.js";
import { handler as bbpKick }                  from "../bossBattleParticipants/kick.js";

// BossAnswerAttempts
import { handler as baaListByBattle }          from "../bossAnswerAttempts/list-by-battle.js";
import { handler as baaListByStudent }         from "../bossAnswerAttempts/list-by-student.js";

// BossResults
import { handler as brGetResults }             from "../bossResults/get-results.js";
import { handler as brListByStudent }          from "../bossResults/list-by-student.js";
import { handler as brCompute }                from "../bossResults/compute.js";

// BossBattleSnapshots
import { handler as bbsCreate }                from "../bossBattleSnapshots/create-snapshot.js";
import { handler as bbsGet }                   from "../bossBattleSnapshots/get-snapshot.js";

// BossBattleQuestionPlans
import { handler as bbqpGet }                  from "../bossBattleQuestionPlans/get-plan.js";

// Dispatch table: keys must exactly match the routeKey API Gateway sets on event.routeKey
// Format: "METHOD /path" with {param} placeholders verbatim
const ROUTES: Record<string, (event: any) => Promise<any>> = {
    // Health & debug
    "GET /health":                                                                                                                           healthHandler,
    "POST /debug/create":                                                                                                                    debugCreateHandler,

    // QuestTemplates
    "POST /quest-templates":                                                                                                                 qtCreate,
    "GET /quest-templates/public":                                                                                                           qtListPublic,
    "GET /quest-templates/{quest_template_id}":                                                                                              qtGet,
    "GET /teachers/{teacher_id}/quest-templates":                                                                                            qtListByOwner,
    "PATCH /quest-templates/{quest_template_id}":                                                                                            qtUpdate,
    "PATCH /quest-templates/{quest_template_id}/soft-delete":                                                                               qtSoftDelete,

    // QuestQuestions
    "POST /quest-templates/{template_id}/questions":                                                                                         qqCreate,
    "GET /quest-templates/{template_id}/questions":                                                                                          qqListByTemplate,
    "GET /quest-questions/{question_id}":                                                                                                    qqGet,
    "PATCH /quest-questions/{question_id}":                                                                                                  qqUpdate,
    "DELETE /quest-questions/{question_id}":                                                                                                 qqDelete,

    // QuestQuestionResponses
    "PUT /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}":                                               qrUpsert,
    "GET /quest-instances/{quest_instance_id}/responses/{student_id}":                                                                       qrGetByInstanceAndStudent,
    "GET /quest-instances/{quest_instance_id}/responses":                                                                                    qrListByInstance,
    "GET /students/{student_id}/responses":                                                                                                  qrListByStudent,
    "GET /questions/{question_id}/responses":                                                                                                qrListByQuestion,
    "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade":                                       qrGrade,
    "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-applied":                         qrMarkRewardApplied,
    "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-reversed":                        qrMarkRewardReversed,

    // BossQuestions
    "POST /boss-templates/{boss_template_id}/questions":                                                                                     bqCreate,
    "GET /boss-questions/{question_id}":                                                                                                     bqGet,
    "GET /boss-templates/{boss_template_id}/questions":                                                                                      bqListByTemplate,
    "PATCH /boss-questions/{question_id}":                                                                                                   bqUpdate,
    "DELETE /boss-questions/{question_id}":                                                                                                  bqDelete,

    // BossBattleTemplates
    "POST /boss-battle-templates":                                                                                                           bbtCreate,
    "GET /boss-battle-templates/{boss_template_id}":                                                                                         bbtGet,
    "GET /teachers/{teacher_id}/boss-battle-templates":                                                                                      bbtListByOwner,
    "GET /boss-battle-templates/public":                                                                                                     bbtListPublic,

    // RewardTransactions
    "POST /reward-transactions":                                                                                                             rtCreate,
    "GET /reward-transactions/{transaction_id}":                                                                                             rtGet,
    "GET /reward-transactions/by-student/{student_id}":                                                                                      rtListByStudent,
    "GET /reward-transactions/by-student/{student_id}/class/{class_id}":                                                                     rtListByStudentAndClass,
    "GET /reward-transactions/by-source/{source_type}/{source_id}":                                                                          rtListBySource,

    // QuestAnswerAttempts
    "POST /quest-answer-attempts":                                                                                                           qaCreate,
    "GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts":                                       qaListByPK,
    "GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts":                                                               qaListByGSI1,
    "GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts":                                                             qaListByGSI2,
    "PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade":                  qaGrade,

    // BossBattleInstances
    "POST /boss-battle-instances":                                                                                                           bbiCreate,
    "GET /boss-battle-instances/{boss_instance_id}":                                                                                         bbiGet,
    "GET /classes/{class_id}/boss-battle-instances":                                                                                         bbiListByClass,
    "GET /boss-battle-templates/{boss_template_id}/boss-battle-instances":                                                                   bbiListByTemplate,
    "PATCH /boss-battle-instances/{boss_instance_id}":                                                                                       bbiUpdate,

    // BossBattleParticipants
    "POST /boss-battle-instances/{boss_instance_id}/participants/join":                                                                      bbpJoin,
    "POST /boss-battle-instances/{boss_instance_id}/participants/spectate":                                                                  bbpSpectate,
    "POST /boss-battle-instances/{boss_instance_id}/participants/leave":                                                                     bbpLeave,
    "GET /boss-battle-instances/{boss_instance_id}/participants":                                                                            bbpList,
    "POST /boss-battle-instances/{boss_instance_id}/participants/{student_id}/kick":                                                         bbpKick,

    // BossAnswerAttempts
    "GET /boss-battle-instances/{boss_instance_id}/attempts":                                                                                baaListByBattle,
    "GET /students/{student_id}/bossAttempts":                                                                                               baaListByStudent,

    // BossResults
    "GET /boss-battle-instances/{boss_instance_id}/results":                                                                                 brGetResults,
    "GET /students/{student_id}/bossResults":                                                                                                brListByStudent,
    "POST /boss-battle-instances/{boss_instance_id}/results/compute":                                                                        brCompute,

    // BossBattleSnapshots
    "POST /boss-battle-instances/{boss_instance_id}/snapshots/participants":                                                                 bbsCreate,
    "GET /boss-battle-snapshots/{snapshot_id}":                                                                                              bbsGet,

    // BossBattleQuestionPlans
    "GET /boss-battle-question-plans/{plan_id}":                                                                                             bbqpGet,
};

export const handler = async (event: any): Promise<any> => {
    const routeKey = event.routeKey as string;
    const fn = ROUTES[routeKey];
    if (!fn) {
        console.error("QuestRouter: no handler for routeKey", routeKey);
        return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Not found", routeKey }),
        };
    }
    return fn(event);
};
