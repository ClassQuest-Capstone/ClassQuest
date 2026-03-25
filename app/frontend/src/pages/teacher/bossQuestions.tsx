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

import { createImageUploadUrl, uploadToS3 } from "../../api/imageUpload/client.js";
import { getAssetUrl } from "../../api/imageUpload/assetUrl.js";

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

  const [maxPoints, setMaxPoints] = useState<number>(1);
  const [xpReward, setXpReward] = useState<number>(0);
  const [autoGradable, setAutoGradable] = useState<boolean>(true);

  // Image upload state
  const [imageAssetKey, setImageAssetKey] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

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

    setMaxPoints(1);
    setXpReward(0);
    setAutoGradable(true);
    setImageAssetKey(null);
    setImageFile(null);
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

    setMaxPoints(toInt(q.max_points ?? 1, 1));
    setXpReward(toInt(q.xp_reward ?? 0, 0));
    setAutoGradable(toBool(q.auto_gradable, true));
    setImageAssetKey((q as any).image_asset_key ?? null);
    setImageFile(null);

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
      // Upload image if a new file was selected
      let finalImageAssetKey = imageAssetKey;
      if (imageFile) {
        setImageUploading(true);
        try {
          const currentUser = JSON.parse(localStorage.getItem("cq_currentUser") || "{}");
          const teacherId = currentUser.id || "";
          const { uploadUrl, imageAssetKey: newKey } = await createImageUploadUrl({
            teacher_id: teacherId,
            entity_type: "boss-question",
            content_type: imageFile.type as any,
            file_size: imageFile.size,
          });
          await uploadToS3(uploadUrl, imageFile);
          finalImageAssetKey = newKey;
        } finally {
          setImageUploading(false);
        }
      }

      const payload: any = {
        order_index: Number(orderIndex),
        question_text: questionText.trim(),
        question_type: questionType,
        max_points: Number(maxPoints),
        xp_reward: Number(xpReward),
        auto_gradable: Boolean(autoGradable),
        // null clears the image on update; string sets it; undefined omits it on create
        ...(finalImageAssetKey !== undefined ? { image_asset_key: finalImageAssetKey } : {}),
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
          <div className="space-y-3">
            {questions.map((q) => {
              const coercedType = coerceAllowedType(q.question_type as any);
              const opts = normalizeOptionsToArray(q.options);
              const ci = normalizeCorrectAnswerToIndex(q.correct_answer);
              const tfVal = normalizeCorrectAnswerToBool(q.correct_answer);

              return (
                <div key={q.question_id} className="bg-white rounded-xl shadow-md p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">#{q.order_index}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {coercedType === "MCQ_SINGLE" ? "MCQ" : "True / False"}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          {q.xp_reward ?? 0} XP
                        </span>
                      </div>

                      {/* Question text */}
                      <p className="text-sm font-bold text-gray-900 mb-2">{q.question_text}</p>

                      {/* MCQ options in a 2-column grid */}
                      {coercedType === "MCQ_SINGLE" && opts.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {opts.map((o, i) => (
                            <div
                              key={`${q.question_id}-${i}`}
                              className={`flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-xs min-w-0 ${
                                i === ci
                                  ? "border-green-300 bg-green-50 text-green-800 font-semibold"
                                  : "border-gray-200 bg-gray-50 text-gray-700"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${i === ci ? "border-green-500 bg-green-500" : "border-gray-400"}`}>
                                {i === ci && <span className="text-white text-xs leading-none">✓</span>}
                              </span>
                              <span className="break-words min-w-0 overflow-hidden">{o.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* True/False answer */}
                      {coercedType === "TRUE_FALSE" && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tfVal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          Answer: {tfVal ? "True" : "False"}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                        onClick={() => openEdit(q)}
                      >
                        <i data-feather="edit" className="w-3.5 h-3.5"></i>
                        Edit
                      </button>
                      <button
                        className="bg-gray-100 hover:bg-red-50 text-red-600 border border-red-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                        onClick={() => onDelete(q)}
                      >
                        <i data-feather="trash-2" className="w-3.5 h-3.5"></i>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg flex flex-col max-h-[90vh]">
            {/* Modal header — always visible */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
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

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700">XP Reward (correct)</label>
                  <input
                    className={inputBox}
                    type="number"
                    value={xpReward}
                    onChange={(e) => setXpReward(toInt(e.target.value, 0))}
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

              {/* Image upload */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Image (optional)
                </label>
                {imageAssetKey && !imageFile && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    {getAssetUrl(imageAssetKey) && (
                      <img
                        src={getAssetUrl(imageAssetKey)}
                        alt="Question image preview"
                        className="h-12 w-12 object-cover rounded border border-gray-200 shrink-0"
                      />
                    )}
                    <span className="truncate max-w-xs">{imageAssetKey}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 text-xs underline shrink-0"
                      onClick={() => setImageAssetKey(null)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {imageFile && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <span className="truncate max-w-xs">{imageFile.name}</span>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 text-xs underline shrink-0"
                      onClick={() => setImageFile(null)}
                      disabled={saving}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="text-sm text-gray-700"
                  disabled={saving || imageUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                  }}
                />
                {imageUploading && (
                  <p className="text-xs text-blue-600 mt-1">Uploading image…</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Max 5 MB · JPEG, PNG, GIF, or WebP
                </p>
              </div>

            </div>
            </div>

            {/* Modal footer — always visible */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                onClick={onSave}
                disabled={saving || imageUploading}
              >
                {saving ? "Saving…" : "Save Question"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}