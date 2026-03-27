// src/pages/teacher/bossBattleMonitorTeacher.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import feather from "feather-icons";

import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import ProfileModal from "../features/teacher/profileModal.tsx";
import { getTeacherProfile } from "../../api/teacherProfiles.js";

import {
  getBossBattleInstance,
  updateBossBattleInstance,
  startBossBattleQuestion,
  resolveBossBattleQuestion,
  advanceBossBattleToNextQuestion,
  finishBossBattle,
} from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import { getBossQuestion } from "../../api/bossQuestions/client.js";
import type { BossQuestion } from "../../api/bossQuestions/types.js";

import { listBossBattleParticipants } from "../../api/bossBattleParticipants/client.js";
import type { BossBattleParticipant } from "../../api/bossBattleParticipants/types.js";

import { listBossAnswerAttemptsByBattle } from "../../api/bossAnswerAttempts/client.js";
import { getBossResults, computeBossResults } from "../../api/bossResults/client.js";
import type { BossResultsResponse } from "../../api/bossResults/types.js";
import type { BossAnswerAttempt } from "../../api/bossAnswerAttempts/types.js";

import { listGuildsByClass, type Guild } from "../../api/guilds.js";
import { getStudentProfile } from "../../api/studentProfiles.js";
import { useBattlePolling, useRosterPolling } from "../../hooks/useBattlePolling.ts";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
};

type StudentNameMap = Record<string, string>;

type StudentRow = {
  studentId: string;
  studentName: string;
  guildId: string;
  guildName: string;
  state: string;
  isDowned: boolean;
  correct: number;
  wrong: number;
  attempts: number;
  scorePercent: number;
  lastAnsweredAt?: string;
  finishedLabel: string;
};

function getCurrentTeacher(): TeacherUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "teacher") return parsed as TeacherUser;
  } catch {}

  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchStudentNames(studentIds: string[]): Promise<StudentNameMap> {
  const unique = Array.from(new Set(studentIds)).filter(Boolean);
  const map: StudentNameMap = {};

  for (const batch of chunk(unique, 12)) {
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const prof: any = await getStudentProfile(id);
          const name =
            prof?.display_name ||
            prof?.displayName ||
            prof?.username ||
            prof?.name ||
            id;
          return [id, name] as const;
        } catch {
          return [id, id] as const;
        }
      })
    );

    for (const [id, name] of results) map[id] = name;
  }

  return map;
}

async function fetchAllGuildsByClass(classId: string) {
  const all: Guild[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const res = await listGuildsByClass(classId, 100, cursor);
    all.push(...(res.items || []));
    if (!res.hasMore) break;
    cursor = res.nextCursor;
    if (!cursor) break;
  }

  return all;
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getStatusPill(status?: string) {
  const s = status || "";
  if (s === "COMPLETED") return "bg-green-600";
  if (s === "ABORTED") return "bg-red-600";
  if (s === "QUESTION_ACTIVE") return "bg-purple-600";
  if (s === "RESOLVING") return "bg-orange-600";
  if (s === "INTERMISSION") return "bg-cyan-600";
  if (s === "COUNTDOWN") return "bg-blue-600";
  if (s === "LOBBY") return "bg-indigo-600";
  return "bg-yellow-600";
}

function getSecondsRemaining(endAt?: string | null) {
  if (!endAt) return 0;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}


export default function BossBattleMonitorTeacher() {
  const navigate = useNavigate();
  const { bossInstanceId } = useParams();

  const teacher = useMemo(() => getCurrentTeacher(), []);
  const teacherId = teacher?.id ?? null;

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;
  if (!bossInstanceId) return <Navigate to="/teacherDashboard" replace />;

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teacherProfile, setTeacherProfile] = useState<any>(null);

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [template, setTemplate] = useState<BossBattleTemplate | null>(null);
  const [question, setQuestion] = useState<BossQuestion | null>(null);

  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [attempts, setAttempts] = useState<BossAnswerAttempt[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [nameMap, setNameMap] = useState<StudentNameMap>({});

  const [transitioning, setTransitioning] = useState(false);
  const transitionLockRef = useRef(false);
  const [battleResults, setBattleResults] = useState<BossResultsResponse | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const hasAutoStartedRef = useRef(false);

  const polledInstance = useBattlePolling(bossInstanceId, 2500);
  const polledParticipants = useRosterPolling(bossInstanceId, 3000);
  const prevActiveQuestionIdRef = useRef<string | null | undefined>(undefined);
  const prevReadyToResolveRef = useRef<boolean | null>(null);
  const hasAutoResolvedRef = useRef(false);
  const intermissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (teacherId) {
        try {
          const prof = await getTeacherProfile(teacherId);
          setTeacherProfile(prof);
        } catch {
          setTeacherProfile(null);
        }
      }

      const inst = await getBossBattleInstance(bossInstanceId);
      setInstance(inst);

      if (inst?.boss_template_id) {
        try {
          const tpl = await getBossBattleTemplate(inst.boss_template_id);
          setTemplate(tpl);
        } catch {
          setTemplate(null);
        }
      } else {
        setTemplate(null);
      }

      if (inst?.active_question_id) {
        try {
          const q = await getBossQuestion(inst.active_question_id);
          setQuestion(q);
        } catch {
          setQuestion(null);
        }
      } else {
        setQuestion(null);
      }

      try {
        const roster = await listBossBattleParticipants(bossInstanceId);
        const items = roster.items || [];
        setParticipants(items);

        const nm = await fetchStudentNames(items.map((p) => p.student_id));
        setNameMap(nm);
      } catch {
        setParticipants([]);
        setNameMap({});
      }

      try {
        const res = await listBossAnswerAttemptsByBattle(bossInstanceId, { limit: 500 });
        setAttempts(res.items || []);
      } catch {
        setAttempts([]);
      }

      if (inst?.class_id) {
        try {
          const gs = await fetchAllGuildsByClass(inst.class_id);
          setGuilds(gs);
        } catch {
          setGuilds([]);
        }
      } else {
        setGuilds([]);
      }

      if (inst?.status === "COMPLETED") {
        try {
          const results = await getBossResults(inst.boss_instance_id);
          setBattleResults(results);
        } catch {
          setBattleResults(null);
        }
      }
    } catch (err: any) {
      console.error("Failed to load boss battle monitor:", err);
      setError(err?.message || "Failed to load teacher monitor.");
    } finally {
      setLoading(false);
    }
  }, [bossInstanceId, teacherId]);

  // Teacher action: Start Question (COUNTDOWN/INTERMISSION -> QUESTION_ACTIVE)
  const handleStartQuestion = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      await startBossBattleQuestion(bossInstanceId);
      await refresh();
    } catch (err: any) {
      console.error("Failed to start question:", err);
      setError(err?.message || "Failed to start question.");
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Auto-chain: Resolve → (5s intermission for students to see answer) → Advance → StartQuestion
  // Auto-resolve: called when all students have answered — transitions battle to INTERMISSION.
  // The INTERMISSION effect below handles the 5s wait, advance, and startQuestion.
  const handleAutoChain = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      await resolveBossBattleQuestion(bossInstanceId);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      if (status !== 409) { // 409 = already resolved, safe to ignore
        console.error("Resolve failed:", err);
        setError(err?.message || "Failed to resolve question.");
      }
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId]);

  // Force-next: resolves immediately regardless of who has answered (unanswered = wrong),
  // then immediately advances. If it was the last question, finishes the battle.
  const handleForceNextQuestion = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      // Step 1: force-resolve (phantom wrong for non-submitters, QUESTION_ACTIVE → INTERMISSION)
      try {
        await resolveBossBattleQuestion(bossInstanceId, { force: true });
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode ?? err?.response?.status;
        if (status !== 409) throw err; // 409 = already resolved, continue
      }

      // Refresh attempts so the table shows wrong marks for skipped students
      try {
        const res = await listBossAnswerAttemptsByBattle(bossInstanceId, { limit: 500 });
        setAttempts(res.items || []);
      } catch {}

      // Step 2: advance to next question (or detect last question)
      let hasMore = true;
      try {
        const advanceResult = await advanceBossBattleToNextQuestion(bossInstanceId);
        hasMore = advanceResult.has_more_questions;
      } catch (err: any) {
        const httpStatus = err?.status ?? err?.statusCode ?? err?.response?.status;
        if (httpStatus !== 409) throw err;
        // 409 = already advanced; check current status
        const fresh = await getBossBattleInstance(bossInstanceId);
        if (fresh?.status === "COMPLETED" || fresh?.status === "ABORTED") {
          await refresh();
          return;
        }
        hasMore = true;
      }

      // Step 3: wait 4 seconds so students can see INTERMISSION (heart flash + correct/wrong)
      // before we advance to the next question or finish the battle.
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 4: if no more questions, finish; otherwise start next question
      if (!hasMore) {
        await finishBossBattle(bossInstanceId).catch(() => {});
      } else {
        await startBossBattleQuestion(bossInstanceId);
      }

      await refresh();
    } catch (err: any) {
      console.error("Force next question failed:", err);
      setError(err?.message || "Failed to force next question.");
      await refresh().catch(() => {});
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Manual resolve button (kept for edge cases / teacher override)
  const handleResolveQuestion = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      await resolveBossBattleQuestion(bossInstanceId);
      await refresh();
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      if (status === 409) {
        await refresh();
      } else {
        console.error("Failed to resolve question:", err);
        setError(err?.message || "Failed to resolve question.");
      }
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Manual advance button (kept for teacher override)
  const handleAdvanceQuestion = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      await advanceBossBattleToNextQuestion(bossInstanceId);
      const fresh = await getBossBattleInstance(bossInstanceId);
      if (fresh?.status === "COMPLETED") {
        await finishBossBattle(bossInstanceId).catch(() => {});
      }
      await refresh();
    } catch (err: any) {
      console.error("Failed to advance question:", err);
      setError(err?.message || "Failed to advance to next question.");
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Teacher action: Finish Battle (writes BossResults)
  const handleFinishBattle = useCallback(async () => {
    if (!bossInstanceId || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setTransitioning(true);
    try {
      await finishBossBattle(bossInstanceId);
      await refresh();
    } catch (err: any) {
      console.error("Failed to finish battle:", err);
      setError(err?.message || "Failed to finish battle.");
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Abort battle
  const handleAbortBattle = useCallback(async () => {
    if (!bossInstanceId) return;
    if (!confirm("Abort this battle? This cannot be undone.")) return;
    try {
      setTransitioning(true);
      await updateBossBattleInstance(bossInstanceId, {
        status: "ABORTED",
        outcome: "ABORTED",
        fail_reason: "ABORTED_BY_TEACHER",
        completed_at: new Date().toISOString(),
      });
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to abort battle.");
    } finally {
      setTransitioning(false);
    }
  }, [bossInstanceId, refresh]);

  // Compute results (if COMPLETED but results not yet written)
  const handleComputeResults = useCallback(async () => {
    if (!bossInstanceId) return;
    try {
      setTransitioning(true);
      await computeBossResults(bossInstanceId);
      const results = await getBossResults(bossInstanceId);
      setBattleResults(results);
    } catch (err: any) {
      setError(err?.message || "Failed to compute results.");
    } finally {
      setTransitioning(false);
    }
  }, [bossInstanceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Merge polled instance — also detect question changes and ready_to_resolve
  useEffect(() => {
    if (!polledInstance) return;

    setInstance(polledInstance);

    // Load question when active_question_id changes
    const newQId = polledInstance.active_question_id ?? null;
    if (newQId !== prevActiveQuestionIdRef.current) {
      prevActiveQuestionIdRef.current = newQId;
      if (newQId) {
        getBossQuestion(newQId)
          .then((q) => setQuestion(q))
          .catch(() => setQuestion(null));
      } else {
        setQuestion(null);
      }
    }

    // Auto-chain when all students have answered (ready_to_resolve flips true)
    const nowReady = (polledInstance as any).ready_to_resolve ?? false;
    if (nowReady && !prevReadyToResolveRef.current) {
      listBossAnswerAttemptsByBattle(bossInstanceId, { limit: 500 })
        .then((res) => setAttempts(res.items || []))
        .catch(() => {});

      if (polledInstance.status === "QUESTION_ACTIVE" && !hasAutoResolvedRef.current) {
        hasAutoResolvedRef.current = true;
        handleAutoChain();
      }
    }
    prevReadyToResolveRef.current = nowReady;
  }, [polledInstance, bossInstanceId, handleAutoChain]);

  // Merge polled roster
  useEffect(() => {
    if (polledParticipants.length > 0) setParticipants(polledParticipants);
  }, [polledParticipants]);

  // Live countdown for active question timer
  useEffect(() => {
    const endsAt = (instance as any)?.question_ends_at;
    if (instance?.status !== "QUESTION_ACTIVE" || !endsAt) {
      setQuestionTimeLeft(0);
      return;
    }
    const tick = () => setQuestionTimeLeft(getSecondsRemaining(endsAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [instance?.status, (instance as any)?.question_ends_at]);

  // Reset the auto-resolve guard whenever the active question changes
  useEffect(() => {
    hasAutoResolvedRef.current = false;
  }, [instance?.active_question_id]);

  // Poll attempts every 3 s while a question is active so the "not answered" list updates live
  useEffect(() => {
    if (instance?.status !== "QUESTION_ACTIVE") return;
    const poll = async () => {
      try {
        const res = await listBossAnswerAttemptsByBattle(bossInstanceId, { limit: 500 });
        setAttempts(res.items || []);
      } catch {
        // silent — stale data is better than an error flash
      }
    };
    const timer = window.setInterval(poll, 3000);
    return () => window.clearInterval(timer);
  }, [instance?.status, bossInstanceId]);

  // Timer-based auto-chain for timed questions (timer expired → resolve→advance→start)
  useEffect(() => {
    if (
      instance?.status !== "QUESTION_ACTIVE" ||
      !(instance as any)?.question_ends_at ||
      questionTimeLeft !== 0 ||
      hasAutoResolvedRef.current
    ) return;

    hasAutoResolvedRef.current = true;
    handleAutoChain();
  }, [questionTimeLeft, instance?.status, (instance as any)?.question_ends_at, handleAutoChain]);

  // Reset auto-start guard when countdown begins
  useEffect(() => {
    if (instance?.status === "COUNTDOWN") {
      hasAutoStartedRef.current = false;
    }
  }, [instance?.status]);

  // Auto-advance: when battle enters INTERMISSION, wait 5s then advance to next question
  useEffect(() => {
    if (instance?.status !== "INTERMISSION") {
      // If status left INTERMISSION (e.g. manually advanced), cancel any pending timer
      if (intermissionTimerRef.current !== null) {
        clearTimeout(intermissionTimerRef.current);
        intermissionTimerRef.current = null;
      }
      return;
    }

    // Guard: don't start a second timer if one is already counting down
    if (intermissionTimerRef.current !== null) return;

    intermissionTimerRef.current = setTimeout(async () => {
      // Keep intermissionTimerRef.current non-null until all async work completes.
      // This prevents polling from detecting the post-advance INTERMISSION state
      // (advance keeps status as INTERMISSION when more questions remain) and
      // starting a second timer that would double-advance the question index.
      if (!bossInstanceId || transitionLockRef.current) {
        intermissionTimerRef.current = null;
        return;
      }
      transitionLockRef.current = true;
      setTransitioning(true);
      try {
        let hasMore = true;
        try {
          const advanceResult = await advanceBossBattleToNextQuestion(bossInstanceId);
          hasMore = advanceResult.has_more_questions;
        } catch (err: any) {
          const httpStatus = err?.status ?? err?.statusCode ?? err?.response?.status;
          if (httpStatus !== 409) {
            console.error("Advance failed:", err);
            return;
          }
          // 409 = already advanced or status changed — fetch to decide next step
          const fresh = await getBossBattleInstance(bossInstanceId);
          const s = fresh?.status as string | undefined;
          if (s === "COMPLETED" || s === "ABORTED") {
            if (s === "COMPLETED") await finishBossBattle(bossInstanceId).catch(() => {});
            await refresh();
            return;
          }
          // Status is still INTERMISSION with updated index — proceed to startQuestion
          hasMore = true;
        }

        if (!hasMore) {
          await finishBossBattle(bossInstanceId).catch(() => {});
        } else {
          await startBossBattleQuestion(bossInstanceId);
        }
        await refresh();
      } catch (err: any) {
        console.error("Auto-advance after intermission failed:", err);
        await refresh().catch(() => {});
      } finally {
        intermissionTimerRef.current = null;
        transitionLockRef.current = false;
        setTransitioning(false);
      }
    }, 5000);
  }, [instance?.status, bossInstanceId, refresh]);

  // Cleanup intermission timer on unmount
  useEffect(() => {
    return () => {
      if (intermissionTimerRef.current) clearTimeout(intermissionTimerRef.current);
    };
  }, []);

  // Live countdown timer for COUNTDOWN state
  useEffect(() => {
    if (instance?.status !== "COUNTDOWN") {
      setCountdownLeft(0);
      return;
    }
    const endsAt = (instance as any)?.countdown_end_at;
    const tick = () => setCountdownLeft(getSecondsRemaining(endsAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [instance?.status, (instance as any)?.countdown_end_at]);

  // Countdown expiry → auto-start the first question
  useEffect(() => {
    if (
      instance?.status !== "COUNTDOWN" ||
      countdownLeft !== 0 ||
      hasAutoStartedRef.current
    ) return;

    hasAutoStartedRef.current = true;
    handleStartQuestion();
  }, [countdownLeft, instance?.status, handleStartQuestion]);

  useEffect(() => {
    feather.replace();
  }, [loading, instance, template, question, participants, attempts, guilds, error, transitioning]);

  const guildById = useMemo(() => {
    const m = new Map<string, Guild>();
    for (const g of guilds) m.set((g as any).guild_id, g);
    return m;
  }, [guilds]);

  const questionAttempts = useMemo(() => {
    if (!question?.question_id) return [];
    return attempts.filter((a) => a.question_id === question.question_id);
  }, [attempts, question?.question_id]);

  const notSubmittedStudents = useMemo(() => {
    if (instance?.status !== "QUESTION_ACTIVE" || !question?.question_id) return [];
    const submittedIds = new Set(questionAttempts.map((a) => a.student_id));
    return participants
      .filter((p) => p.state === "JOINED" && !p.is_downed && !submittedIds.has(p.student_id))
      .map((p) => ({ studentId: p.student_id, name: nameMap[p.student_id] || p.student_id }));
  }, [instance?.status, question?.question_id, questionAttempts, participants, nameMap]);

  const studentRows = useMemo<StudentRow[]>(() => {
    return participants
      .map((p) => {
        const studentAttempts = attempts.filter((a) => a.student_id === p.student_id);
        const correct = studentAttempts.filter((a) => a.is_correct).length;
        const wrong = studentAttempts.filter((a) => !a.is_correct).length;
        const total = studentAttempts.length;

        const guildName =
          ((guildById.get(p.guild_id) as any)?.name || p.guild_id || "No Guild");

        let finishedLabel = "In Progress";
        if (instance?.status === "COMPLETED") finishedLabel = "Finished";
        else if (p.is_downed) finishedLabel = "Downed";
        else if (p.state === "SPECTATE") finishedLabel = "Spectating";
        else if (p.state === "KICKED") finishedLabel = "Removed";
        else if (p.state === "LEFT") finishedLabel = "Left";

        const lastAnsweredAt = studentAttempts
          .map((a) => a.answered_at)
          .sort()
          .slice(-1)[0];

        return {
          studentId: p.student_id,
          studentName: nameMap[p.student_id] || p.student_id,
          guildId: p.guild_id,
          guildName,
          state: p.state,
          isDowned: p.is_downed,
          correct,
          wrong,
          attempts: total,
          scorePercent: total > 0 ? Math.round((correct / total) * 100) : 0,
          lastAnsweredAt,
          finishedLabel,
        };
      })
      .sort((a, b) => {
        if (a.guildName !== b.guildName) {
          return a.guildName.localeCompare(b.guildName);
        }
        return a.studentName.localeCompare(b.studentName);
      });
  }, [participants, attempts, guildById, nameMap, instance?.status]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, StudentRow[]>();
    for (const row of studentRows) {
      if (!map.has(row.guildName)) map.set(row.guildName, []);
      map.get(row.guildName)!.push(row);
    }
    return Array.from(map.entries());
  }, [studentRows]);

  const joinedCount = participants.filter((p) => p.state === "JOINED").length;
  const spectateCount = participants.filter((p) => p.state === "SPECTATE").length;
  const downedCount = participants.filter((p) => p.is_downed).length;


  const initialHp = instance?.initial_boss_hp ?? 0;
  const currentHp = instance?.current_boss_hp ?? 0;
  const hpPercent =
    initialHp > 0 ? Math.max(0, Math.min(100, (currentHp / initialHp) * 100)) : 0;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-900"
      style={{ backgroundImage: "url('/assets/background/guilds-bg.png')" }}
    >
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                <Link
                  to="/teacherDashboard"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Dashboard
              </Link>
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Classes
              </Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Quests
              </Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Activity
              </Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Guilds
              </Link>
              <DropDownProfile
                username={teacher?.displayName || "user"}
                onLogout={() => {
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
                onProfileClick={() => setIsProfileModalOpen(true)}
              />
            </div>

            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                <i data-feather="menu"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </button>

        <button
          onClick={refresh}
          disabled={loading || transitioning}
          className="inline-flex items-center bg-blue-600 text-white border-2 border-blue-600 rounded-md px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
        >
          <i data-feather="refresh-cw" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Teacher Boss Battle Monitor</h1>
            <p className="text-white/90 mt-1">
              Watch student progress and see their current scores.
            </p>
            <p className="text-white/70 text-sm mt-1">
              Instance: <span className="font-mono">{bossInstanceId}</span>
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md px-4 py-3 text-gray-700 min-w-[220px]">
            <div className="text-xs tracking-widest text-gray-500 font-semibold">TEACHER</div>
            <div className="mt-1 text-sm font-semibold">
              {teacherProfile?.display_name ||
                teacherProfile?.displayName ||
                teacher?.displayName ||
                "Teacher"}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Status:{" "}
              <span className="font-bold">{instance?.status || "Loading..."}</span>
            </div>
            {transitioning ? (
              <div className="mt-1 text-xs font-semibold text-purple-600">
                Advancing battle...
              </div>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="alert-triangle" className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {loading && !instance ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            Loading monitor...
          </div>
        ) : null}

        {instance && (
          <>
            {/* ── Battle Arena Preview ── */}
            <div className="relative h-[420px] mb-6">
              <div
                className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 bg-cover bg-center"
                style={{
                  backgroundImage: "url('/assets/background/goblin_stage.png')",
                  backgroundPosition: "center 80%",
                }}
              >
                {/* Status badge */}
                <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2 justify-end">
                  <span className={`px-3 py-1 rounded-full ${getStatusPill(instance.status)} text-white text-xs font-semibold`}>
                    {instance.status}
                  </span>
                  {transitioning && (
                    <span className="px-3 py-1 rounded-full bg-yellow-700/80 border border-yellow-500 text-yellow-200 text-xs font-semibold animate-pulse">
                      Advancing...
                    </span>
                  )}
                </div>

                {/* Boss HP bar */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[360px] max-w-[70%]">
                  <div className="rounded-2xl bg-black/70 border border-red-500/60 px-4 py-3 shadow-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-red-200 text-xs uppercase tracking-[0.2em] font-bold">Boss HP</span>
                      <span className="text-white text-xs font-bold">
                        {initialHp > 0 ? ((currentHp / initialHp) * 100).toFixed(2) : "0.00"}%
                      </span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-300"
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="mt-1 text-center text-xs text-slate-300">{template?.title ?? "Boss Battle"}</div>
                  </div>
                </div>

                <div className="absolute inset-0 z-10">
                  {/* Party side — bossAvatar.png. Adjust bottom-[30%] to move it up or down */}
                  <div className="absolute left-[4%] bottom-[30%] w-[42%] flex items-end justify-center">
                    <img
                      src="/assets/boss/bossAvatar.png"
                      alt="Party"
                      className="w-40 md:w-52 drop-shadow-[0_14px_20px_rgba(0,0,0,0.7)]"
                    />
                  </div>

                  {/* Boss side */}
                  <div className="absolute right-[6%] bottom-[8%] w-[34%] h-[70%] flex items-end justify-center">
                    <img
                      src="/assets/boss/goblin_king.png"
                      alt="Boss"
                      className="w-[200px] md:w-[260px] lg:w-[300px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)]"
                    />
                  </div>
                </div>

                {/* Stats + status strip */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 py-3 border-t-2 border-yellow-500 z-20 flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="text-slate-300 text-xs font-mono">
                    {instance.status === "QUESTION_ACTIVE" && questionTimeLeft > 0
                      ? `⏱ ${questionTimeLeft}s remaining — Q${Number((instance as any)?.current_question_index ?? 0) + 1}`
                      : instance.status === "INTERMISSION"
                      ? "Intermission — next question loading…"
                      : instance.status === "COMPLETED"
                      ? (battleResults?.outcome === "WIN" ? "⚔️ Victory!" : "💀 Defeat")
                      : instance.status === "LOBBY"
                      ? "Waiting for students to join…"
                      : instance.status}
                  </span>
                  <div className="flex items-center gap-4 ml-auto">
                    <span className="text-xs text-slate-300"><span className="font-bold text-white">{joinedCount}</span> Joined</span>
                    <span className="text-xs text-slate-300"><span className="font-bold text-white">{spectateCount}</span> Spectating</span>
                    <span className="text-xs text-slate-300"><span className="font-bold text-red-400">{downedCount}</span> Downed</span>
                    <span className="text-xs text-slate-300"><span className="font-bold text-white">{attempts.length}</span> Attempts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Teacher Controls ── */}
            <div className="bg-white rounded-xl shadow-md px-6 py-4 mb-6">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Teacher Controls</h3>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => window.open(`/teacher/bossfight-display/${bossInstanceId}`, "_blank")}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <i data-feather="monitor" className="w-4 h-4"></i>
                  Open Display Screen
                </button>

                <button
                  onClick={handleForceNextQuestion}
                  disabled={transitioning || instance?.status !== "QUESTION_ACTIVE"}
                  title={instance?.status !== "QUESTION_ACTIVE" ? "Only available while a question is active" : "Resolve now — students who haven't answered are marked wrong"}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    transitioning || instance?.status !== "QUESTION_ACTIVE"
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  <i data-feather="skip-forward" className="w-4 h-4"></i>
                  Force Next Question
                </button>

                {transitioning && (
                  <span className="text-xs text-purple-600 font-semibold animate-pulse">Advancing…</span>
                )}
              </div>
              {instance?.status === "QUESTION_ACTIVE" && notSubmittedStudents.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  {notSubmittedStudents.length} student{notSubmittedStudents.length !== 1 ? "s" : ""} haven't answered yet — forcing will mark them wrong.
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Current Battle State</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    ACTIVE QUESTION
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {question ? `Q${(instance?.current_question_index ?? 0) + 1}` : "None"}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {question?.question_text || "No active question"}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    QUESTION TYPE
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {question?.question_type || "—"}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    ACTIVE GUILD
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {instance.active_guild_id || "—"}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    UPDATED
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {formatDateTime(instance.updated_at)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    QUESTION STARTED
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {formatDateTime((instance as any)?.question_started_at)}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    QUESTION ENDS
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {formatDateTime((instance as any)?.question_ends_at)}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    CURRENT INDEX
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {Number((instance as any)?.current_question_index ?? 0)}
                  </div>
                </div>
              </div>

              {question ? (
                <div className="mt-6 rounded-lg border p-4 bg-gray-50">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest mb-2">
                    CURRENT QUESTION SUBMISSIONS
                  </div>
                  <div className="text-sm text-gray-700">
                    {questionAttempts.length} submission(s) recorded for this active question.
                  </div>
                  {instance?.status === "QUESTION_ACTIVE" && notSubmittedStudents.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-red-600 font-semibold tracking-widest mb-1">
                        NOT YET SUBMITTED ({notSubmittedStudents.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {notSubmittedStudents.map((s) => (
                          <span key={s.studentId} className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-300">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {instance?.status === "QUESTION_ACTIVE" && notSubmittedStudents.length === 0 && questionAttempts.length > 0 && (
                    <div className="mt-2 text-xs text-green-700 font-semibold">All active students have submitted.</div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Battle Results (shown when COMPLETED) */}
            {instance.status === "COMPLETED" && battleResults && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className={`text-center py-4 rounded-lg mb-6 ${battleResults.outcome === "WIN" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  <div className="text-3xl font-bold">
                    {battleResults.outcome === "WIN" ? "⚔️ VICTORY!" : "💀 DEFEAT"}
                  </div>
                  {battleResults.fail_reason && (
                    <div className="text-sm mt-1 opacity-70">{battleResults.fail_reason.replace(/_/g, " ")}</div>
                  )}
                </div>

                <h4 className="text-lg font-bold text-gray-900 mb-3">Student Results</h4>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="text-left px-4 py-2">Student</th>
                        <th className="text-left px-4 py-2">Guild</th>
                        <th className="text-left px-4 py-2">Correct</th>
                        <th className="text-left px-4 py-2">Wrong</th>
                        <th className="text-left px-4 py-2">Damage</th>
                        <th className="text-left px-4 py-2">XP</th>
                        <th className="text-left px-4 py-2">Gold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(battleResults.student_results || []).map((s) => (
                        <tr key={s.student_id} className="border-t">
                          <td className="px-4 py-2 font-semibold">{nameMap[s.student_id] || s.student_id}</td>
                          <td className="px-4 py-2">{(guildById.get(s.guild_id) as any)?.name || s.guild_id}</td>
                          <td className="px-4 py-2 text-green-700 font-bold">{s.total_correct}</td>
                          <td className="px-4 py-2 text-red-700 font-bold">{s.total_incorrect}</td>
                          <td className="px-4 py-2">{s.total_damage_to_boss}</td>
                          <td className="px-4 py-2 text-purple-700 font-bold">+{s.xp_awarded}</td>
                          <td className="px-4 py-2 text-yellow-700 font-bold">+{s.gold_awarded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4 className="text-lg font-bold text-gray-900 mb-3">Guild Results</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="text-left px-4 py-2">Guild</th>
                        <th className="text-left px-4 py-2">Members</th>
                        <th className="text-left px-4 py-2">Correct</th>
                        <th className="text-left px-4 py-2">Wrong</th>
                        <th className="text-left px-4 py-2">Total Damage</th>
                        <th className="text-left px-4 py-2">XP</th>
                        <th className="text-left px-4 py-2">Gold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(battleResults.guild_results || []).map((g) => (
                        <tr key={g.guild_id} className="border-t">
                          <td className="px-4 py-2 font-semibold">{(guildById.get(g.guild_id) as any)?.name || g.guild_id}</td>
                          <td className="px-4 py-2">{g.guild_members_joined}</td>
                          <td className="px-4 py-2 text-green-700 font-bold">{g.guild_total_correct}</td>
                          <td className="px-4 py-2 text-red-700 font-bold">{g.guild_total_incorrect}</td>
                          <td className="px-4 py-2">{g.guild_total_damage_to_boss}</td>
                          <td className="px-4 py-2 text-purple-700 font-bold">+{g.guild_xp_awarded_total}</td>
                          <td className="px-4 py-2 text-yellow-700 font-bold">+{g.guild_gold_awarded_total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {groupedRows.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
                  No participants found.
                </div>
              ) : (
                groupedRows.map(([guildName, rows]) => {
                  const guildId = rows[0]?.guildId ?? "";
                  const isActiveTurn =
                    instance.mode_type === "TURN_BASED_GUILD" &&
                    instance.active_guild_id === guildId;
                  const perGuildQIndex =
                    instance.mode_type === "RANDOMIZED_PER_GUILD" && guildId
                      ? (instance.per_guild_question_index?.[guildId] ?? 0)
                      : null;
                  return (
                  <div key={guildName} className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className={`bg-gradient-to-r ${isActiveTurn ? "from-yellow-500 to-amber-600" : "from-blue-500 to-indigo-600"} p-5 text-white`}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-bold">{guildName}</h3>
                            {isActiveTurn && (
                              <span className="bg-white text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                ACTIVE TURN
                              </span>
                            )}
                            {perGuildQIndex !== null && (
                              <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                                Q{perGuildQIndex + 1}
                              </span>
                            )}
                          </div>
                          <p className="text-white/80 text-sm mt-1">
                            Students: {rows.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700">
                          <tr>
                            <th className="text-left px-4 py-3">Student</th>
                            <th className="text-left px-4 py-3">State</th>
                            <th className="text-left px-4 py-3">Finished</th>
                            <th className="text-left px-4 py-3">Correct</th>
                            <th className="text-left px-4 py-3">Wrong</th>
                            <th className="text-left px-4 py-3">Attempts</th>
                            <th className="text-left px-4 py-3">Score</th>
                            <th className="text-left px-4 py-3">Last Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.studentId} className="border-t">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900">
                                  {row.studentName}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                  {row.studentId}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-200 text-gray-800">
                                  {row.state}
                                </span>
                                {row.isDowned ? (
                                  <div className="mt-1 text-xs font-semibold text-red-600">
                                    DOWNED
                                  </div>
                                ) : null}
                              </td>

                              <td className="px-4 py-3 font-medium text-gray-800">
                                {row.finishedLabel}
                              </td>

                              <td className="px-4 py-3 text-green-700 font-bold">
                                {row.correct}
                              </td>

                              <td className="px-4 py-3 text-red-700 font-bold">
                                {row.wrong}
                              </td>

                              <td className="px-4 py-3 text-gray-900 font-semibold">
                                {row.attempts}
                              </td>

                              <td className="px-4 py-3">
                                <span className="font-bold text-gray-900">
                                  {row.scorePercent}%
                                </span>
                              </td>

                              <td className="px-4 py-3 text-gray-700">
                                {formatDateTime(row.lastAnsweredAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}