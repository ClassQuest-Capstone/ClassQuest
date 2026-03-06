// src/pages/students/bossFight.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";

import "../../styles/boss.css";

import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

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

function coerceOptions(options: any): string[] {
  if (!options) return [];

  if (Array.isArray(options)) {
    return options.map((x) => String(x));
  }

  if (typeof options === "object") {
    const values = Object.values(options);
    if (values.length > 0) return values.map((x) => String(x));
  }

  return [];
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

  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [intermissionLeft, setIntermissionLeft] = useState<number | null>(null);

  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);

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
  ]);

  const myParticipant = useMemo(() => {
    if (!studentId) return null;
    return participants.find((p) => p.student_id === studentId) ?? null;
  }, [participants, studentId]);

  const joinedRoster = useMemo(() => {
    return roster.filter((r) => r.state === "JOINED");
  }, [roster]);

  const canAnswer = useMemo(() => {
    if (!instance || !myParticipant || !question) return false;
    if (instance.status !== "QUESTION_ACTIVE") return false;
    if (myParticipant.state !== "JOINED") return false;
    if (myParticipant.is_downed) return false;

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
  }, [instance, myParticipant, question]);

  const freezeSecondsLeft = useMemo(() => {
    if (!myParticipant?.frozen_until) return 0;
    const diff = getRemainingSeconds(myParticipant.frozen_until);
    return diff ?? 0;
  }, [myParticipant?.frozen_until, countdownLeft, questionTimeLeft, intermissionLeft]);

  const loadParticipants = useCallback(
    async (bossInstanceId: string) => {
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
    },
    []
  );

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

      let picked =
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

  const handleAnswerClick = async (answer: string) => {
    if (!instance || !question || !studentId || !myParticipant) return;
    if (!canAnswer) return;

    setSubmitting(true);
    setSelectedAnswer(answer);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setBattleLog((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          text: `${student?.displayName ?? "You"} selected "${answer}" for question ${
            question.order_index + 1
          }.`,
          kind: "success",
        },
      ]);
    } catch (error) {
      console.error("Failed to submit answer:", error);

      setBattleLog((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          text: `Failed to submit answer.`,
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
              onClick={() => handleAnswerClick(opt)}
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
      const options = coerceOptions(q.options);
      const letters = ["A", "B", "C", "D", "E", "F"];

      return (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt, idx) => (
            <button
              key={`${idx}-${opt}`}
              disabled={disabledBase}
              onClick={() => handleAnswerClick(opt)}
              className={`${
                selectedAnswer === opt
                  ? "from-yellow-500 to-yellow-700 border-yellow-300"
                  : "from-blue-600 to-blue-800 border-blue-400"
              } bg-gradient-to-br hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{letters[idx] ?? idx + 1}</span>
              </div>
              {opt}
            </button>
          ))}
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
        </div>

        {renderAnswerButtons(question)}
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
    <div className="font-poppins bg-[url(public/assets/1.jpg)] bg-cover bg-center bg-no-repeat min-h-screen">
      {/* Nav Bar */}
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

      {/* Boss + scene */}
      <div className="relative h-[500px] w-[1300px] max-w-[95%] mx-auto mb-8">
        <div className="absolute inset-0 bg-black/30 rounded-xl backdrop-blur-sm flex flex-col mt-3 overflow-hidden border border-white/10">
          {/* Top controls */}
          <div className="flex items-start justify-between gap-4 p-4">
            <button
              onClick={handleLeaveBattle}
              className="inline-flex items-center bg-lime-600 text-white border-2 border-lime-900 rounded-md px-3 py-2 hover:bg-lime-700"
            >
              <i data-feather="x" className="mr-2"></i>
              <span className="text-sm font-medium">Flee Battle</span>
            </button>

            <div className="flex flex-wrap gap-2 justify-end">
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-slate-100 text-xs font-semibold">
                {loadingInstance ? "Loading..." : getStatusLabel(instance?.status)}
              </span>

              {instance ? (
                <span className="px-3 py-1 rounded-full bg-red-900/60 border border-red-500 text-red-200 text-xs font-semibold">
                  Boss HP: {instance.current_boss_hp}/{instance.initial_boss_hp}
                </span>
              ) : null}

              {myParticipant ? (
                <span className="px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500 text-emerald-200 text-xs font-semibold">
                  You: {myParticipant.state}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-900/60 border border-amber-500 text-amber-200 text-xs font-semibold">
                  Not in roster
                </span>
              )}
            </div>
          </div>

          {/* Battle scene content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-36">
            {/* Left: players / guild */}
            <div className="flex flex-col gap-3 p-4">
              <div className="rounded-xl bg-black/35 border border-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
                  Present Students
                </p>

                <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                  {roster.length === 0 ? (
                    <div className="text-sm text-slate-300">No roster data yet.</div>
                  ) : (
                    roster.map((member) => (
                      <div
                        key={member.studentId}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                      >
                        <div>
                          <p className="text-white font-semibold">
                            {member.displayName}
                            {member.studentId === studentId ? " (You)" : ""}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Guild: {member.guildId}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs px-2 py-1 rounded-full border border-slate-600 bg-slate-800 text-slate-100">
                            {member.state}
                          </span>
                          {member.isDowned ? (
                            <span className="text-xs px-2 py-1 rounded-full border border-red-600 bg-red-900/60 text-red-200">
                              Downed
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: boss info */}
            <div className="flex flex-col items-center justify-center p-4">
              <div className="w-full rounded-xl bg-black/35 border border-white/10 p-6 text-center">
                <p className="text-sm uppercase tracking-wide text-white/70">
                  {template?.subject || "Boss"} Encounter
                </p>

                <p className="text-3xl font-extrabold text-white mt-2">
                  {template?.title ?? "No Active Boss"}
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  {template?.description ?? "Waiting for battle data..."}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase text-slate-400 mb-2">Battle Mode</p>
                    <p className="text-white font-bold">
                      {instance?.mode_type?.replaceAll("_", " ") ?? "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase text-slate-400 mb-2">Question Flow</p>
                    <p className="text-white font-bold">
                      {instance?.question_selection_mode?.replaceAll("_", " ") ?? "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase text-slate-400 mb-2">Joined Fighters</p>
                    <p className="text-white font-bold">{joinedRoster.length}</p>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase text-slate-400 mb-2">Current Question</p>
                    <p className="text-white font-bold">
                      {question ? `#${question.order_index + 1}` : "None"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Battle log */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 h-32 overflow-y-auto border-t-2 border-yellow-500">
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

      {/* Problem / answers */}
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
  );
};

export default BossFight;