// src/pages/teacher/bossQuestions.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import feather from "feather-icons";

// ✅ matches your uploaded bossQuestions client.ts
import {
  createBossQuestion,
  listBossQuestionsByTemplate,
  updateBossQuestion,
  deleteBossQuestion,
} from "../../api/bossQuestions/client.js";

// ✅ matches your uploaded bossQuestions types.ts
import type { BossQuestion, BossQuestionType } from "../../api/bossQuestions/types.js";

function safeStr(val: unknown) {
  return String(val ?? "");
}

function toInt(val: unknown, fallback = 0) {
  const n = Number(String(val ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: unknown, fallback = false) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return fallback;
}

function getBossTemplateId(location: ReturnType<typeof useLocation>): string {
  const fromState = safeStr((location.state as any)?.boss_template_id).trim();
  if (fromState) return fromState;

  const sp = new URLSearchParams(location.search);
  const fromQuery = safeStr(sp.get("boss_template_id")).trim();
  return fromQuery;
}

const inputBox =
  "w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-black bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

type MCQOption = { text: string };

function normalizeOptionsToArray(options: any): MCQOption[] {
  if (Array.isArray(options)) {
    if (options.length === 0) return [];
    if (typeof options[0] === "string") return (options as string[]).map((t) => ({ text: safeStr(t) }));
    if (typeof options[0] === "object") {
      return (options as any[]).map((o) => ({ text: safeStr(o?.text ?? o?.label ?? o?.value ?? "") }));
    }
    return [];
  }
  if (options && Array.isArray(options.options)) {
    return normalizeOptionsToArray(options.options);
  }
  return [];
}

function normalizeCorrectAnswerToIndex(correct_answer: any): number {
  if (typeof correct_answer === "number" && Number.isFinite(correct_answer)) return correct_answer;
  if (correct_answer && typeof correct_answer === "object" && Number.isFinite((correct_answer as any).index)) {
    return Number((correct_answer as any).index);
  }
  return 0;
}

function normalizeCorrectAnswerToBool(correct_answer: any): boolean {
  // Accept: boolean OR "true"/"false" OR { value: boolean }
  if (typeof correct_answer === "boolean") return correct_answer;
  if (correct_answer === "true") return true;
  if (correct_answer === "false") return false;
  if (correct_answer && typeof correct_answer === "object" && typeof (correct_answer as any).value === "boolean") {
    return Boolean((correct_answer as any).value);
  }
  return true; // default
}

const ALLOWED_TYPES: BossQuestionType[] = ["MCQ_SINGLE", "TRUE_FALSE"];

function coerceAllowedType(t: BossQuestionType | string | null | undefined): BossQuestionType {
  const val = (t || "MCQ_SINGLE") as BossQuestionType;
  return (ALLOWED_TYPES as any).includes(val) ? val : "MCQ_SINGLE";
}

export default function BossQuestions() {
  const location = useLocation();
  const navigate = useNavigate();
  const bossTemplateId = useMemo(() => getBossTemplateId(location), [location]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<BossQuestion[]>([]);

  // modal/editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BossQuestion | null>(null);

  // form fields
  const [orderIndex, setOrderIndex] = useState<number>(1);
  const [questionText, setQuestionText] = useState<string>("");
  const [questionType, setQuestionType] = useState<BossQuestionType>("MCQ_SINGLE");

  // MCQ_SINGLE
  const [mcqOptions, setMcqOptions] = useState<MCQOption[]>([
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);

  // TRUE_FALSE
  const [tfCorrect, setTfCorrect] = useState<boolean>(true);

  const [damageBoss, setDamageBoss] = useState<number>(10);
  const [damageGuild, setDamageGuild] = useState<number>(5);
  const [maxPoints, setMaxPoints] = useState<number>(1);
  const [autoGradable, setAutoGradable] = useState<boolean>(true);

  useEffect(() => {
    feather.replace();
  });

  useEffect(() => {
    if (!bossTemplateId) {
      navigate("/subjects");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossTemplateId]);

  async function loadAllQuestions() {
    if (!bossTemplateId) return;

    setLoading(true);
    setError(null);

    try {
      const all: BossQuestion[] = [];
      let cursor: string | undefined = undefined;

      for (let i = 0; i < 25; i++) {
        const res = await listBossQuestionsByTemplate(bossTemplateId, { limit: 100, cursor });
        const items = (res as any)?.items ?? [];
        all.push(...items);
        cursor = (res as any)?.cursor;
        if (!cursor) break;
      }

      all.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setQuestions(all);
    } catch (e: any) {
      setError(e?.message || "Failed to load boss questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossTemplateId]);

  function resetEditor() {
    setEditing(null);
    setOrderIndex((questions?.length ?? 0) + 1);
    setQuestionText("");
    setQuestionType("MCQ_SINGLE");

    setMcqOptions([{ text: "" }, { text: "" }, { text: "" }, { text: "" }]);
    setCorrectIndex(0);

    setTfCorrect(true);

    setDamageBoss(10);
    setDamageGuild(5);
    setMaxPoints(1);
    setAutoGradable(true);
  }

  function openCreate() {
    resetEditor();
    setEditorOpen(true);
  }

  function openEdit(q: BossQuestion) {
    setEditing(q);
    setOrderIndex(toInt(q.order_index, 1));
    setQuestionText(safeStr(q.question_text));

    const coercedType = coerceAllowedType(q.question_type as any);
    setQuestionType(coercedType);

    const opts = normalizeOptionsToArray(q.options);
    setMcqOptions(opts.length >= 2 ? opts : [{ text: "" }, { text: "" }]);
    setCorrectIndex(normalizeCorrectAnswerToIndex(q.correct_answer));

    setTfCorrect(normalizeCorrectAnswerToBool(q.correct_answer));

    setDamageBoss(toInt(q.damage_to_boss_on_correct, 10));
    setDamageGuild(toInt(q.damage_to_guild_on_incorrect, 5));
    setMaxPoints(toInt(q.max_points ?? 1, 1));
    setAutoGradable(toBool(q.auto_gradable, true));

    setEditorOpen(true);
  }

  function addOption() {
    setMcqOptions((prev) => [...prev, { text: "" }]);
  }

  function removeOption(idx: number) {
    setMcqOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== idx);
      if (correctIndex >= next.length) setCorrectIndex(0);
      return next;
    });
  }

  function validate(): string | null {
    if (!bossTemplateId) return "Missing boss template id.";
    if (!questionText.trim()) return "Question text is required.";

    if (!ALLOWED_TYPES.includes(questionType)) return "Only MCQ Single or True/False are allowed.";

    if (questionType === "MCQ_SINGLE") {
      const cleaned = mcqOptions.map((o) => safeStr(o.text).trim()).filter(Boolean);
      if (cleaned.length < 2) return "MCQ needs at least 2 options.";
      if (correctIndex < 0 || correctIndex >= cleaned.length) return "Correct option is invalid.";
    }

    if (damageBoss < 0) return "Damage to boss cannot be negative.";
    if (damageGuild < 0) return "Damage to guild cannot be negative.";
    return null;
  }

  async function onSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        order_index: Number(orderIndex),
        question_text: questionText.trim(),
        question_type: questionType,
        damage_to_boss_on_correct: Number(damageBoss),
        damage_to_guild_on_incorrect: Number(damageGuild),
        max_points: Number(maxPoints),
        auto_gradable: Boolean(autoGradable),
      };

      if (questionType === "MCQ_SINGLE") {
        const cleaned = mcqOptions.map((o) => safeStr(o.text).trim()).filter(Boolean);
        payload.options = cleaned.map((t) => ({ text: t }));
        payload.correct_answer = { index: Number(correctIndex) };
      }

      if (questionType === "TRUE_FALSE") {
        payload.options = [{ text: "True" }, { text: "False" }];
        payload.correct_answer = Boolean(tfCorrect);
        payload.auto_gradable = true;
      }

      if (editing?.question_id) {
        await updateBossQuestion(editing.question_id, payload);
      } else {
        await createBossQuestion(bossTemplateId, payload);
      }

      setEditorOpen(false);
      resetEditor();
      await loadAllQuestions();
    } catch (e: any) {
      setError(e?.message || "Failed to save boss question");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(q: BossQuestion) {
    if (!window.confirm("Delete this boss question?")) return;

    setError(null);
    try {
      await deleteBossQuestion(q.question_id);
      await loadAllQuestions();
    } catch (e: any) {
      setError(e?.message || "Failed to delete boss question");
    }
  }

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen overflow-y-auto">
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link
              to="/subjects"
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
            >
              <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
              Back to Quests
            </Link>

            <div className="flex items-center gap-2">
              <button
                className="bg-white/15 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center border border-white/20"
                onClick={loadAllQuestions}
                disabled={loading || saving}
              >
                <i data-feather="refresh-cw" className="mr-2"></i>
                Refresh
              </button>

              <button
                className="bg-linear-to-r from-red-500 to-purple-600 hover:from-red-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg flex items-center"
                onClick={openCreate}
                disabled={saving}
              >
                <i data-feather="plus" className="mr-2"></i>
                Add Question
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-yellow-300">Boss Battle Questions</h1>
          <p className="text-white/80 text-sm">
            Boss Template ID: <span className="text-white">{bossTemplateId}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">Loading questions…</div>
        ) : questions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">
            No questions yet. Click <b>Add Question</b> to create the first one.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => {
              const coercedType = coerceAllowedType(q.question_type as any);
              const opts = normalizeOptionsToArray(q.options);
              const ci = normalizeCorrectAnswerToIndex(q.correct_answer);
              const correctText = opts[ci]?.text ?? "(not set)";
              const tfVal = normalizeCorrectAnswerToBool(q.correct_answer);

              return (
                <div key={q.question_id} className="bg-white rounded-xl shadow-md p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-500 uppercase tracking-wide">
                        Order {q.order_index} • {coercedType}
                      </p>
                      <h3 className="text-lg font-bold text-gray-900 break-words">{q.question_text}</h3>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold">
                          Boss dmg (correct): {q.damage_to_boss_on_correct}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
                          Guild dmg (wrong): {q.damage_to_guild_on_incorrect}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700 font-semibold">
                          Auto-grade: {q.auto_gradable ? "Yes" : "No"}
                        </span>
                      </div>

                      {coercedType === "MCQ_SINGLE" && opts.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Options</p>
                          <ul className="space-y-2">
                            {opts.map((o, i) => (
                              <li
                                key={`${q.question_id}-${i}`}
                                className={`p-3 rounded-lg border ${
                                  i === ci ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"
                                }`}
                              >
                                <span className="text-sm text-gray-800">{o.text}</span>
                                {i === ci ? (
                                  <span className="ml-2 text-xs font-semibold text-green-700">(Correct)</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-500 mt-2">
                            Correct answer: <span className="text-gray-800">{correctText}</span>
                          </p>
                        </div>
                      ) : null}

                      {coercedType === "TRUE_FALSE" ? (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-gray-700">Correct answer:</p>
                          <p className="text-sm text-gray-900 mt-1">{tfVal ? "True" : "False"}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-3 py-2 rounded-lg text-sm flex items-center justify-center"
                        onClick={() => openEdit(q)}
                      >
                        <i data-feather="edit" className="mr-2 w-4 h-4"></i>
                        Edit
                      </button>

                      {/* ✅ Delete text forced to black */}
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-black border border-red-600 px-3 py-2 rounded-lg text-sm flex items-center justify-center"
                        onClick={() => onDelete(q)}
                      >
                        <i data-feather="trash-2" className="mr-2 w-4 h-4"></i>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="w-full max-w-2xl mt-10 bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? "Edit Boss Question" : "Add Boss Question"}
              </h2>
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => {
                  setEditorOpen(false);
                  resetEditor();
                }}
                disabled={saving}
              >
                <i data-feather="x"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Order Index</label>
                  <input
                    className={inputBox}
                    type="number"
                    value={orderIndex}
                    onChange={(e) => setOrderIndex(toInt(e.target.value, 1))}
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Question Type</label>
                  <select
                    className={inputBox}
                    value={questionType}
                    onChange={(e) => {
                      const next = coerceAllowedType(e.target.value as any);
                      setQuestionType(next);

                      if (next === "TRUE_FALSE") {
                        setTfCorrect(true);
                        setAutoGradable(true);
                      }
                      if (next === "MCQ_SINGLE") {
                        if (mcqOptions.length < 2) setMcqOptions([{ text: "" }, { text: "" }]);
                      }
                    }}
                  >
                    <option value="MCQ_SINGLE">MCQ Single</option>
                    <option value="TRUE_FALSE">True / False</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Only <b>MCQ Single</b> and <b>True/False</b> are allowed.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Question Text</label>
                <textarea
                  className={inputBox}
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                />
              </div>

              {questionType === "MCQ_SINGLE" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Options</label>

                    {/* ✅ Add option text forced to black */}
                    <button
                      className="text-sm px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 text-black"
                      onClick={addOption}
                      type="button"
                      disabled={saving}
                    >
                      + Add option
                    </button>
                  </div>

                  <div className="space-y-3">
                    {mcqOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <button
                          type="button"
                          className={`mt-2 w-5 h-5 rounded-full border flex items-center justify-center ${
                            correctIndex === idx ? "border-green-600" : "border-gray-400"
                          }`}
                          title="Mark as correct"
                          onClick={() => setCorrectIndex(idx)}
                          disabled={saving}
                        >
                          {correctIndex === idx ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
                          ) : null}
                        </button>

                        <input
                          className={inputBox}
                          value={opt.text}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMcqOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: v } : o)));
                          }}
                          placeholder={`Option ${idx + 1}`}
                          disabled={saving}
                        />

                        <button
                          type="button"
                          className="mt-2 px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm text-black"
                          onClick={() => removeOption(idx)}
                          disabled={saving || mcqOptions.length <= 2}
                          title={mcqOptions.length <= 2 ? "Need at least 2 options" : "Remove option"}
                        >
                          <i data-feather="minus" className="w-4 h-4"></i>
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">Click the circle to choose the correct option.</p>
                </div>
              )}

              {questionType === "TRUE_FALSE" && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                        tfCorrect ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-800"
                      }`}
                      onClick={() => setTfCorrect(true)}
                      disabled={saving}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                        !tfCorrect ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-800"
                      }`}
                      onClick={() => setTfCorrect(false)}
                      disabled={saving}
                    >
                      False
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">True/False questions are always auto-gradable.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Damage to Boss (correct)</label>
                  <input
                    className={inputBox}
                    type="number"
                    value={damageBoss}
                    onChange={(e) => setDamageBoss(toInt(e.target.value, 0))}
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Damage to Guild (incorrect)</label>
                  <input
                    className={inputBox}
                    type="number"
                    value={damageGuild}
                    onChange={(e) => setDamageGuild(toInt(e.target.value, 0))}
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Points</label>
                  <input
                    className={inputBox}
                    type="number"
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(toInt(e.target.value, 1))}
                    min={0}
                  />
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <input
                    id="autoGradable"
                    type="checkbox"
                    checked={questionType === "TRUE_FALSE" ? true : autoGradable}
                    onChange={(e) => setAutoGradable(e.target.checked)}
                    disabled={questionType === "TRUE_FALSE" || saving}
                  />
                  <label htmlFor="autoGradable" className="text-sm font-medium text-gray-700">
                    Auto-gradable
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {/* ✅ Cancel text forced to black */}
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500 text-black"
                  onClick={() => {
                    setEditorOpen(false);
                    resetEditor();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}