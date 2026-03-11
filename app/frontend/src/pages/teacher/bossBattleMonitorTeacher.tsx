// src/pages/teacher/bossBattleMonitorTeacher.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import feather from "feather-icons";

import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import { getTeacherProfile } from "../../api/teacherProfiles.js";

import {
  getBossBattleInstance,
  updateBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import {
  getBossQuestion,
  listBossQuestionsByTemplate,
} from "../../api/bossQuestions/client.js";
import type { BossQuestion } from "../../api/bossQuestions/types.js";

import { listBossBattleParticipants } from "../../api/bossBattleParticipants/client.js";
import type { BossBattleParticipant } from "../../api/bossBattleParticipants/types.js";

import { listBossAnswerAttemptsByBattle } from "../../api/bossAnswerAttempts/client.js";
import type { BossAnswerAttempt } from "../../api/bossAnswerAttempts/types.js";

import { listGuildsByClass, type Guild } from "../../api/guilds.js";
import { getStudentProfile } from "../../api/studentProfiles.js";
import { useBattleSubscription, useRosterSubscription } from "../../hooks/useBattleSubscription.ts";

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

async function fetchAllBossQuestionsByTemplate(bossTemplateId: string) {
  const all: BossQuestion[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const res = await listBossQuestionsByTemplate(bossTemplateId, {
      limit: 100,
      cursor,
    });

    all.push(...(res.items || []));
    cursor = res.nextToken || res.cursor;
    if (!cursor) break;
  }

  return all.sort((a: any, b: any) => {
    const ai = Number(a?.order_index ?? 0);
    const bi = Number(b?.order_index ?? 0);
    return ai - bi;
  });
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

function getQuestionDurationSeconds(question?: any, template?: any, instance?: any) {
  const fromQuestion =
    Number(question?.time_limit_seconds) > 0
      ? Number(question.time_limit_seconds)
      : Number(question?.duration_seconds) > 0
      ? Number(question.duration_seconds)
      : 0;

  if (fromQuestion > 0) return fromQuestion;

  const fromTemplate =
    Number(template?.question_time_limit_seconds) > 0
      ? Number(template.question_time_limit_seconds)
      : Number(template?.time_limit_seconds) > 0
      ? Number(template.time_limit_seconds)
      : 0;

  if (fromTemplate > 0) return fromTemplate;

  const fromInstance =
    Number(instance?.question_time_limit_seconds) > 0
      ? Number(instance.question_time_limit_seconds)
      : Number(instance?.speed_window_seconds) > 0
      ? Number(instance.speed_window_seconds)
      : 0;

  if (fromInstance > 0) return fromInstance;

  return 60;
}

function isoNowPlusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export default function BossBattleMonitorTeacher() {
  const navigate = useNavigate();
  const { bossInstanceId } = useParams();

  const teacher = useMemo(() => getCurrentTeacher(), []);
  const teacherId = teacher?.id ?? null;

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;
  if (!bossInstanceId) return <Navigate to="/teacherDashboard" replace />;

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

  const { battleState } = useBattleSubscription(bossInstanceId);
  const { rosterEvent } = useRosterSubscription(bossInstanceId);
  const prevActiveQuestionIdRef = useRef<string | null | undefined>(undefined);

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
    } catch (err: any) {
      console.error("Failed to load boss battle monitor:", err);
      setError(err?.message || "Failed to load teacher monitor.");
    } finally {
      setLoading(false);
    }
  }, [bossInstanceId, teacherId]);

  const activateQuestionAtIndex = useCallback(
    async (inst: BossBattleInstance, tpl: BossBattleTemplate | null, nextIndex: number) => {
      if (!inst?.boss_template_id) return false;

      const allQuestions = await fetchAllBossQuestionsByTemplate(inst.boss_template_id);
      if (!allQuestions.length) {
        setError("This boss template has no questions, so the battle cannot start.");
        return false;
      }

      const safeIndex = Math.max(0, Math.min(nextIndex, allQuestions.length - 1));
      const nextQuestion = allQuestions[safeIndex];
      const durationSeconds = getQuestionDurationSeconds(nextQuestion, tpl, inst);
      const nowIso = new Date().toISOString();

      await updateBossBattleInstance(inst.boss_instance_id, {
      status: "QUESTION_ACTIVE" as any,
      active_question_id: nextQuestion.question_id,
      current_question_index: safeIndex,
      question_started_at: nowIso,
      question_ends_at: isoNowPlusSeconds(durationSeconds),
    } as any);

      return true;
    },
    []
  );

  const maybeAdvanceBattleState = useCallback(async () => {
    if (!instance || transitionLockRef.current) return;
    if (!bossInstanceId) return;

    const status = String(instance.status || "").toUpperCase();

    try {
      // COUNTDOWN -> QUESTION_ACTIVE
      if (status === "COUNTDOWN") {
        const remaining = getSecondsRemaining((instance as any)?.countdown_end_at);
        if (remaining <= 0) {
          transitionLockRef.current = true;
          setTransitioning(true);

          const tpl =
            template ||
            (instance.boss_template_id
              ? await getBossBattleTemplate(instance.boss_template_id).catch(() => null)
              : null);

          const success = await activateQuestionAtIndex(
            instance,
            tpl,
            Number((instance as any)?.current_question_index ?? 0)
          );

          if (success) {
            await refresh();
          }
        }
        return;
      }

      // QUESTION_ACTIVE but somehow missing active_question_id
      if (status === "QUESTION_ACTIVE" && !instance.active_question_id) {
        transitionLockRef.current = true;
        setTransitioning(true);

        const tpl =
          template ||
          (instance.boss_template_id
            ? await getBossBattleTemplate(instance.boss_template_id).catch(() => null)
            : null);

        const success = await activateQuestionAtIndex(
          instance,
          tpl,
          Number((instance as any)?.current_question_index ?? 0)
        );

        if (success) {
          await refresh();
        }
        return;
      }

      // INTERMISSION ended and no question is active yet -> move to next question
      if (status === "INTERMISSION") {
        const remaining = getSecondsRemaining((instance as any)?.intermission_ends_at);
        if (remaining <= 0) {
          transitionLockRef.current = true;
          setTransitioning(true);

          const tpl =
            template ||
            (instance.boss_template_id
              ? await getBossBattleTemplate(instance.boss_template_id).catch(() => null)
              : null);

          const nextIndex = Number((instance as any)?.current_question_index ?? 0) + 1;
          const allQuestions = instance.boss_template_id
            ? await fetchAllBossQuestionsByTemplate(instance.boss_template_id)
            : [];

          if (!allQuestions.length) {
            setError("No questions found for this boss template.");
            return;
          }

          if (nextIndex >= allQuestions.length) {
            await updateBossBattleInstance(instance.boss_instance_id, {
              status: "COMPLETED" as any,
              outcome: currentHp <= 0 ? "WIN" : "LOSE",
              completed_at: new Date().toISOString(),
              active_question_id: null as any,
              question_ends_at: null as any,
              intermission_ends_at: null as any,
            } as any);

            await refresh();
            return;
          }

          const success = await activateQuestionAtIndex(instance, tpl, nextIndex);
          if (success) {
            await refresh();
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to advance battle state:", err);
      setError(err?.message || "Failed to advance battle state.");
    } finally {
      transitionLockRef.current = false;
      setTransitioning(false);
    }
  }, [bossInstanceId, instance, template, refresh, activateQuestionAtIndex]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!battleState) return;
    setInstance((prev) => {
      if (!prev) return prev;
      return { ...prev, ...battleState } as unknown as BossBattleInstance;
    });
    const newQId = battleState.active_question_id ?? null;
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
  }, [battleState]);

  useEffect(() => {
    if (!rosterEvent) return;
    setParticipants(rosterEvent.participants as any);
  }, [rosterEvent]);

  useEffect(() => {
    maybeAdvanceBattleState();
  }, [maybeAdvanceBattleState]);

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
              <Link
                to="/teacherDashboard"
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                <span className="text-xl font-bold">ClassQuest</span>
              </Link>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-4">
              <Link
                to="/teacherDashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>

              <Link
                to="/subjects"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Subjects
              </Link>

              <Link
                to="/classes"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Classes
              </Link>

              <DropDownProfile />
            </div>
          </div>
        </div>
      </nav>

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
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {template?.title || "Unnamed Boss"}
                    </h2>
                    <p className="text-white/90 mt-1">
                      {template?.description || "No description provided."}
                    </p>
                  </div>

                  <div
                    className={`${getStatusPill(
                      instance.status
                    )} px-4 py-2 rounded-full text-xs font-bold`}
                  >
                    {instance.status}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">Boss HP</span>
                    <span className="text-sm font-semibold">
                      {currentHp.toLocaleString()} / {initialHp.toLocaleString()} HP
                    </span>
                  </div>

                  <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    JOINED
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">{joinedCount}</div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    SPECTATING
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">{spectateCount}</div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    DOWNED
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">{downedCount}</div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    TOTAL ATTEMPTS
                  </div>
                  <div className="mt-2 text-2xl font-bold text-gray-900">{attempts.length}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Current Battle State</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-xs text-gray-500 font-semibold tracking-widest">
                    ACTIVE QUESTION
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {question ? `Q${question.order_index + 1}` : "None"}
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
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              {groupedRows.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
                  No participants found.
                </div>
              ) : (
                groupedRows.map(([guildName, rows]) => (
                  <div key={guildName} className="bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white">
                      <h3 className="text-xl font-bold">{guildName}</h3>
                      <p className="text-white/80 text-sm mt-1">
                        Students: {rows.length}
                      </p>
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
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}