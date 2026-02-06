// Subjects.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";

import {
  getQuestTemplatesByOwner,
  getPublicQuestTemplates,
  updateQuestTemplate,
  deleteQuestTemplate,
  type QuestTemplate,
  type QuestType,
  type Difficulty,
} from "../../api/questTemplates.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

function toInt(val: unknown, fallback = 0) {
  const n = Number(String(val ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(val: unknown) {
  return String(val ?? "");
}

function normalizeTemplate(t: QuestTemplate): QuestTemplate {
  return {
    ...t,
    // normalize common numeric fields that backend might return as strings
    base_xp_reward: toInt((t as any).base_xp_reward, 0) as any,
    base_gold_reward: toInt((t as any).base_gold_reward, 0) as any,
    estimated_duration_minutes: toInt((t as any).estimated_duration_minutes, 0) as any,
    grade: typeof (t as any).grade === "number" ? (t as any).grade : toInt((t as any).grade, 0),
  };
}

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false); // create quest modal (already existed)
  const location = useLocation();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  // templates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);

  // ✅ edit template modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState<QuestTemplate | null>(null);

  // form fields for edit
  const [fTitle, setFTitle] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fType, setFType] = useState<QuestType>("QUEST");
  const [fDifficulty, setFDifficulty] = useState<Difficulty>("EASY");
  const [fGrade, setFGrade] = useState<number>(0);
  const [fDuration, setFDuration] = useState<number>(0);
  const [fXP, setFXP] = useState<number>(0);
  const [fGold, setFGold] = useState<number>(0);
  const [fPublic, setFPublic] = useState<boolean>(false);

  useEffect(() => {
    feather.replace();
  }, []);

  // open create modal from navigation state
  useEffect(() => {
    if (location.state?.openCreateQuest) {
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // load teacher from localStorage
  useEffect(() => {
    const currentUserJson = localStorage.getItem("cq_currentUser");
    if (!currentUserJson) return;
    try {
      const teacherData = JSON.parse(currentUserJson) as TeacherUser;
      setTeacher(teacherData);
    } catch (e) {
      console.error("Failed to parse teacher data from localStorage:", e);
    }
  }, []);

  // re-render feather icons when modals/templates change
  useEffect(() => {
    feather.replace();
  }, [isModalOpen, templates, loading, error, editOpen]);

  // load quest templates (owned + public)
  const loadTemplates = useCallback(async () => {
    if (!teacher?.id) return;

    setLoading(true);
    setError(null);

    try {
      const [ownedRes, publicRes] = await Promise.all([
        getQuestTemplatesByOwner(teacher.id),
        getPublicQuestTemplates(),
      ]);

      const merged = [
        ...((ownedRes as any).items ?? []),
        ...((publicRes as any).items ?? []),
      ]
        .map((t: QuestTemplate) => normalizeTemplate(t))
        // de-dupe by quest_template_id
        .reduce((acc: QuestTemplate[], t: QuestTemplate) => {
          if (!acc.find((x) => x.quest_template_id === t.quest_template_id)) acc.push(t);
          return acc;
        }, []);

      setTemplates(merged);
    } catch (err: any) {
      console.error("Failed to load templates:", err);
      setError(err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [teacher?.id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const templatesBySubject = useMemo(() => {
    const map = new Map<string, QuestTemplate[]>();
    for (const t of templates) {
      const subject = safeStr((t as any).subject || "Other");
      if (!map.has(subject)) map.set(subject, []);
      map.get(subject)!.push(t);
    }

    // sort subjects + items
    const subjectGroups = [...map.entries()]
      .map(([subject, items]) => ({
        subject,
        items: items.sort((a, b) => safeStr((a as any).title).localeCompare(safeStr((b as any).title))),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return subjectGroups;
  }, [templates]);

  // ✅ Create quest (existing behavior): navigates to /quests and creates template there
  const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const xp = toInt(formData.get("base_xp_reward"), 0);
    const gold = toInt(formData.get("base_gold_reward"), 0);

    const questData = {
      name: safeStr(formData.get("questName")),
      type: safeStr(formData.get("type")),
      subject: safeStr(formData.get("subject")),
      grade: safeStr(formData.get("grade")),
      description: safeStr(formData.get("description")),
      difficulty: safeStr(formData.get("difficulty")),
      base_xp_reward: xp,
      base_gold_reward: gold,
    };

    setIsModalOpen(false);
    navigate("/quests", { state: { questData } });
  };

  // ✅ OPEN EDIT MODAL (this replaces the TODO alert)
  const openEdit = (t: QuestTemplate) => {
    setEditError(null);
    setEditing(t);

    setFTitle(safeStr((t as any).title));
    setFSubject(safeStr((t as any).subject));
    setFDescription(safeStr((t as any).description));
    setFType(((t as any).type || "QUEST") as QuestType);
    setFDifficulty(((t as any).difficulty || "EASY") as Difficulty);
    setFGrade(toInt((t as any).grade, 0));
    setFDuration(toInt((t as any).estimated_duration_minutes, 0));
    setFXP(toInt((t as any).base_xp_reward, 0));
    setFGold(toInt((t as any).base_gold_reward, 0));
    setFPublic(Boolean((t as any).is_shared_publicly));

    setEditOpen(true);
  };

  // ✅ SAVE EDIT
  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      // only send fields your backend supports
      await updateQuestTemplate(editing.quest_template_id, {
        title: fTitle,
        subject: fSubject,
        description: fDescription,
        type: fType,
        difficulty: fDifficulty,
        grade: Number(fGrade),
        estimated_duration_minutes: Number(fDuration),
        base_xp_reward: Number(fXP),
        base_gold_reward: Number(fGold),
        is_shared_publicly: Boolean(fPublic),
      } as any);

      // update UI immediately
      setTemplates((prev) =>
        prev.map((x) =>
          x.quest_template_id === editing.quest_template_id
            ? normalizeTemplate({
                ...(x as any),
                title: fTitle,
                subject: fSubject,
                description: fDescription,
                type: fType,
                difficulty: fDifficulty,
                grade: Number(fGrade),
                estimated_duration_minutes: Number(fDuration),
                base_xp_reward: Number(fXP),
                base_gold_reward: Number(fGold),
                is_shared_publicly: Boolean(fPublic),
              } as any)
            : x
        )
      );

      setEditOpen(false);
      setEditing(null);
    } catch (err: any) {
      console.error("Failed to update template:", err);
      setEditError(err?.message || "Failed to update template");
    } finally {
      setSavingEdit(false);
    }
  };

  // ✅ DELETE TEMPLATE (real delete requires backend route)
  const handleDeleteTemplate = async (t: QuestTemplate) => {
    const id = t.quest_template_id;

    // don’t let users delete public templates they don’t own (optional safeguard)
    const ownedByMe = teacher?.id && (t as any).owner_teacher_id === teacher.id;

    if (!window.confirm(`Delete "${safeStr((t as any).title)}"?`)) return;

    // remove from UI immediately
    setTemplates((prev) => prev.filter((x) => x.quest_template_id !== id));

    // try real delete only if it’s owned by you
    if (!ownedByMe) return;

    try {
      await deleteQuestTemplate(id);
    } catch (err: any) {
      console.error("Delete failed (likely missing backend DELETE):", err);
      // show message so you know why it comes back after refresh
      alert(
        "Delete endpoint for quest templates is not set up on the backend yet.\n\n" +
          "It was removed from the UI, but it will come back after refresh until the backend DELETE route exists."
      );
      // optionally reload to restore truth from server:
      // await loadTemplates();
    }
  };

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
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

            <div className="flex items-center">
              <DropDownProfile />
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Subjects</h1>
            <p className="text-white/80">Browse your templates and public templates</p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow hover:bg-gray-100"
          >
            + Create Quest
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-white">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-white/90">No templates found.</div>
        ) : (
          templatesBySubject.map(({ subject, items }) => (
            <div key={subject} className="mb-10">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">{subject}</h2>
                  <p className="text-white/80 text-sm">{items.length} template(s)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((t) => {
                  const type = safeStr((t as any).type);
                  const icon =
                    type === "BOSS_FIGHT"
                      ? "shield"
                      : type === "DAILY_QUEST"
                      ? "calendar"
                      : "activity";

                  const xp = toInt((t as any).base_xp_reward, 0);
                  const gold = toInt((t as any).base_gold_reward, 0);

                  return (
                    <div
                      key={(t as any).quest_template_id}
                      className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
                    >
                      <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-6 text-white text-center">
                        <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                          <i data-feather={icon} className="w-10 h-10 text-gray-800"></i>
                        </div>
                        <h3 className="text-xl font-bold">{safeStr((t as any).title)}</h3>
                        <p className="text-white/80">{safeStr((t as any).subject)}</p>
                      </div>

                      <div className="p-5 space-y-4">
                        <p className="text-sm text-gray-500 uppercase tracking-wide">
                          {safeStr((t as any).difficulty)} • Grade {safeStr((t as any).grade)}
                        </p>

                        <p className="text-gray-700 text-sm">{safeStr((t as any).description)}</p>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span className="font-semibold text-gray-900">{type}</span>
                          <span className="font-semibold text-gray-900">
                            +{xp} XP / {gold} Gold
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>
                            Duration:{" "}
                            <span className="font-semibold text-gray-900">
                              {toInt((t as any).estimated_duration_minutes, 0)} min
                            </span>
                          </span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                            {(t as any).is_shared_publicly ? "Public" : "Private"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                            onClick={() => openEdit(t)}
                          >
                            <i data-feather="edit" className="mr-1 w-4 h-4"></i> Edit
                          </button>

                          <button
                            className="bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                            onClick={() => handleDeleteTemplate(t)}
                          >
                            <i data-feather="trash-2" className="mr-1 w-4 h-4"></i> Delete
                          </button>
                        </div>

                        <button
                          className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                          onClick={() =>
                            navigate("/quests", {
                              state: {
                                // you can still “start” by creating via your existing flow
                                questData: {
                                  name: safeStr((t as any).title),
                                  type: safeStr((t as any).type),
                                  subject: safeStr((t as any).subject),
                                  grade: String((t as any).grade),
                                  description: safeStr((t as any).description),
                                  difficulty: safeStr((t as any).difficulty),
                                  reward: (t as any).base_gold_reward,
                                  XP: (t as any).base_xp_reward,
                                  estimated_duration_minutes: (t as any).estimated_duration_minutes,
                                },
                              },
                            })
                          }
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ✅ EDIT TEMPLATE MODAL */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit Template</h2>
              <button
                className="text-white/90 hover:text-white"
                onClick={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editError && (
                <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Title</label>
                  <input
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Subject</label>
                  <input
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fSubject}
                    onChange={(e) => setFSubject(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Type</label>
                  <select
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fType}
                    onChange={(e) => setFType(e.target.value as QuestType)}
                  >
                    <option value="QUEST">QUEST</option>
                    <option value="DAILY_QUEST">DAILY_QUEST</option>
                    <option value="BOSS_FIGHT">BOSS_FIGHT</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Difficulty</label>
                  <select
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fDifficulty}
                    onChange={(e) => setFDifficulty(e.target.value as Difficulty)}
                  >
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Grade</label>
                  <input
                    type="number"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fGrade}
                    onChange={(e) => setFGrade(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Duration (min)</label>
                  <input
                    type="number"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fDuration}
                    onChange={(e) => setFDuration(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Base XP</label>
                  <input
                    type="number"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fXP}
                    onChange={(e) => setFXP(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Base Gold</label>
                  <input
                    type="number"
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2
                      text-black bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={fGold}
                    onChange={(e) => setFGold(Number(e.target.value))}
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="public"
                    type="checkbox"
                    checked={fPublic}
                    onChange={(e) => setFPublic(e.target.checked)}
                  />
                  <label htmlFor="public" className="text-sm text-gray-700">
                    Shared publicly
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="px-4 py-2 rounded-lg border"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                  onClick={saveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTE: your create quest modal stays as-is (not included here) */}
      {/* If you want me to merge the create modal into this file too, paste the bottom of your current Subjects.tsx */}
    </div>
  );
};

export default Subjects;
