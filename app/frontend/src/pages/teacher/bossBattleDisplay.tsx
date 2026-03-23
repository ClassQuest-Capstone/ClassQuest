// src/pages/teacher/bossBattleDisplay.tsx
// Read-only display screen — meant to be projected for the class to see.
// Auto-polls every 3 seconds. No auth required beyond what the API enforces.
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { getBossBattleInstance } from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import { getBossQuestion } from "../../api/bossQuestions/client.js";
import type { BossQuestion } from "../../api/bossQuestions/types.js";

type MCQOption = { text: string };

function normalizeOptions(options: any): MCQOption[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) =>
    typeof o === "string" ? { text: o } : { text: String(o?.text ?? o?.label ?? "") }
  );
}

function normalizeCorrectIndex(correct_answer: any): number {
  if (typeof correct_answer === "number") return correct_answer;
  if (correct_answer && typeof correct_answer === "object" && "index" in correct_answer)
    return Number(correct_answer.index);
  return -1;
}

function normalizeCorrectBool(correct_answer: any): boolean {
  if (typeof correct_answer === "boolean") return correct_answer;
  if (correct_answer === "true") return true;
  if (correct_answer === "false") return false;
  return true;
}

function getSecondsRemaining(endAt?: string | null) {
  if (!endAt) return 0;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function BossBattleDisplay() {
  const { bossInstanceId } = useParams<{ bossInstanceId: string }>();

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [template, setTemplate] = useState<BossBattleTemplate | null>(null);
  const [question, setQuestion] = useState<BossQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const prevQuestionIdRef = useRef<string | null | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchAll() {
    if (!bossInstanceId) return;
    try {
      const inst = await getBossBattleInstance(bossInstanceId);
      setInstance(inst);

      if (inst?.boss_template_id) {
        try {
          const tpl = await getBossBattleTemplate(inst.boss_template_id);
          setTemplate(tpl);
        } catch {}
      }

      const qId = inst?.active_question_id ?? null;
      if (qId !== prevQuestionIdRef.current) {
        prevQuestionIdRef.current = qId;
        if (qId) {
          try {
            const q = await getBossQuestion(qId);
            setQuestion(q);
          } catch {
            setQuestion(null);
          }
        } else {
          setQuestion(null);
        }
      }
    } catch {}
  }

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bossInstanceId]);

  // Countdown timer
  useEffect(() => {
    const endsAt = (instance as any)?.question_ends_at;
    if (instance?.status !== "QUESTION_ACTIVE" || !endsAt) {
      setTimeLeft(0);
      return;
    }
    const tick = () => setTimeLeft(getSecondsRemaining(endsAt));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [instance?.status, (instance as any)?.question_ends_at]);

  const initialHp = instance?.initial_boss_hp ?? 0;
  const currentHp = instance?.current_boss_hp ?? 0;
  const hpPercent = initialHp > 0 ? Math.max(0, Math.min(100, (currentHp / initialHp) * 100)) : 0;

  const status = instance?.status ?? "";
  const opts = normalizeOptions((question as any)?.options);
  const ci = normalizeCorrectIndex((question as any)?.correct_answer);
  const tfCorrect = normalizeCorrectBool((question as any)?.correct_answer);
  const isResolved = status === "INTERMISSION" || status === "RESOLVING";
  const isMCQ = question?.question_type === "MCQ_SINGLE";
  const isTF = question?.question_type === "TRUE_FALSE";

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-gray-900 flex flex-col"
      style={{ backgroundImage: "url('/assets/background/guilds-bg.png')" }}
    >
      {/* ── Arena ── */}
      <div className="relative h-[45vh] shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center overflow-hidden"
          style={{
            backgroundImage: "url('/assets/background/goblin_stage.png')",
            backgroundPosition: "center 80%",
          }}
        >
          {/* Boss HP */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[360px] max-w-[70%]">
            <div className="rounded-2xl bg-black/70 border border-red-500/60 px-4 py-3 shadow-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-red-200 text-xs uppercase tracking-[0.2em] font-bold">Boss HP</span>
                <span className="text-white text-xs font-bold">
                  {initialHp > 0 ? ((currentHp / initialHp) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
              <div className="w-full h-4 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-500"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <div className="mt-1 text-center text-xs text-slate-300">{template?.title ?? "Boss Battle"}</div>
            </div>
          </div>

          {/* Characters */}
          <div className="absolute inset-0 z-10">
            <div className="absolute left-[4%] bottom-[30%] w-[42%] flex items-end justify-center">
              <img
                src="/assets/boss/bossAvatar.png"
                alt="Party"
                className="w-40 md:w-52 drop-shadow-[0_14px_20px_rgba(0,0,0,0.7)]"
              />
            </div>
            <div className="absolute right-[6%] bottom-[8%] w-[34%] h-[70%] flex items-end justify-center">
              <img
                src="/assets/boss/goblin_king.png"
                alt="Boss"
                className="w-[200px] md:w-[260px] lg:w-[300px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>

          {/* Status strip */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 py-3 border-t-2 border-yellow-500 z-20 flex items-center gap-6">
            {status === "QUESTION_ACTIVE" && timeLeft > 0 && (
              <span className={`text-sm font-bold ${timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-slate-300"}`}>
                ⏱ {timeLeft}s — Q{instance ? (instance.current_question_index + 1) : "?"}
              </span>
            )}
            {status === "INTERMISSION" && (
              <span className="text-slate-300 text-sm font-mono">Intermission — next question loading…</span>
            )}
            {status === "COMPLETED" && (
              <span className="text-yellow-300 text-sm font-bold">
                {(instance as any)?.outcome === "WIN" ? "⚔️ Victory!" : "💀 Defeat"}
              </span>
            )}
            {status === "LOBBY" && (
              <span className="text-slate-300 text-sm">Waiting for students to join…</span>
            )}
            {status === "COUNTDOWN" && (
              <span className="text-blue-300 text-sm font-bold animate-pulse">Get ready…</span>
            )}
            {!["QUESTION_ACTIVE","INTERMISSION","COMPLETED","LOBBY","COUNTDOWN"].includes(status) && (
              <span className="text-slate-400 text-sm">{status || "Loading…"}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Question panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        {status === "QUESTION_ACTIVE" && question ? (
          <div className="w-full max-w-3xl">
            {/* Question number + text */}
            <div className="bg-black/70 border border-white/20 rounded-2xl px-6 py-5 mb-5 text-center shadow-2xl">
              <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-2">
                Question {(instance?.current_question_index ?? 0) + 1}
              </p>
              <p className="text-white text-2xl md:text-3xl font-bold leading-snug">
                {question.question_text}
              </p>
            </div>

            {/* MCQ options */}
            {isMCQ && opts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {opts.map((o, i) => {
                  const revealed = isResolved;
                  const isCorrect = i === ci;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-4 rounded-xl px-5 py-4 border-2 shadow-lg transition-all
                        ${revealed && isCorrect
                          ? "bg-green-700/80 border-green-400 text-white"
                          : revealed && !isCorrect
                          ? "bg-gray-800/60 border-gray-600 text-gray-400"
                          : "bg-black/60 border-white/30 text-white"
                        }`}
                    >
                      <span className={`text-xl font-bold w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2
                        ${revealed && isCorrect ? "border-green-300 bg-green-600" : "border-white/40 bg-white/10"}`}>
                        {OPTION_LETTERS[i] ?? i + 1}
                      </span>
                      <span className="text-lg font-semibold leading-snug">{o.text}</span>
                      {revealed && isCorrect && (
                        <span className="ml-auto text-green-300 font-bold text-xl">✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True / False options */}
            {isTF && (
              <div className="grid grid-cols-2 gap-4">
                {[true, false].map((val) => {
                  const revealed = isResolved;
                  const isCorrect = val === tfCorrect;
                  return (
                    <div
                      key={String(val)}
                      className={`flex items-center justify-center rounded-xl px-6 py-6 border-2 shadow-lg text-2xl font-bold
                        ${revealed && isCorrect
                          ? "bg-green-700/80 border-green-400 text-white"
                          : revealed && !isCorrect
                          ? "bg-gray-800/60 border-gray-600 text-gray-400"
                          : val
                          ? "bg-blue-700/60 border-blue-400 text-white"
                          : "bg-red-700/60 border-red-400 text-white"
                        }`}
                    >
                      {val ? "True" : "False"}
                      {revealed && isCorrect && <span className="ml-3">✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : status === "INTERMISSION" ? (
          <div className="text-white text-2xl font-bold text-center animate-pulse">
            ⏳ Next question loading…
          </div>
        ) : status === "COMPLETED" ? (
          <div className="text-yellow-300 text-3xl font-bold text-center">
            {(instance as any)?.outcome === "WIN" ? "⚔️ Victory! The boss is defeated!" : "💀 The boss wins this round!"}
          </div>
        ) : status === "LOBBY" || status === "COUNTDOWN" ? (
          <div className="text-white text-2xl font-bold text-center">
            {status === "COUNTDOWN" ? "⚔️ Get ready…" : "Waiting for students to join…"}
          </div>
        ) : (
          <div className="text-white/50 text-lg text-center">Waiting for the battle to begin…</div>
        )}
      </div>
    </div>
  );
}
