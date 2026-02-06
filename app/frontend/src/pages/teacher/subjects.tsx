// Subjects.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";

import {
  getQuestTemplatesByOwner,
  getPublicQuestTemplates,
  type QuestTemplate,
} from "../../api/questTemplates.js";
import { listClassesByTeacher, type ClassItem } from "../../api/classes.js";

type QuestCard = {
  title: string;
  subject: string;
  difficulty: string;
  description: string;
  type: string;
  grade: string;
  gradient: string;
  icon: string;
  reward: string;
};

const FALLBACK_QUESTS: QuestCard[] = [
  {
    title: "Algebra Questline",
    subject: "Mathematics",
    difficulty: "Medium",
    description: "Solve fractions and unlock the Portal of Numbers.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-blue-500 to-indigo-600",
    icon: "activity",
    reward: "+150 XP / 150 Gold",
  },
  {
    title: "Motion & friction",
    subject: "Science",
    difficulty: "Easy",
    description: "Force and Motion.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-green-500 to-emerald-600",
    icon: "zap",
    reward: "+150 XP / Consumable",
  },
  {
    title: "The Dominion of Canada",
    subject: "Social studies",
    difficulty: "Hard",
    description: "A Journey Through Land, People, and Power.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-amber-500 to-orange-600",
    icon: "clock",
    reward: "+400 XP / Title",
  },
];

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

function toInt(val: unknown, fallback = 0) {
  // Handles: 100, "100", "100XP", null/undefined, " 200 XP "
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
  };
}

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // templates (real data)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);

  useEffect(() => {
    feather.replace();
  }, []);

  // open modal from navigation state
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

  // load teacher's classes
  useEffect(() => {
    if (!teacher?.id) return;
    const loadClasses = async () => {
      try {
        const res = await listClassesByTeacher(teacher.id);
        setClasses((res as any).items ?? []);
      } catch (e) {
        console.error("Failed to load classes:", e);
        setClasses([]);
      }
    };
    loadClasses();
  }, [teacher?.id]);

  // re-render feather icons when modal/templates change
  useEffect(() => {
    feather.replace();
  }, [isModalOpen, templates, loading, error]);

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
      ].map((t: QuestTemplate) => normalizeTemplate(t));

      // Unique by quest_template_id
      const unique = new Map<string, QuestTemplate>();
      for (const t of merged) unique.set((t as any).quest_template_id, t);

      let list = [...unique.values()].sort((a, b) => {
        const da = new Date((a as any).created_at).getTime();
        const db = new Date((b as any).created_at).getTime();
        if (!Number.isNaN(da) && !Number.isNaN(db)) return db - da;
        return safeStr((a as any).title).localeCompare(safeStr((b as any).title));
      });

      // If viewing from a specific class, filter by class_id
      if (location.state?.viewMode === "class" && location.state?.class_id) {
        list = list.filter((t: any) => t.class_id === location.state.class_id);
      }

      setTemplates(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load quest templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [teacher?.id, location.state?.class_id, location.state?.viewMode]);

  useEffect(() => {
    if (teacher?.id) loadTemplates();
  }, [teacher?.id, loadTemplates]);

  // group templates by subject
  const templatesBySubject = useMemo(() => {
    const map = new Map<string, QuestTemplate[]>();

    for (const t of templates) {
      const key = safeStr((t as any).subject || "Unassigned").trim() || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => safeStr((a as any).title).localeCompare(safeStr((b as any).title)));
      map.set(k, arr);
    }

    return [...map.entries()]
      .map(([subject, items]) => ({ subject, items }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [templates]);

  const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // IMPORTANT: pass numeric XP/Gold so /quests doesn't throw "invalid base xp rewards"
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
      class_id: location.state?.class_id || safeStr(formData.get("class_id")), // Get class_id from form or navigation state
    };

    setIsModalOpen(false);
    navigate("/quests", { state: { questData, class_id: location.state?.class_id } });
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

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/teacherDashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/Subjects"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Quests
              </Link>
              <Link
                to="/"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Activity
              </Link>

              <DropDownProfile
                username={teacher?.displayName || "user"}
                onLogout={() => {
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
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

      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          to="/classes"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-800">Quest Management</h1>
            <p className="text-white">Browse quest templates (yours + public)</p>
          </div>

          <div className="flex gap-3">
            <button
              className="bg-white/15 hover:bg-white/20 text-white px-6 py-2 rounded-lg flex items-center border border-white/20"
              onClick={loadTemplates}
              disabled={!teacher?.id || loading}
            >
              <i data-feather="refresh-cw" className="mr-2"></i>
              Refresh
            </button>

            <button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
              onClick={() => setIsModalOpen(true)}
            >
              <i data-feather="plus" className="mr-2"></i> Create Quest
            </button>
          </div>
        </div>

        {/* Loading / error */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">Loading templates…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700">
            {error}
          </div>
        )}

        {/* Templates (preferred) or fallback cards */}
        {!loading && !error && (
          <div className="space-y-10">
            {templatesBySubject.length === 0 ? (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">
                  No quest templates found — showing sample quests.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {FALLBACK_QUESTS.map((quest) => (
                    <div
                      key={quest.title}
                      className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
                    >
                      <div className={`bg-linear-to-r ${quest.gradient} p-6 text-white text-center`}>
                        <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                          <i data-feather={quest.icon} className="w-10 h-10 text-gray-800"></i>
                        </div>
                        <h3 className="text-xl font-bold">{quest.title}</h3>
                        <p className="text-white/80">{quest.subject}</p>
                      </div>

                      <div className="p-5 space-y-4">
                        <p className="text-sm text-gray-500 uppercase tracking-wide">
                          {quest.difficulty} • {quest.grade}
                        </p>
                        <p className="text-gray-700 text-sm">{quest.description}</p>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span className="font-semibold text-gray-900">{quest.type}</span>
                          <span className="font-semibold text-gray-900">{quest.reward}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                            <i data-feather="play" className="mr-1 w-4 h-4"></i> Launch
                          </button>
                          <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                            <i data-feather="clock" className="mr-1 w-4 h-4"></i> Schedule
                          </button>
                          <button className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                            <i data-feather="edit" className="mr-1 w-4 h-4"></i> Edit Quest
                          </button>
                          <button className="col-span-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                            <i data-feather="trash-2" className="mr-1 w-4 h-4"></i> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              templatesBySubject.map(({ subject, items }) => (
                <div key={subject}>
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

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                onClick={() =>
                                  navigate("/quests", {
                                    state: {
                                      templateId: (t as any).quest_template_id,
                                      // also pass numeric rewards to avoid downstream validation issues
                                      base_xp_reward: xp,
                                      base_gold_reward: gold,
                                    },
                                  })
                                }
                              >
                                <i data-feather="play" className="mr-1 w-4 h-4"></i> Use
                              </button>

                              <button
                                className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                onClick={() => alert("TODO: open template editor")}
                              >
                                <i data-feather="edit" className="mr-1 w-4 h-4"></i> Edit
                              </button>

                              <button
                                className="col-span-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                onClick={() => alert("TODO: delete template")}
                              >
                                <i data-feather="trash-2" className="mr-1 w-4 h-4"></i> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Quest</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-blue-500 hover:text-blue-700"
              >
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateQuest}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quest Name</label>
                <input
                  type="text"
                  name="questName"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Polynomial peaks"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  name="type"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                  defaultValue="Quest"
                >
                  <option value="Quest">Quest</option>
                  <option value="Side Quest">Side Quest</option>
                  <option value="Boss Fight">Boss Fight</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  name="subject"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                  defaultValue="Mathematics"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Health Education">Health Education</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select
                  name="grade"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                  defaultValue="Grade 5"
                >
                  <option value="Grade 5">Grade 5</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class </label>
                <select
                  name="class_id"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  defaultValue={location.state?.class_id || ""}
                >
                  <option value="">No specific class</option>
                 {classes
                  .filter((cls) => cls.is_active)
                  .map((cls) => (
                    <option key={cls.class_id} value={cls.class_id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  rows={3}
                  placeholder="Brief overview for your students"
                  required
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    name="difficulty"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                    defaultValue="Easy"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">XP</label>
                  {/* IMPORTANT: numeric values, not Strings */}
                  <select
                    name="base_xp_reward"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                    defaultValue=""
                  >
                    <option value="">Select XP</option>
                    <option value="100">100 XP</option>
                    <option value="200">200 XP</option>
                    <option value="300">300 XP</option>
                    <option value="400">400 XP</option>
                    <option value="500">500 XP</option>
                    <option value="1000">1000 XP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reward</label>
                  {/* IMPORTANT: numeric values so /quests doesn't throw error */}
                  <select
                    name="base_gold_reward"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                    defaultValue=""
                  >
                    <option value="">Select Gold</option>
                    <option value="30">30 Gold</option>
                    <option value="100">100 Gold</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  Create Quest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;
