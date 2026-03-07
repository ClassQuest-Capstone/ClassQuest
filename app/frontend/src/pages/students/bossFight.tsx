// src/pages/students/bossFight.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";

import "../../styles/boss.css";

import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";
import { api } from "../../api/http.js";

import {
  listBossBattleInstancesByClass,
  getBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import {
  listBossBattleParticipants,
  leaveBossBattle,
} from "../../api/bossBattleParticipants/client.js";
import type { BossBattleParticipant } from "../../api/bossBattleParticipants/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import { getBossQuestion } from "../../api/bossQuestions/client.js";
import type { BossQuestion } from "../../api/bossQuestions/types.js";

import { getStudentProfile } from "../../api/studentProfiles.js";

type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

type RosterStudent = {
  studentId: string;
  guildId: string;
  state: string;
  isDowned: boolean;
  frozenUntil?: string;
  displayName: string;
};

type BattleLogEntry = {
  id: string;
  text: string;
  kind?: "info" | "success" | "danger" | "warning";
};

type NormalizedOption = {
  value: string;
  label: string;
};

type BossResultGuildRow = {
  guild_id: string;
  guild_total_correct: number;
  guild_total_incorrect: number;
  guild_total_attempts: number;
  guild_total_damage_to_boss: number;
  guild_total_hearts_lost: number;
  guild_xp_awarded_total: number;
  guild_gold_awarded_total: number;
  guild_members_joined: number;
  guild_members_downed: number;
};

type BossResultStudentRow = {
  student_id: string;
  guild_id: string;
  total_correct: number;
  total_incorrect: number;
  total_attempts: number;
  total_damage_to_boss: number;
  hearts_lost: number;
  xp_awarded: number;
  gold_awarded: number;
  participation_state: string;
  last_answered_at?: string;
};

type BossResultsResponse = {
  outcome?: "WIN" | "FAIL" | "ABORTED";
  completed_at?: string;
  fail_reason?: string;
  guild_results?: BossResultGuildRow[];
  student_results?: BossResultStudentRow[];
};

type PartySlot = {
  key: string;
  image: string;
  name: string;
  position: "front" | "back-left" | "back-right";
};

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed;
  } catch {
    // ignore bad local storage
  }

  return null;
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getRemainingSeconds(targetIso?: string | null) {
  if (!targetIso) return null;
  const end = new Date(targetIso).getTime();
  if (!Number.isFinite(end)) return null;
  const diff = Math.ceil((end - Date.now()) / 1000);
  return Math.max(0, diff);
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "LOBBY":
      return "Lobby Open";
    case "COUNTDOWN":
      return "Battle Starting";
    case "QUESTION_ACTIVE":
      return "Question Active";
    case "RESOLVING":
      return "Resolving Answers";
    case "INTERMISSION":
      return "Intermission";
    case "COMPLETED":
      return "Battle Complete";
    case "ABORTED":
      return "Battle Aborted";
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    default:
      return status || "Unknown";
  }
}

function optionTextFromUnknown(value: any): string {
  if (value == null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.text ??
        value.label ??
        value.value ??
        value.option_text ??
        value.option ??
        value.answer_text ??
        value.name ??
        ""
    ).trim();
  }

  return String(value);
}

function normalizeOptions(options: any): NormalizedOption[] {
  if (!options) return [];

  if (Array.isArray(options)) {
    return options
      .map((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const label = optionTextFromUnknown(item);
          const value = String(
            item.value ??
              item.label ??
              item.text ??
              item.option_text ??
              item.option ??
              label
          ).trim();

          return {
            value: value || label || String(index + 1),
            label: label || value || `Option ${index + 1}`,
          };
        }

        const text = optionTextFromUnknown(item);
        return {
          value: text,
          label: text,
        };
      })
      .filter((x) => x.label);
  }

  if (typeof options === "object") {
    return Object.entries(options)
      .map(([key, value]) => {
        const label = optionTextFromUnknown(value);
        const fallback = String(key).trim();

        return {
          value: fallback || label,
          label: label || fallback,
        };
      })
      .filter((x) => x.label);
  }

  return [];
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

async function fetchBossBattleResults(bossInstanceId: string) {
  return api<BossResultsResponse>(
    `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/results`
  );
}

const BossFight: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;

  const [classId, setClassId] = useState<string | null>(null);

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);

  const [template, setTemplate] = useState<BossBattleTemplate | null>(null);
  const [question, setQuestion] = useState<BossQuestion | null>(null);

  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedCurrentQuestion, setHasSubmittedCurrentQuestion] = useState(false);

  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [intermissionLeft, setIntermissionLeft] = useState<number | null>(null);

  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);

  const [showResultModal, setShowResultModal] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [bossResults, setBossResults] = useState<BossResultsResponse | null>(null);

  const { profile } = usePlayerProgression(studentId || "", classId || "");

  useEffect(() => {
    if (student?.classId) {
      setClassId(student.classId);
      return;
    }

    const stored = localStorage.getItem("cq_currentClassId");
    if (stored) {
      setClassId(stored);
      return;
    }

    setClassId(null);
  }, [student?.classId]);

  useEffect(() => {
    feather.replace();
  }, [
    instance?.status,
    template?.title,
    question?.question_id,
    roster.length,
    battleLog.length,
    selectedAnswer,
    submitting,
    showResultModal,
    loadingResults,
  ]);

  useEffect(() => {
    setSelectedAnswer(null);
    setSubmitting(false);
    setHasSubmittedCurrentQuestion(false);
  }, [question?.question_id]);

  const myParticipant = useMemo(() => {
    if (!studentId) return null;
    return participants.find((p) => p.student_id === studentId) ?? null;
  }, [participants, studentId]);

  const joinedRoster = useMemo(() => {
    return roster.filter((r) => r.state === "JOINED");
  }, [roster]);

  const myGuildRoster = useMemo(() => {
    if (!myParticipant?.guild_id) return [];
    return roster.filter((r) => r.guildId === myParticipant.guild_id);
  }, [roster, myParticipant?.guild_id]);

  const partySlots = useMemo<PartySlot[]>(() => {
    const defaults = [
      {
        key: "guardian",
        image: "/assets/boss/MageB.png",
        fallbackName: "Mage",
        position: "front" as const,
      },
      {
        key: "healer",
        image: "/assets/boss/HealerW.png",
        fallbackName: "Healer",
        position: "back-left" as const,
      },
      {
        key: "mage",
        image: "/assets/boss/GuardianB.png",
        fallbackName: "Guardian",
        position: "back-right" as const,
      },
    ];

    return defaults.map((slot, index) => ({
      key: slot.key,
      image: slot.image,
      position: slot.position,
      name: myGuildRoster[index]?.displayName || slot.fallbackName,
    }));
  }, [myGuildRoster]);

  const canAnswer = useMemo(() => {
    if (!instance || !myParticipant || !question) return false;
    if (instance.status !== "QUESTION_ACTIVE") return false;
    if (myParticipant.state !== "JOINED") return false;
    if (myParticipant.is_downed) return false;
    if (hasSubmittedCurrentQuestion) return false;

    if (myParticipant.frozen_until) {
      const frozenUntil = new Date(myParticipant.frozen_until).getTime();
      if (Number.isFinite(frozenUntil) && frozenUntil > Date.now()) return false;
    }

    if (
      instance.mode_type === "TURN_BASED_GUILD" &&
      instance.active_guild_id &&
      myParticipant.guild_id !== instance.active_guild_id
    ) {
      return false;
    }

    return true;
  }, [instance, myParticipant, question, hasSubmittedCurrentQuestion]);

  const freezeSecondsLeft = useMemo(() => {
    if (!myParticipant?.frozen_until) return 0;
    const diff = getRemainingSeconds(myParticipant.frozen_until);
    return diff ?? 0;
  }, [myParticipant?.frozen_until, countdownLeft, questionTimeLeft, intermissionLeft]);

  const myStudentResult = useMemo(() => {
    if (!bossResults?.student_results || !studentId) return null;
    return bossResults.student_results.find((r) => r.student_id === studentId) ?? null;
  }, [bossResults, studentId]);

  const myGuildResult = useMemo(() => {
    if (!bossResults?.guild_results || !myParticipant?.guild_id) return null;
    return bossResults.guild_results.find((r) => r.guild_id === myParticipant.guild_id) ?? null;
  }, [bossResults, myParticipant?.guild_id]);

  const bossHpPercent = useMemo(() => {
    const initial = Number(instance?.initial_boss_hp ?? 0);
    const current = Number(instance?.current_boss_hp ?? 0);
    if (initial <= 0) return 0;
    return Math.max(0, Math.min(100, (current / initial) * 100));
  }, [instance?.initial_boss_hp, instance?.current_boss_hp]);

  const loadParticipants = useCallback(async (bossInstanceId: string) => {
    try {
      const res = await listBossBattleParticipants(bossInstanceId);
      const items = res?.items ?? [];
      setParticipants(items);

      const rosterRows = await Promise.all(
        items.map(async (p) => {
          let displayName = p.student_id;

          try {
            const sp = await getStudentProfile(p.student_id);
            displayName =
              sp?.display_name ||
              sp?.displayName ||
              sp?.name ||
              p.student_id;
          } catch {
            displayName = p.student_id;
          }

          return {
            studentId: p.student_id,
            guildId: p.guild_id,
            state: p.state,
            isDowned: p.is_downed,
            frozenUntil: p.frozen_until,
            displayName,
          } as RosterStudent;
        })
      );

      setRoster(rosterRows);
    } catch (error) {
      console.error("Failed to load participants:", error);
      setParticipants([]);
      setRoster([]);
    }
  }, []);

  const loadInstance = useCallback(async () => {
    if (!classId) {
      setInstance(null);
      setLoadingInstance(false);
      return;
    }

    setLoadingInstance(true);

    try {
      const list = await listBossBattleInstancesByClass(classId, { limit: 25 });
      const items = list?.items ?? [];

      const liveStatuses = [
        "LOBBY",
        "COUNTDOWN",
        "QUESTION_ACTIVE",
        "RESOLVING",
        "INTERMISSION",
      ];

      const picked =
        items.find((x) => liveStatuses.includes(x.status)) ||
        items
          .filter((x) => x.status === "COMPLETED")
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0] ||
        null;

      if (!picked) {
        setInstance(null);
        setTemplate(null);
        setQuestion(null);
        setParticipants([]);
        setRoster([]);
        setLoadingInstance(false);
        return;
      }

      const fresh = await getBossBattleInstance(picked.boss_instance_id);
      setInstance(fresh);

      await loadParticipants(fresh.boss_instance_id);

      try {
        const tpl = await getBossBattleTemplate(fresh.boss_template_id);
        setTemplate(tpl);
      } catch (error) {
        console.error("Failed to load boss template:", error);
        setTemplate(null);
      }

      if (fresh.active_question_id) {
        try {
          const q = await getBossQuestion(fresh.active_question_id);
          setQuestion(q);
        } catch (error) {
          console.error("Failed to load active question:", error);
          setQuestion(null);
        }
      } else {
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to load boss battle instance:", error);
      setInstance(null);
      setTemplate(null);
      setQuestion(null);
      setParticipants([]);
      setRoster([]);
    } finally {
      setLoadingInstance(false);
    }
  }, [classId, loadParticipants]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  useEffect(() => {
    if (!instance) {
      setCountdownLeft(null);
      setQuestionTimeLeft(null);
      setIntermissionLeft(null);
      return;
    }

    const tick = () => {
      setCountdownLeft(getRemainingSeconds(instance.countdown_end_at));
      setQuestionTimeLeft(getRemainingSeconds(instance.question_ends_at));
      setIntermissionLeft(getRemainingSeconds(instance.intermission_ends_at));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    instance?.countdown_end_at,
    instance?.question_ends_at,
    instance?.intermission_ends_at,
    instance,
  ]);

  useEffect(() => {
    if (!instance) return;

    const poll = window.setInterval(() => {
      loadInstance();
    }, 2500);

    return () => window.clearInterval(poll);
  }, [instance?.boss_instance_id, loadInstance, instance]);

  useEffect(() => {
    if (!instance) return;

    const baseLog: BattleLogEntry[] = [];

    if (instance.status === "LOBBY") {
      baseLog.push({
        id: "lobby",
        text: "The teacher has opened the boss lobby. Waiting for battle start.",
        kind: "info",
      });
    }

    if (instance.status === "COUNTDOWN") {
      baseLog.push({
        id: "countdown",
        text: "Roster locked. The battle is about to begin.",
        kind: "warning",
      });
    }

    if (instance.status === "QUESTION_ACTIVE" && question) {
      baseLog.push({
        id: "question-active",
        text: `Question live: ${question.question_text}`,
        kind: "info",
      });
    }

    if (instance.status === "RESOLVING") {
      baseLog.push({
        id: "resolving",
        text: "Answers are being resolved...",
        kind: "warning",
      });
    }

    if (instance.status === "INTERMISSION") {
      baseLog.push({
        id: "intermission",
        text: "Take a breath. The next question is coming soon.",
        kind: "info",
      });
    }

    if (instance.status === "COMPLETED") {
      baseLog.push({
        id: "completed",
        text: `Battle ended with outcome: ${instance.outcome ?? "UNKNOWN"}.`,
        kind: instance.outcome === "WIN" ? "success" : "danger",
      });
    }

    if (instance.status === "ABORTED") {
      baseLog.push({
        id: "aborted",
        text: "The teacher aborted the battle.",
        kind: "danger",
      });
    }

    setBattleLog((prev) => {
      const keepLocal = prev.filter((x) => x.id.startsWith("local-"));
      return [...baseLog, ...keepLocal].slice(-10);
    });
  }, [instance, question]);

  useEffect(() => {
    const status = String(instance?.status || "").toUpperCase();
    if (!instance?.boss_instance_id) return;
    if (!["COMPLETED", "ABORTED"].includes(status)) return;
    if (showResultModal) return;

    let mounted = true;

    (async () => {
      try {
        setLoadingResults(true);
        const res = await fetchBossBattleResults(instance.boss_instance_id);
        if (!mounted) return;
        setBossResults(res);
      } catch (error) {
        console.error("Failed to load boss results:", error);
        if (!mounted) return;
        setBossResults({
          outcome: (instance.outcome as any) || (status === "ABORTED" ? "ABORTED" : "FAIL"),
          completed_at: instance.completed_at,
          fail_reason: instance.fail_reason,
          guild_results: [],
          student_results: [],
        });
      } finally {
        if (mounted) {
          setLoadingResults(false);
          setShowResultModal(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    instance?.status,
    instance?.boss_instance_id,
    instance?.outcome,
    instance?.completed_at,
    instance?.fail_reason,
    showResultModal,
  ]);

  const handleLeaveBattle = async () => {
    if (!instance) {
      window.location.href = "/guilds";
      return;
    }

    const confirmLeave = window.confirm(
      "Are you sure you want to flee the battle?"
    );
    if (!confirmLeave) return;

    try {
      await leaveBossBattle(instance.boss_instance_id);
    } catch (error) {
      console.error("Failed to leave battle:", error);
    }

    window.location.href = "/guilds";
  };

  const handleSubmitAnswer = async () => {
    if (!instance || !question || !studentId || !myParticipant) return;
    if (!canAnswer || submitting || !selectedAnswer) return;

    setSubmitting(true);

    try {
      setBattleLog((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          text: `${student?.displayName ?? "You"} submitted "${selectedAnswer}" for question ${
            question.order_index + 1
          }.`,
          kind: "success",
        },
      ]);
      setHasSubmittedCurrentQuestion(true);
    } catch (error) {
      console.error("Failed to submit answer:", error);

      setBattleLog((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          text: "Failed to submit answer.",
          kind: "danger",
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const renderAnswerButtons = (q: BossQuestion) => {
    const disabledBase = !canAnswer || submitting;
    const type = q.question_type;

    if (type === "TRUE_FALSE") {
      const tfOptions = ["True", "False"];

      return (
        <div className="grid grid-cols-2 gap-3">
          {tfOptions.map((opt, idx) => (
            <button
              key={opt}
              disabled={disabledBase}
              onClick={() => setSelectedAnswer(opt)}
              className={`${
                selectedAnswer === opt
                  ? "from-yellow-500 to-yellow-700 border-yellow-300"
                  : "from-blue-600 to-blue-800 border-blue-400"
              } bg-gradient-to-br hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{idx === 0 ? "T" : "F"}</span>
              </div>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (type === "MCQ_SINGLE") {
      const options = normalizeOptions((q as any).options);
      const letters = ["A", "B", "C", "D", "E", "F"];

      return (
        <div className="grid grid-cols-2 gap-3">
          {options.length === 0 ? (
            <div className="col-span-2 bg-gray-900 p-6 rounded-lg border border-red-700">
              <p className="text-red-300 text-sm text-center">
                No multiple choice options were found for this question.
              </p>
            </div>
          ) : (
            options.map((opt, idx) => (
              <button
                key={`${idx}-${opt.value}-${opt.label}`}
                disabled={disabledBase}
                onClick={() => setSelectedAnswer(opt.value)}
                className={`${
                  selectedAnswer === opt.value
                    ? "from-yellow-500 to-yellow-700 border-yellow-300"
                    : "from-blue-600 to-blue-800 border-blue-400"
                } bg-gradient-to-br hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">{letters[idx] ?? idx + 1}</span>
                </div>
                <div className="break-words whitespace-normal">{opt.label}</div>
              </button>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="bg-gray-900 p-6 rounded-lg border border-red-700">
        <p className="text-red-300 text-sm text-center">
          This question type is not supported yet on the student battle screen.
          <br />
          Supported right now: MCQ_SINGLE and TRUE_FALSE.
        </p>
      </div>
    );
  };

  const renderQuestionArea = () => {
    if (!instance) {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-400 text-center text-sm">
            No active boss battle found for this class.
          </p>
        </div>
      );
    }

    if (instance.status === "LOBBY") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-300 text-center text-sm">
            The lobby is open. Waiting for the teacher to start the countdown.
          </p>
        </div>
      );
    }

    if (instance.status === "COUNTDOWN") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center">
          <p className="text-yellow-300 text-lg font-bold mb-2">Battle starts in</p>
          <p className="text-white text-4xl font-extrabold">
            {formatSeconds(countdownLeft ?? 0)}
          </p>
        </div>
      );
    }

    if (instance.status === "RESOLVING") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-orange-300 text-center text-sm">
            Answers are being resolved. Please wait for the next update.
          </p>
        </div>
      );
    }

    if (instance.status === "INTERMISSION") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center">
          <p className="text-cyan-300 text-lg font-bold mb-2">Intermission</p>
          <p className="text-white text-3xl font-extrabold">
            {formatSeconds(intermissionLeft ?? 0)}
          </p>
        </div>
      );
    }

    if (instance.status === "COMPLETED") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center">
          <p className="text-yellow-300 text-lg font-bold mb-2">Battle Complete</p>
          <p className="text-white text-xl">
            Outcome: <span className="font-extrabold">{instance.outcome ?? "UNKNOWN"}</span>
          </p>
          {instance.fail_reason ? (
            <p className="text-gray-300 text-sm mt-2">Reason: {instance.fail_reason}</p>
          ) : null}
        </div>
      );
    }

    if (instance.status === "ABORTED") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-red-300 text-center text-sm">
            This boss battle was aborted by the teacher.
          </p>
        </div>
      );
    }

    if (instance.status !== "QUESTION_ACTIVE" || !question) {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-400 text-center text-sm">
            Waiting for the current question...
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="bg-gray-900 p-6 rounded-lg mb-6 border border-gray-700 min-h-[140px]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-300/80">
                Question {question.order_index + 1}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Type: {question.question_type.replaceAll("_", " ")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-red-900/60 border border-red-500 text-red-200 text-xs font-semibold">
                Boss HP: {instance.current_boss_hp} / {instance.initial_boss_hp}
              </span>

              {questionTimeLeft !== null ? (
                <span className="px-3 py-1 rounded-full bg-blue-900/60 border border-blue-500 text-blue-200 text-xs font-semibold">
                  Time Left: {formatSeconds(questionTimeLeft)}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-purple-900/60 border border-purple-500 text-purple-200 text-xs font-semibold">
                  Untimed
                </span>
              )}
            </div>
          </div>

          <p className="text-white text-base leading-7">{question.question_text}</p>

          {instance.mode_type === "TURN_BASED_GUILD" && instance.active_guild_id ? (
            <div className="mt-4 text-sm text-cyan-300">
              Active Guild: <span className="font-bold">{instance.active_guild_id}</span>
            </div>
          ) : null}

          {myParticipant?.state === "SPECTATE" ? (
            <div className="mt-4 text-sm text-gray-300">
              You are currently spectating and cannot submit answers.
            </div>
          ) : null}

          {myParticipant?.state === "KICKED" ? (
            <div className="mt-4 text-sm text-red-300">
              You were removed from this boss battle.
            </div>
          ) : null}

          {myParticipant?.is_downed ? (
            <div className="mt-4 text-sm text-red-300">
              You are downed and can no longer answer.
            </div>
          ) : null}

          {freezeSecondsLeft > 0 ? (
            <div className="mt-4 text-sm text-orange-300">
              You are frozen for {freezeSecondsLeft}s after a wrong answer.
            </div>
          ) : null}

          {hasSubmittedCurrentQuestion ? (
            <div className="mt-4 text-sm text-emerald-300">
              Answer submitted for this question.
            </div>
          ) : null}

          {submitting ? (
            <div className="mt-4 text-sm text-yellow-300">
              Submitting your answer...
            </div>
          ) : null}
        </div>

        {renderAnswerButtons(question)}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || !canAnswer || submitting}
            className="inline-flex items-center bg-emerald-600 text-white border-2 border-emerald-800 rounded-md px-4 py-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i data-feather="send" className="mr-2"></i>
            <span className="text-sm font-medium">
              {submitting ? "Submitting..." : "Submit Answer"}
            </span>
          </button>
        </div>
      </>
    );
  };

  if (!studentId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold mb-3">No student session found</h1>
          <p className="text-slate-300">Please log in as a student first.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="font-poppins bg-[url('/assets/boss-bckgnd.png')] bg-cover bg-center bg-no-repeat min-h-screen">
        <nav className="bg-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <Link
                    to="/character"
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                    <span className="text-xl font-bold"> ClassQuest</span>
                  </Link>
                </div>
              </div>

              <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
                <Link
                  to="/character"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Character
                </Link>

                <Link
                  to="/guilds"
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
                >
                  Guilds
                </Link>

                <Link
                  to="/leaderboards"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Leaderboard
                </Link>

                <div className="flex items-center ml-4">
                  <Link
                    to="/shop"
                    className="flex items-center bg-primary-600 px-3 py-1 rounded-full hover:bg-primary-700 transition"
                  >
                    <img
                      src="/assets/icons/gold-bar.png"
                      alt="Gold"
                      className="h-5 w-5 mr-1"
                    />
                    <span className="text-white font-medium">
                      {Number(profile?.gold ?? 0).toLocaleString()}
                    </span>
                  </Link>
                </div>

                <div className="relative ml-3">
                  <button
                    id="user-menu-button"
                    className="flex items-center text-sm rounded-full focus:outline-none"
                  >
                    <img
                      className="h-8 w-8 rounded-full"
                      src="http://static.photos/people/200x200/8"
                      alt=""
                    />
                    <span className="ml-2 text-sm font-medium">
                      {student?.displayName ?? "Student"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="-mr-2 flex items-center md:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600 focus:outline-none"
                >
                  <i data-feather="menu" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative h-[560px] w-[1300px] max-w-[95%] mx-auto mb-8">
          <div
              className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 bg-cover bg-center"
              style={{
                backgroundImage: "url('/assets/background/goblin_stage.png')",
                backgroundPosition: "center 80%",
              }}
            >
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={handleLeaveBattle}
                className="inline-flex items-center bg-lime-600 text-white border-2 border-lime-900 rounded-md px-3 py-2 hover:bg-lime-700"
              >
                <i data-feather="x" className="mr-2"></i>
                <span className="text-sm font-medium">Flee Battle</span>
              </button>
            </div>

            <div className="absolute top-4 right-4 z-20 flex flex-wrap gap-2 justify-end">
              <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-600 text-slate-100 text-xs font-semibold">
                {loadingInstance ? "Loading..." : getStatusLabel(instance?.status)}
              </span>

              {myParticipant ? (
                <span className="px-3 py-1 rounded-full bg-emerald-900/80 border border-emerald-500 text-emerald-200 text-xs font-semibold">
                  You: {myParticipant.state}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-900/80 border border-amber-500 text-amber-200 text-xs font-semibold">
                  Not in roster
                </span>
              )}
            </div>

            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[92%]">
              <div className="rounded-2xl bg-black/70 border border-red-500/60 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-200 text-xs uppercase tracking-[0.25em] font-bold">
                    Boss HP
                  </span>
                  <span className="text-white text-sm font-bold">
                    {Number(instance?.current_boss_hp ?? 0).toLocaleString()} /{" "}
                    {Number(instance?.initial_boss_hp ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="w-full h-5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-300"
                    style={{ width: `${bossHpPercent}%` }}
                  />
                </div>

                <div className="mt-2 text-center text-xs text-slate-300">
                  {template?.title ?? "Goblin King"}
                </div>
              </div>
            </div>

            <div className="absolute inset-0 z-10">
              {/* Party side */}
              <div className="absolute left-[4%] bottom-[14%] w-[42%] h-[64%]">
                <div className="absolute left-[17%] top-[16%] flex flex-col items-center">
                  <img
                    src="/assets/boss/HealerW.png"
                    alt="Healer"
                    className="w-28 md:w-32 drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)]"
                  />
                  <div className="mt-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white border border-white/10">
                    {partySlots.find((p) => p.position === "back-left")?.name || "Healer"}
                  </div>
                </div>

                <div className="absolute left-[48%] -translate-x-1/2 top-[28%] flex flex-col items-center z-10">
                  <img
                    src="/assets/boss/MageB.png"
                    alt="Mage"
                    className="w-36 md:w-40 drop-shadow-[0_14px_20px_rgba(0,0,0,0.7)]"
                  />
                  <div className="mt-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white border border-white/10">
                    {partySlots.find((p) => p.position === "front")?.name || "Guardian"}
                  </div>
                </div>

                <div className="absolute right-[14%] top-[16%] flex flex-col items-center">
                  <img
                    src="/assets/boss/GuardianB.png"
                    alt="Guardian"
                    className="w-28 md:w-32 drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)]"
                  />
                  <div className="mt-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white border border-white/10">
                    {partySlots.find((p) => p.position === "back-right")?.name || "Guardian"}
                  </div>
                </div>
              </div>

              {/* Boss side */}
              <div className="absolute right-[6%] bottom-[12%] w-[34%] h-[70%] flex items-end justify-center">
                <img
                  src="/assets/boss/goblin_king.png"
                  alt="Goblin King"
                  className="w-[260px] md:w-[320px] lg:w-[360px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)]"
                />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 h-32 overflow-y-auto border-t-2 border-yellow-500 z-20">
              <div className="text-sm font-mono space-y-2">
                {battleLog.length === 0 ? (
                  <p className="text-slate-400">Battle log will appear here...</p>
                ) : (
                  battleLog.map((entry) => (
                    <p
                      key={entry.id}
                      className={
                        entry.kind === "success"
                          ? "text-emerald-300"
                          : entry.kind === "danger"
                          ? "text-red-300"
                          : entry.kind === "warning"
                          ? "text-yellow-300"
                          : "text-slate-200"
                      }
                    >
                      • {entry.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 px-6 lg:px-0 max-w-7xl mx-auto">
          <div className="battle-box bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500 rounded-xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-yellow-300 flex items-center gap-2">
              <i data-feather="book-open" className="text-yellow-400"></i>
              Problem
            </h2>

            {renderQuestionArea()}
          </div>
        </div>
      </div>

      {showResultModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-gray-900 to-slate-900 shadow-2xl text-white overflow-hidden">
            <div className="bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-4 border-b border-white/10">
              <h2 className="text-2xl font-bold">
                {bossResults?.outcome === "WIN"
                  ? "Victory!"
                  : bossResults?.outcome === "ABORTED"
                  ? "Battle Aborted"
                  : "Battle Finished"}
              </h2>
              <p className="text-sm text-white/80 mt-1">
                Completed: {formatDateTime(bossResults?.completed_at || instance?.completed_at)}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {loadingResults ? (
                <div className="text-center text-slate-300">Loading results...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-yellow-300/80 mb-2">
                        Your Result
                      </p>
                      <div className="space-y-1 text-sm">
                        <p>
                          Correct: <span className="font-bold">{myStudentResult?.total_correct ?? 0}</span>
                        </p>
                        <p>
                          Wrong: <span className="font-bold">{myStudentResult?.total_incorrect ?? 0}</span>
                        </p>
                        <p>
                          Attempts: <span className="font-bold">{myStudentResult?.total_attempts ?? 0}</span>
                        </p>
                        <p>
                          Damage: <span className="font-bold">{myStudentResult?.total_damage_to_boss ?? 0}</span>
                        </p>
                        <p>
                          Hearts Lost: <span className="font-bold">{myStudentResult?.hearts_lost ?? 0}</span>
                        </p>
                        <p>
                          XP: <span className="font-bold">{myStudentResult?.xp_awarded ?? 0}</span>
                        </p>
                        <p>
                          Gold: <span className="font-bold">{myStudentResult?.gold_awarded ?? 0}</span>
                        </p>
                        <p>
                          Status: <span className="font-bold">{myStudentResult?.participation_state ?? myParticipant?.state ?? "—"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-2">
                        Guild Result
                      </p>
                      <div className="space-y-1 text-sm">
                        <p>
                          Correct: <span className="font-bold">{myGuildResult?.guild_total_correct ?? 0}</span>
                        </p>
                        <p>
                          Wrong: <span className="font-bold">{myGuildResult?.guild_total_incorrect ?? 0}</span>
                        </p>
                        <p>
                          Attempts: <span className="font-bold">{myGuildResult?.guild_total_attempts ?? 0}</span>
                        </p>
                        <p>
                          Damage: <span className="font-bold">{myGuildResult?.guild_total_damage_to_boss ?? 0}</span>
                        </p>
                        <p>
                          Hearts Lost: <span className="font-bold">{myGuildResult?.guild_total_hearts_lost ?? 0}</span>
                        </p>
                        <p>
                          Guild XP: <span className="font-bold">{myGuildResult?.guild_xp_awarded_total ?? 0}</span>
                        </p>
                        <p>
                          Guild Gold: <span className="font-bold">{myGuildResult?.guild_gold_awarded_total ?? 0}</span>
                        </p>
                        <p>
                          Members Downed: <span className="font-bold">{myGuildResult?.guild_members_downed ?? 0}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-2">
                      Battle Outcome
                    </p>
                    <p className="text-lg font-bold">
                      {bossResults?.outcome || instance?.outcome || "UNKNOWN"}
                    </p>
                    {(bossResults?.fail_reason || instance?.fail_reason) ? (
                      <p className="text-sm text-slate-300 mt-2">
                        Reason: {bossResults?.fail_reason || instance?.fail_reason}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 rounded-md border border-slate-500 text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.location.href = "/guilds";
                }}
                className="px-4 py-2 rounded-md bg-emerald-600 border border-emerald-800 text-white hover:bg-emerald-700"
              >
                Back to Guilds
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BossFight;