// ProblemSolve.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import feather from "feather-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getQuestInstance, type QuestInstance } from "../../api/questInstances.js";
import { listQuestQuestions, type QuestQuestion } from "../../api/questQuestions.js";
import {
  getResponsesByInstanceAndStudent,
  upsertResponse,
  type QuestQuestionResponse,
} from "../../api/questQuestionResponses.js";

import { getPlayerState, upsertPlayerState } from "../../api/playerStates.js";
import { getStudentEnrollments, type EnrollmentItem } from "../../api/classEnrollments.js";
import { getQuestTemplate, type QuestTemplate } from "../../api/questTemplates.js";
import { createTransaction } from "../../api/rewardTransactions.js";

// --------------------
// Student helper
// --------------------
type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  class_id?: string; // sometimes stored on the student object
};

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed;
  } catch {}
  return null;
}

function safeStr(v: unknown) {
  return String(v ?? "");
}

function toBool(v: any): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return undefined;
}

function normalizeId(v: any, fallback: string) {
  const s = safeStr(v).trim();
  return s ? s : fallback;
}

// --------------------
// UI model
// --------------------
type UiOption = { id: string; text: string; isCorrect?: boolean };

type UiQuestion = {
  id: string; // question_id
  type: string;
  title: string;
  difficulty: string;
  xpValue: number; // max points
  questionText: string;
  answerOptions: UiOption[];
  explanation: string;
  hint: string;
  tags: string;
  timeLimit: number;
  goldReward: number;

  // grading metadata
  hasGradingKey: boolean;
  correctOptionId?: string;
  correctOptionText?: string;
};

function normalizeOptions(raw: any): UiOption[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.choices) ? raw.choices : [];

  return arr
    .map((opt: any, idx: number) => {
      if (typeof opt === "string") return { id: `opt-${idx}`, text: opt };

      const text = safeStr(opt?.text ?? opt?.label ?? opt?.value ?? "");
      const id = normalizeId(opt?.id, `opt-${idx}`);

      const isCorrect =
        toBool(opt?.isCorrect) ??
        toBool(opt?.is_correct) ??
        toBool(opt?.correct) ??
        toBool(opt?.is_right) ??
        toBool(opt?.isRight) ??
        undefined;

      return { id, text, isCorrect };
    })
    .filter((o) => o.text);
}

/**
 * backend sends:
 *   correct_answer: { choiceId: "1" }
 */
function extractCorrectToken(q: any): string {
  const choiceId =
    q?.correct_answer?.choiceId ??
    q?.correct_answer?.choice_id ??
    q?.correctAnswer?.choiceId ??
    q?.correctAnswer?.choice_id;

  const choiceIdStr = safeStr(choiceId).trim();
  if (choiceIdStr) return `__ID__:${choiceIdStr}`;

  const idCandidates = [
    q?.correct_option_id,
    q?.correctOptionId,
    q?.correct_choice_id,
    q?.correctChoiceId,
    q?.correct_answer_id,
    q?.correctAnswerId,
    q?.answer_option_id,
    q?.answerOptionId,
    q?.solution_option_id,
    q?.solutionOptionId,
  ];
  for (const c of idCandidates) {
    const s = safeStr(c).trim();
    if (s) return `__ID__:${s}`;
  }

  const idxRaw =
    q?.correct_option_index ??
    q?.correctOptionIndex ??
    q?.correct_index ??
    q?.correctIndex ??
    q?.answer_index ??
    q?.answerIndex;

  const n = Number(idxRaw);
  if (Number.isFinite(n)) return `__INDEX__:${n}`;

  const textRaw = q?.correct_answer ?? q?.correctAnswer ?? q?.answer_text ?? q?.answerText ?? q?.solution;
  const txt = safeStr(textRaw).trim();
  if (txt) return `__TEXT__:${txt}`;

  return "";
}

function normalizeQuestion(q: QuestQuestion, index: number): UiQuestion {
  const anyQ: any = q as any;

  const opts = normalizeOptions(anyQ.options);

  let optionsWithCorrect: UiOption[] = opts;
  let hasGradingKey = false;
  let correctOptionId: string | undefined;
  let correctOptionText: string | undefined;

  const token = extractCorrectToken(anyQ);

  if (opts.some((o) => typeof o.isCorrect === "boolean")) {
    optionsWithCorrect = opts;
    hasGradingKey = true;

    const correctOpt = opts.find((o) => o.isCorrect === true);
    if (correctOpt) {
      correctOptionId = correctOpt.id;
      correctOptionText = correctOpt.text;
    }
  }

  if (!hasGradingKey && token) {
    if (token.startsWith("__ID__:")) {
      const id = token.slice("__ID__:".length).trim();
      const found = opts.find((o) => o.id === id);

      if (found) {
        correctOptionId = found.id;
        correctOptionText = found.text;
        hasGradingKey = true;
        optionsWithCorrect = opts.map((o) => ({ ...o, isCorrect: o.id === found.id }));
      } else {
        const asNumber = Number(id);
        if (Number.isFinite(asNumber)) {
          const pick = opts[asNumber] ?? opts[asNumber - 1];
          if (pick) {
            correctOptionId = pick.id;
            correctOptionText = pick.text;
            hasGradingKey = true;
            optionsWithCorrect = opts.map((o) => ({ ...o, isCorrect: o.id === pick.id }));
          }
        }
      }
    } else if (token.startsWith("__INDEX__:")) {
      const rawIdx = Number(token.slice("__INDEX__:".length));
      const pick = opts[rawIdx] ?? opts[rawIdx - 1];
      if (pick) {
        correctOptionId = pick.id;
        correctOptionText = pick.text;
        hasGradingKey = true;
        optionsWithCorrect = opts.map((o) => ({ ...o, isCorrect: o.id === pick.id }));
      }
    } else if (token.startsWith("__TEXT__:")) {
      const correctText = token.slice("__TEXT__:".length).trim().toLowerCase();
      const pick = opts.find((o) => o.text.trim().toLowerCase() === correctText);
      if (pick) {
        correctOptionId = pick.id;
        correctOptionText = pick.text;
        hasGradingKey = true;
        optionsWithCorrect = opts.map((o) => ({ ...o, isCorrect: o.id === pick.id }));
      }
    }
  }

  return {
    id: anyQ.question_id,
    type: safeStr(anyQ.question_format || anyQ.question_type || "OTHER"),
    title: anyQ.title ? safeStr(anyQ.title) : `Question ${index + 1}`,
    difficulty: safeStr(anyQ.difficulty || "MEDIUM"),
    xpValue: Number(anyQ.max_points ?? 10) || 10,
    questionText: safeStr(anyQ.prompt || ""),
    answerOptions: optionsWithCorrect,
    explanation: safeStr(anyQ.explanation || ""),
    hint: safeStr(anyQ.hint || ""),
    tags: safeStr(anyQ.tags || ""),
    timeLimit: Number(anyQ.time_limit_seconds ?? 60) || 60,
    goldReward: Number(anyQ.gold_reward ?? 0) || 0,
    hasGradingKey,
    correctOptionId,
    correctOptionText,
  };
}

function getSavedSelectedOptionId(answer_raw: any): string | null {
  if (!answer_raw) return null;
  if (typeof answer_raw.selected_option_id === "string") return answer_raw.selected_option_id;
  if (typeof answer_raw.option_id === "string") return answer_raw.option_id;
  if (typeof answer_raw.value === "string") return answer_raw.value;
  return null;
}

function getSavedTextAnswer(answer_raw: any): string | null {
  if (!answer_raw) return null;
  if (typeof answer_raw.text === "string") return answer_raw.text;
  if (typeof answer_raw.answer === "string") return answer_raw.answer;
  return null;
}

// --------------------
// Local “hide quest” mechanism (student-only)
// --------------------
function markQuestExpired(studentId: string, questInstanceId: string) {
  try {
    localStorage.setItem(`cq_expired_quest::${studentId}::${questInstanceId}`, "1");
  } catch {}
}

const ProblemSolve: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const questInstanceId = params.get("quest_instance_id") || "";
  const questTemplateIdFromUrl = params.get("quest_template_id") || "";

  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id || "";
  const studentName = student?.displayName ?? "Student";

  // Loaded data
  const [instance, setInstance] = useState<QuestInstance | null>(null);
  const [templateId, setTemplateId] = useState<string>(questTemplateIdFromUrl);
  const [questions, setQuestions] = useState<UiQuestion[]>([]);
  const [questTemplate, setQuestTemplate] = useState<QuestTemplate | null>(null);

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>([]);
  const [shortAnswers, setShortAnswers] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Rewards awarding
  const [claimingRewards, setClaimingRewards] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<null | { xp: number; gold: number }>(null);
  const [claimRewardsError, setClaimRewardsError] = useState<string | null>(null);

  function rewardsClaimKey(sid: string, qi: string) {
    return `cq_rewards_claimed::${sid}::${qi}`;
  }
  function hasClaimedRewards(sid: string, qi: string) {
    try {
      return localStorage.getItem(rewardsClaimKey(sid, qi)) === "1";
    } catch {
      return false;
    }
  }
  function markRewardsClaimed(sid: string, qi: string) {
    try {
      localStorage.setItem(rewardsClaimKey(sid, qi), "1");
    } catch {}
  }

  // Feedback
  const [feedback, setFeedback] = useState<{ kind: "ok" | "bad" | "info"; msg: string } | null>(null);

  // XP decreases on wrong attempts
  const [remainingXp, setRemainingXp] = useState<number[]>([]);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  // Responses
  const [responses, setResponses] = useState<QuestQuestionResponse[]>([]);
  const responsesByQuestionId = useMemo(() => {
    const m = new Map<string, QuestQuestionResponse>();
    (responses || []).forEach((r) => m.set(r.question_id, r));
    return m;
  }, [responses]);

  const answeredCount = useMemo(() => {
    if (!questions.length) return 0;
    let c = 0;
    for (const q of questions) if (responsesByQuestionId.has(q.id)) c++;
    return c;
  }, [questions, responsesByQuestionId]);

  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  async function refreshResponses() {
    if (!questInstanceId || !studentId) return;
    const resp = await getResponsesByInstanceAndStudent(questInstanceId, studentId, { limit: 500 });
    setResponses(resp.responses || []);
    return resp.responses || [];
  }

  // ✅ totals now include BASE quest rewards too
  function computeTotalsFromResponses(latest: QuestQuestionResponse[], qs: UiQuestion[], tpl: QuestTemplate | null) {
    const questionXp = (latest || []).reduce(
      (sum, r: any) => sum + (Number(r?.answer_raw?.awarded_xp ?? 0) || 0),
      0
    );

    const answeredIds = new Set((latest || []).map((r) => r.question_id));
    const questionGold = (qs || []).reduce(
      (sum, q) => sum + (answeredIds.has(q.id) ? (Number(q.goldReward) || 0) : 0),
      0
    );

    const baseXp = Number(tpl?.base_xp_reward ?? 0) || 0;
    const baseGold = Number(tpl?.base_gold_reward ?? 0) || 0;

    return {
      xp: questionXp + baseXp,
      gold: questionGold + baseGold,
      breakdown: { questionXp, baseXp, questionGold, baseGold },
    };
  }

  async function awardRewardsIfComplete(latestResponses: QuestQuestionResponse[]) {
    if (!questInstanceId || !studentId) return;

    if (claimingRewards) return;
    if (claimedRewards) return;

    if (hasClaimedRewards(studentId, questInstanceId)) {
      setClaimedRewards({ xp: 0, gold: 0 });
      return;
    }

    const totals = computeTotalsFromResponses(latestResponses, questions, questTemplate);
    const xp = totals.xp;
    const gold = totals.gold;

    // Get classId from the quest instance (authoritative source)
    const classId = (instance as any)?.class_id;
    
    if (!classId) {
      setClaimRewardsError("Cannot award rewards: quest instance missing classId.");
      return;
    }

    setClaimRewardsError(null);
    setClaimingRewards(true);

    try {
      let cur: any = null;

      try {
        cur = await getPlayerState(classId, studentId);
      } catch (e: any) {
        // Check if it's a "player state not found"
        if (
          e?.message?.includes("Player state not found") ||
          e?.status === 404 ||
          e?.response?.status === 404
        ) {
          // Initialize a new player state with default values for this class
          const initialState = {
            current_xp: 0,
            xp_to_next_level: 100,
            total_xp_earned: 0,
            hearts: 5,
            max_hearts: 5,
            gold: 0,
            status: "ALIVE" as const,
          };
          
          await upsertPlayerState(classId, studentId, initialState);
          cur = initialState;
        } else {
          // Re-throw if it's a different error
          throw e;
        }
      }

      if (!cur) {
        throw new Error(`Failed to get or create player state for classId=${classId}, studentId=${studentId}`);
      }

      // Calculate score percentage from responses
      const correctCount = (latestResponses || []).filter((r: any) => {
        const isCorrect = r?.answer_raw?.is_correct;
        return typeof isCorrect === 'boolean' && isCorrect === true;
      }).length;

      const totalQuestions = questions.length || 1;
      const scorePercentage = (correctCount / totalQuestions) * 100;

      // Deduct 1 heart if score < 50%
      let hearts = cur.hearts ?? 0;
      if (scorePercentage < 50) {
        hearts = Math.max(0, hearts - 1);
        console.log(`[Quest Complete] Score ${scorePercentage.toFixed(2)}% < 50%, deducting 1 heart. Hearts remaining: ${hearts}`);
      }

      await upsertPlayerState(classId, studentId, {
        current_xp: (cur.current_xp ?? 0) + xp,
        xp_to_next_level: cur.xp_to_next_level ?? 0,
        total_xp_earned: (cur.total_xp_earned ?? 0) + xp,
        hearts: hearts,
        max_hearts: cur.max_hearts ?? 0,
        gold: (cur.gold ?? 0) + gold,
        last_weekend_reset_at: cur.last_weekend_reset_at,
        status: cur.status ?? "ALIVE",
      });

      // Log a reward transaction so the teacher activity feed picks it up
      try {
        const heartsDelta = scorePercentage < 50 ? -1 : 0;
        await createTransaction({
          student_id: studentId,
          class_id: classId,
          xp_delta: xp,
          gold_delta: gold,
          hearts_delta: heartsDelta,
          source_type: "QUEST_COMPLETION",
          source_id: questInstanceId,
          quest_instance_id: questInstanceId,
          reason: questTemplate?.title
            ? `Completed quest: ${questTemplate.title}`
            : "Quest completed",
        });
      } catch (Err) {
        //  if rewards were already applied to player state
        console.warn("Failed to log reward transaction for quest completion:", Err);
      }

      markRewardsClaimed(studentId, questInstanceId);
      setClaimedRewards({ xp, gold });
    } catch (e: any) {
      setClaimRewardsError(e?.message || "Failed to award XP/Gold.");
    } finally {
      setClaimingRewards(false);
    }
  }

  // If quest already complete on refresh, award once
  useEffect(() => {
    if (!isFinished) return;
    if (!questInstanceId || !studentId) return;
    if (!questions.length) return;

    const latestSet = new Set((responses || []).map((r) => r.question_id));
    if (latestSet.size !== questions.length) return;

    void awardRewardsIfComplete(responses || []);
  }, [isFinished, questInstanceId, studentId, questions.length, responses]);

  // --------------------
  // LOAD
  // --------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setFeedback(null);

        if (!studentId) throw new Error("Not logged in as a student.");
        if (!questInstanceId && !questTemplateIdFromUrl) {
          throw new Error("Missing quest_instance_id (and quest_template_id).");
        }

        let inst: QuestInstance | null = null;
        if (questInstanceId) {
          try {
            inst = await getQuestInstance(questInstanceId);
            setInstance(inst);
          } catch (e: any) {
            console.warn("getQuestInstance failed:", e?.message || e);
          }
        }

        const tid = questTemplateIdFromUrl || safeStr((inst as any)?.quest_template_id || "");
        if (!tid) throw new Error("Could not determine quest_template_id.");
        setTemplateId(tid);

        // ✅ fetch quest template for base rewards
        try {
          const tpl = await getQuestTemplate(tid);
          setQuestTemplate(tpl);
        } catch (e: any) {
          console.warn("getQuestTemplate failed:", e?.message || e);
          setQuestTemplate(null);
        }

        const qRes = await listQuestQuestions(tid);
        const ui = (qRes.items || []).map(normalizeQuestion);

        setQuestions(ui);
        setSelectedOptions(ui.map(() => null));
        setShortAnswers(ui.map(() => ""));
        setRemainingXp(ui.map((q) => q.xpValue));
        setCurrentIndex(0);
        setShowHint(false);
        setIsFinished(false);

        // Prefill
        if (questInstanceId) {
          try {
            const rows = await refreshResponses();
            const byQuestion = new Map<string, QuestQuestionResponse>();
            (rows || []).forEach((r) => byQuestion.set(r.question_id, r));

            setSelectedOptions((prev) => {
              const copy = [...prev];
              ui.forEach((q, idx) => {
                const saved = byQuestion.get(q.id);
                const sel = getSavedSelectedOptionId(saved?.answer_raw);
                if (sel) copy[idx] = sel;
              });
              return copy;
            });

            setShortAnswers((prev) => {
              const copy = [...prev];
              ui.forEach((q, idx) => {
                const saved = byQuestion.get(q.id);
                const text = getSavedTextAnswer(saved?.answer_raw);
                if (text) copy[idx] = text;
              });
              return copy;
            });

            const firstUnansweredIdx = ui.findIndex((q) => !byQuestion.has(q.id));
            if (firstUnansweredIdx >= 0) setCurrentIndex(firstUnansweredIdx);
            else setIsFinished(true);
          } catch (e) {
            console.warn("prefill responses failed:", e);
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load quest.");
        setQuestions([]);
        setInstance(null);
        setResponses([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [questInstanceId, questTemplateIdFromUrl, studentId]);

  // --------------------
  // Timer
  // --------------------
  useEffect(() => {
    if (loading) return;
    if (isFinished) return;

    const q = questions[currentIndex];
    if (!q) return;

    setFeedback(null);
    setSecondsLeft(q.timeLimit || 60);

    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;

          if (studentId && questInstanceId) markQuestExpired(studentId, questInstanceId);
          alert("Time's up! This quest has expired.");
          navigate("/character", { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [currentIndex, loading, isFinished, questions, navigate, questInstanceId, studentId]);

  // Feather refresh
  useEffect(() => {
    feather.replace();
  }, [
    loading,
    saving,
    currentIndex,
    selectedOptions,
    shortAnswers,
    showHint,
    isFinished,
    questions.length,
    secondsLeft,
    feedback,
    claimingRewards,
    claimedRewards,
    claimRewardsError,
  ]);

  const currentQuestion = questions[currentIndex];
  const currentRemainingXp = remainingXp[currentIndex] ?? currentQuestion?.xpValue ?? 0;

  const handleSelect = (optionId: string) => {
    setFeedback(null);
    setSelectedOptions((prev) => {
      const copy = [...prev];
      copy[currentIndex] = optionId;
      return copy;
    });
  };

  const handlePrevious = () => {
    if (isFinished) return;
    setShowHint(false);
    setFeedback(null);
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  };

  function isCorrectChoice(q: UiQuestion, selectedId: string): { canGrade: boolean; correct: boolean } {
    if (!q.hasGradingKey) return { canGrade: false, correct: true };

    if (q.correctOptionId) return { canGrade: true, correct: selectedId === q.correctOptionId };

    const opt = q.answerOptions.find((o) => o.id === selectedId);
    if (typeof opt?.isCorrect === "boolean") return { canGrade: true, correct: opt.isCorrect };

    if (q.correctOptionText && opt?.text) {
      return { canGrade: true, correct: opt.text.trim().toLowerCase() === q.correctOptionText.trim().toLowerCase() };
    }

    return { canGrade: false, correct: true };
  }

  const handleSubmit = async () => {
    if (isFinished || saving) return;
    setShowHint(false);

    if (!currentQuestion) return;

    if (!questInstanceId) {
      setFeedback({ kind: "bad", msg: "Missing quest_instance_id. Go back and open the quest again." });
      return;
    }
    if (!studentId) {
      setFeedback({ kind: "bad", msg: "Missing student session. Please sign in again." });
      return;
    }

    const hasChoices = (currentQuestion.answerOptions?.length || 0) > 0;
    const classId = (instance as any)?.class_id;

    if (!classId) {
      setFeedback({
        kind: "bad",
        msg:
          "I can load the questions, but I can’t save answers yet because class_id is missing.\n\n" +
          "Fix: make sure GET /quest-instances/{id} works, since we need it to get class_id.",
      });
      return;
    }

    let answer_raw: Record<string, any> = { type: currentQuestion.type };
    let is_auto_graded = false;

    if (hasChoices) {
      const selectedId = selectedOptions[currentIndex];
      if (!selectedId) {
        setFeedback({ kind: "bad", msg: "Please choose an answer before continuing." });
        return;
      }

      const grade = isCorrectChoice(currentQuestion, selectedId);

      if (grade.canGrade && !grade.correct) {
        setRemainingXp((prev) => {
          const copy = [...prev];
          const cur = copy[currentIndex] ?? currentQuestion.xpValue ?? 0;
          copy[currentIndex] = Math.max(0, cur - 1);
          return copy;
        });

        setFeedback({ kind: "bad", msg: "Incorrect — try again! (XP reward reduced by 1)" });
        return;
      }

      is_auto_graded = grade.canGrade;

      const opt = currentQuestion.answerOptions.find((o) => o.id === selectedId);
      answer_raw.selected_option_id = selectedId;
      answer_raw.selected_option_text = opt?.text ?? "";
      answer_raw.awarded_xp = currentRemainingXp;
      answer_raw.auto_graded = grade.canGrade;
      answer_raw.is_correct = grade.canGrade ? grade.correct : undefined;

      setFeedback(
        grade.canGrade ? { kind: "ok", msg: "Correct! Saved and moving on." } : { kind: "info", msg: "Submitted! Saved." }
      );
    } else {
      const text = (shortAnswers[currentIndex] ?? "").trim();
      if (!text) {
        setFeedback({ kind: "bad", msg: "Please type an answer before continuing." });
        return;
      }
      answer_raw.text = text;
      answer_raw.awarded_xp = currentRemainingXp;
      answer_raw.auto_graded = false;
      is_auto_graded = false;

      setFeedback({ kind: "info", msg: "Answer saved (manual grading)." });
    }

    try {
      setSaving(true);

      await upsertResponse(questInstanceId, currentQuestion.id, studentId, {
        class_id: classId,
        answer_raw,
        is_auto_graded,
        submitted_at: new Date().toISOString(),
      });

      const latest = await refreshResponses();
      const latestSet = new Set((latest || []).map((r) => r.question_id));

      const firstUnanswered = questions.findIndex((q) => !latestSet.has(q.id));
      if (firstUnanswered === -1) {
        setIsFinished(true);
        window.scrollTo({ top: 0, behavior: "smooth" });

        // awards now include BASE quest rewards too
        await awardRewardsIfComplete(latest || []);
        return;
      }

      const afterCurrent = questions.findIndex((q, idx) => idx > currentIndex && !latestSet.has(q.id));
      setCurrentIndex(afterCurrent !== -1 ? afterCurrent : firstUnanswered);
    } catch (e: any) {
      setFeedback({ kind: "bad", msg: e?.message || "Failed to save answer (backend error)." });
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    setCurrentIndex(0);
    setSelectedOptions(questions.map(() => null));
    setShortAnswers(questions.map(() => ""));
    setRemainingXp(questions.map((q) => q.xpValue));
    setShowHint(false);
    setIsFinished(false);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      await refreshResponses();
    } catch {}
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading quest…</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto bg-red-900/30 border border-red-500 rounded-xl p-6">
          <h1 className="text-xl font-bold mb-2">Couldn’t load quest</h1>
          <p className="opacity-90 mb-4">{error}</p>
          <Link className="underline" to="/character">
            Back to Character
          </Link>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-xl font-bold mb-2">No questions found</h1>
          <p className="opacity-90 mb-4">This quest template has no questions yet.</p>
          <Link className="underline" to="/character">
            Back to Character
          </Link>
        </div>
      </div>
    );
  }

  // UI
  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/assets/background/quest-bg.png')" }}>
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <i data-feather="book-open" className="w-8 h-8 mr-2" />
              <span className="text-xl font-bold">ClassQuest</span>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link to="/character" className="px-3 py-2 rounded-md text-sm bg-primary-800">Character</Link>
              <Link to="/guilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
              <Link to="/leaderboards" className="px-3 py-2 rounded-md text-sm hover:bg-primary-600">Leaderboard</Link>
              <div className="relative ml-3">
                <button className="flex items-center text-sm rounded-full">
                  <img className="h-8 w-8 rounded-full" src="http://static.photos/people/200x200/8" alt="User" />
                  <span className="ml-2">{studentName}</span>
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button className="p-2 rounded-md hover:bg-primary-600">
                <i data-feather="menu" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {isFinished ? (
          <>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h1 className="text-3xl font-bold text-center text-green-600 mb-2">Quest Complete!</h1>
              <p className="text-center text-gray-600 mb-6">
                Your answers were saved. ({answeredCount}/{questions.length})
              </p>

              {/* show base reward info for sanity */}
              {questTemplate && (
                <p className="text-center text-gray-500 text-sm mb-4">
                  Completion Reward: +{questTemplate.base_xp_reward} XP, +{questTemplate.base_gold_reward} Gold
                </p>
              )}

              <div className="text-center mb-4">
                {claimingRewards && <p className="text-gray-600">Awarding your rewards...</p>}
                {claimRewardsError && <p className="text-red-600">{claimRewardsError}</p>}
                {claimedRewards && (
                  <div className="flex justify-center gap-3 mt-2">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">+{claimedRewards.xp} XP</div>
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">+{claimedRewards.gold} Gold</div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-center sm:space-x-4 space-y-3 sm:space-y-0">
                <button type="button" onClick={handleRetry} className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium">
                  Retry (UI only)
                </button>
                <Link to="/character" className="px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium text-center">
                  Back to Character
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>Quest Progress: {questions.length}/{questions.length} Completed</span>
                <span>100%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `100%` }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{currentQuestion.title}</h1>
                <p className="text-gray-600">Type: {currentQuestion.type}</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">⏳ {secondsLeft}s</div>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">+{currentRemainingXp} XP</div>
                {currentQuestion.goldReward > 0 && (
                  <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">+{currentQuestion.goldReward} Gold</div>
                )}
              </div>
            </div>

            {feedback && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 border text-sm ${
                  feedback.kind === "ok"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : feedback.kind === "bad"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
              <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                <div>
                  <span className="font-bold">Question {currentIndex + 1} of {questions.length}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-300">Difficulty: {currentQuestion.difficulty}</span>
                </div>

                <button type="button" className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full text-sm" onClick={() => setShowHint((prev) => !prev)}>
                  <i className="inline mr-1" data-feather="help-circle" />
                  Hint
                </button>
              </div>

              <div className="p-6">
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <p className="text-lg font-medium text-gray-600 mb-4">
                    {currentQuestion.answerOptions.length > 0 ? "Choose the correct answer:" : "Answer the question:"}
                  </p>
                  <p className="text-gray-700 text-xl font-semibold text-center whitespace-pre-line">{currentQuestion.questionText}</p>
                </div>

                {showHint && currentQuestion.hint && currentQuestion.hint !== "N/A" && (
                  <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
                    <span className="font-semibold">Hint: </span>{currentQuestion.hint}
                  </div>
                )}

                {currentQuestion.answerOptions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {currentQuestion.answerOptions.map((opt, i) => {
                      const isSelected = selectedOptions[currentIndex] === opt.id;
                      const letter = String.fromCharCode(65 + i);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`bg-white border rounded-lg p-4 text-left flex items-start transition ${
                            isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                          }`}
                          onClick={() => handleSelect(opt.id)}
                        >
                          <span className={`rounded-full w-8 h-8 flex items-center justify-center mr-4 font-bold ${isSelected ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                            {letter}
                          </span>
                          <span className="font-medium text-gray-900">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Your Answer</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg p-3 text-gray-900"
                      rows={4}
                      value={shortAnswers[currentIndex] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFeedback(null);
                        setShortAnswers((prev) => {
                          const copy = [...prev];
                          copy[currentIndex] = v;
                          return copy;
                        });
                      }}
                      placeholder="Type your answer here..."
                    />
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0 || saving}
                    className={`px-6 py-2 rounded-lg flex items-center ${
                      currentIndex === 0 || saving ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                    }`}
                  >
                    <i data-feather="arrow-left" className="mr-2" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className={`bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg flex items-center ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {saving ? "Saving..." : currentIndex === questions.length - 1 ? "Finish Quest" : "Submit"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>Quest Progress: {answeredCount}/{questions.length} Answered (Saved)</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="h-2.5 rounded-full transition-all duration-500 bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProblemSolve;