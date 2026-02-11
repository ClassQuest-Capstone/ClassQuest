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
} from "../../api/questTemplates.js";
import { listClassesByTeacher, type ClassItem } from "../../api/classes.js";
import {
  createQuestInstance,
  listQuestInstancesByClass,
  listQuestInstancesByTemplate,
  updateQuestInstanceStatus,
  updateQuestInstanceDates,
  type QuestInstance,
  type CreateQuestInstanceRequest,
  type QuestInstanceStatus,
} from "../../api/questInstances.js";

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
    base_xp_reward: toInt((t as any).base_xp_reward, 0) as any,
    base_gold_reward: toInt((t as any).base_gold_reward, 0) as any,
    estimated_duration_minutes: toInt((t as any).estimated_duration_minutes, 0) as any,
    grade: typeof (t as any).grade === "number" ? (t as any).grade : toInt((t as any).grade, 0),
  };
}

// Convert human UI values -> backend enum format
function normalizeDifficulty(v: string) {
  const x = v.trim().toLowerCase();
  if (x === "easy") return "EASY";
  if (x === "medium") return "MEDIUM";
  if (x === "hard") return "HARD";
  // already enum?
  if (v === "EASY" || v === "MEDIUM" || v === "HARD") return v;
  return "EASY";
}

function normalizeType(v: string) {
  const x = v.trim().toLowerCase();
  if (x === "quest") return "QUEST";
  if (x === "daily quest" || x === "daily_quest") return "DAILY_QUEST";
  if (x === "boss fight" || x === "boss_fight") return "BOSS_FIGHT";
  // already enum?
  if (v === "QUEST" || v === "DAILY_QUEST" || v === "BOSS_FIGHT") return v;
  return "QUEST";
}

function normalizeGrade(v: string | number) {
  if (typeof v === "number") return v;
  const m = String(v).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

const inputBox =
  "w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-black bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestTemplate | null>(null);

  // edit form fields
  const [eTitle, setETitle] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eType, setEType] = useState("QUEST");
  const [eDifficulty, setEDifficulty] = useState("EASY");
  const [eGrade, setEGrade] = useState<number>(0);
  const [eDuration, setEDuration] = useState<number>(0);
  const [eXP, setEXP] = useState<number>(0);
  const [eGold, setEGold] = useState<number>(0);
  const [ePublic, setEPublic] = useState<boolean>(false);

  // QuestInstance assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<QuestTemplate | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  
  // Assignment form fields
  const [assignClassId, setAssignClassId] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const [assignStatus, setAssignStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [assignManualApproval, setAssignManualApproval] = useState<boolean>(false);
  const [assignTitleOverride, setAssignTitleOverride] = useState<string>("");
  const [assignDescriptionOverride, setAssignDescriptionOverride] = useState<string>("");

  // Quest instances state - map of template_id -> instances
  const [questInstances, setQuestInstances] = useState<Map<string, QuestInstance[]>>(new Map());

  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    if (location.state?.openCreateQuest) {
      setIsModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

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

  useEffect(() => {
    feather.replace();
  }, [isModalOpen, templates, loading, error, editOpen, assignModalOpen, questInstances]);

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

      const unique = new Map<string, QuestTemplate>();
      for (const t of merged) unique.set((t as any).quest_template_id, t);

      let list = [...unique.values()].sort((a, b) => {
        const da = new Date((a as any).created_at).getTime();
        const db = new Date((b as any).created_at).getTime();
        if (!Number.isNaN(da) && !Number.isNaN(db)) return db - da;
        return safeStr((a as any).title).localeCompare(safeStr((b as any).title));
      });

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

  // Load quest instances for all templates
  const loadQuestInstances = useCallback(async () => {
    if (!teacher?.id || templates.length === 0) return;

    const instancesMap = new Map<string, QuestInstance[]>();

    try {
      // Load instances for each template
      await Promise.all(
        templates.map(async (template) => {
          const templateId = (template as any).quest_template_id;
          if (!templateId) return;

          try {
            const response = await listQuestInstancesByTemplate(templateId);
            const instances = (response as any).items || [];
            instancesMap.set(templateId, instances);
          } catch (e) {
            console.error(`Failed to load instances for template ${templateId}:`, e);
            instancesMap.set(templateId, []);
          }
        })
      );

      setQuestInstances(instancesMap);
    } catch (e) {
      console.error("Failed to load quest instances:", e);
    }
  }, [teacher?.id, templates]);

  useEffect(() => {
    if (templates.length > 0) {
      loadQuestInstances();
    }
  }, [templates, loadQuestInstances]);

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
      class_id: location.state?.class_id || safeStr(formData.get("class_id")),
    };

    setIsModalOpen(false);
    navigate("/quests", { state: { questData, class_id: location.state?.class_id } });
  };

  // Open edit modal with current values
  const openEdit = (t: QuestTemplate) => {
    setEditError(null);
    setEditing(t);

    setETitle(safeStr((t as any).title));
    setESubject(safeStr((t as any).subject));
    setEDescription(safeStr((t as any).description));

    setEType(normalizeType(safeStr((t as any).type)));
    setEDifficulty(normalizeDifficulty(safeStr((t as any).difficulty)));
    setEGrade(normalizeGrade((t as any).grade));
    setEDuration(toInt((t as any).estimated_duration_minutes, 0));
    setEXP(toInt((t as any).base_xp_reward, 0));
    setEGold(toInt((t as any).base_gold_reward, 0));
    setEPublic(Boolean((t as any).is_shared_publicly));

    setEditOpen(true);
  };

  // Save edits (PATCH)
  const saveEdit = async () => {
    if (!editing) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const patch = {
        title: eTitle,
        subject: eSubject,
        description: eDescription,
        type: normalizeType(eType),
        difficulty: normalizeDifficulty(eDifficulty),
        grade: Number(eGrade),
        estimated_duration_minutes: Number(eDuration),
        base_xp_reward: Number(eXP),
        base_gold_reward: Number(eGold),
        is_shared_publicly: Boolean(ePublic),
      };

      await updateQuestTemplate((editing as any).quest_template_id, patch as any);

      // Update local state immediately (no refresh needed)
      setTemplates((prev) =>
        prev.map((x) =>
          (x as any).quest_template_id === (editing as any).quest_template_id
            ? normalizeTemplate({ ...(x as any), ...(patch as any) })
            : x
        )
      );

      setEditOpen(false);
      setEditing(null);
    } catch (e: any) {
      setEditError(e?.message || "Failed to update template");
    } finally {
      setEditSaving(false);
    }
  };

  // Delete (UI remove; real delete requires backend)
  const deleteTemplate = async (t: QuestTemplate) => {
    const id = (t as any).quest_template_id;
    if (!window.confirm(`Delete "${safeStr((t as any).title)}"?`)) return;

    setTemplates((prev) => prev.filter((x) => (x as any).quest_template_id !== id));
    await deleteQuestTemplate(id);
    await loadTemplates();
  }
  /*const deleteTemplateUIOnly = (t: QuestTemplate) => {
    const id = (t as any).quest_template_id;
    if (!window.confirm(`Delete "${safeStr((t as any).title)}"?`)) return;

    setTemplates((prev) => prev.filter((x) => (x as any).quest_template_id !== id));

    //  (TODO:)If backend delete exists later:
    await deleteQuestTemplate(id);
    await loadTemplates();
  };*/

  // Open assignment modal
  const openAssignModal = (template: QuestTemplate) => {
    setAssigningTemplate(template);
    setAssignClassId("");
    setAssignStartDate("");
    setAssignDueDate("");
    setAssignStatus("DRAFT");
    setAssignManualApproval(false);
    setAssignTitleOverride("");
    setAssignDescriptionOverride("");
    setAssignError(null);
    setAssignModalOpen(true);
  };

  // Create quest instance (assign quest to class)
  const handleAssignQuest = async () => {
    if (!assigningTemplate || !assignClassId) {
      setAssignError("Please select a class");
      return;
    }

    setAssignLoading(true);
    setAssignError(null);

    try {
      const templateId = (assigningTemplate as any).quest_template_id;
      
      const request: CreateQuestInstanceRequest = {
        quest_template_id: templateId || null,
        title_override: assignTitleOverride.trim() || undefined,
        description_override: assignDescriptionOverride.trim() || undefined,
        start_date: assignStartDate || undefined,
        due_date: assignDueDate || undefined,
        requires_manual_approval: assignManualApproval,
        status: assignStatus,
      };

      await createQuestInstance(assignClassId, request);

      // Refresh quest instances
      await loadQuestInstances();

      // Close modal
      setAssignModalOpen(false);
      setAssigningTemplate(null);
    } catch (e: any) {
      console.error("Failed to assign quest:", e);
      setAssignError(e?.message || "Failed to assign quest to class");
    } finally {
      setAssignLoading(false);
    }
  };

  // Get quest instances for a template
  const getInstancesForTemplate = (templateId: string): QuestInstance[] => {
    return questInstances.get(templateId) || [];
  };

  // Get class name by ID
  const getClassNameById = (classId: string): string => {
    const cls = classes.find((c) => (c as any).class_id === classId);
    return cls ? (cls as any).name : classId;
  };

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
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
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">
                Quests
              </Link>
              <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
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

        {loading && (
          <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">Loading templates…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-10">
            {templatesBySubject.map(({ subject, items }) => (
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
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white text-center">
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
                              <br>
                              </br>
                              <span>
                                Due Date: {" "}
                                <span className="font-semibold text-gray-900">
                                  {(t as any).due_date
                                    ? new Date((t as any).due_date).toLocaleDateString()
                                    : "N/A"}
                                </span>
                              </span>
                            </span>
                            <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                              {(t as any).is_shared_publicly ? "Public" : "Private"}
                            </span>
                          </div>

                          {/* Quest Instance Status */}
                          {(() => {
                            const templateId = (t as any).quest_template_id;
                            const instances = getInstancesForTemplate(templateId);
                            const activeInstances = instances.filter((i) => i.status === "ACTIVE");
                            
                            if (instances.length > 0) {
                              return (
                                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-xs font-semibold text-blue-700 mb-1">
                                    ASSIGNED TO CLASSES
                                  </p>
                                  <div className="space-y-1">
                                    {instances.map((instance) => (
                                      <div
                                        key={instance.quest_instance_id}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <span className="text-gray-700">
                                          {getClassNameById(instance.class_id)}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            instance.status === "ACTIVE"
                                              ? "bg-green-100 text-green-800"
                                              : instance.status === "DRAFT"
                                              ? "bg-yellow-100 text-yellow-800"
                                              : "bg-gray-100 text-gray-800"
                                          }`}
                                        >
                                          {instance.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() =>
                                navigate("/quests", {
                                  state: {
                                    templateId: (t as any).quest_template_id,
                                    base_xp_reward: xp,
                                    base_gold_reward: gold,
                                  },
                                })
                              }
                            >
                              <i data-feather="play" className="mr-1 w-4 h-4"></i> Launch
                            </button>

                            <button
                              className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() => openAssignModal(t)}
                            >
                              <i data-feather="users" className="mr-1 w-4 h-4"></i> Assign
                            </button>

                            <button
                              className="bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() => openEdit(t)}
                            >
                              <i data-feather="edit" className="mr-1 w-4 h-4"></i> Edit
                            </button>

                            <button
                              className="bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() => deleteTemplate(t)}
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
            ))}
          </div>
        )}
      </main>

      {/* Create Modal (your existing one) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Quest</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-blue-500 hover:text-blue-700">
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateQuest}>
              {/* ... keep your existing create form exactly as-is ... */}

              {/* (snipped for brevity - leave your existing form fields here) */}
              {/* NOTE: your create modal uses "Quest/Easy/Grade 5" strings which are fine for navigation into /quests,
                  but your backend template types are QUEST/EASY/grade number. Editing now normalizes to backend enums. */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quest Name</label>
                <input type="text" name="questName" className="w-full border border-gray-300 rounded-lg px-4 py-2" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="Quest">
                  <option value="Quest">Quest</option>
                  <option value="Side Quest">Side Quest</option>
                  <option value="Boss Fight">Boss Fight</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select name="subject" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="Mathematics">
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Health Education">Health Education</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select name="grade" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="Grade 5">
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
                    .filter((cls) => (cls as any).is_active)
                    .map((cls) => (
                      <option key={(cls as any).class_id} value={(cls as any).class_id}>
                        {(cls as any).name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" className="w-full border border-gray-300 rounded-lg px-4 py-2" rows={3} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select name="difficulty" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="Easy">
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">XP</label>
                  <select name="base_xp_reward" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="">
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
                  <select name="base_gold_reward" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="">
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
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                  Create Quest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Edit Template Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
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
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 text-black">
              {editError && (
                <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Title</label>
                  <input className={inputBox} value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Subject</label>
                  <input className={inputBox} value={eSubject} onChange={(e) => setESubject(e.target.value)} />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                    className={inputBox + " min-h-[110px]"}
                    value={eDescription}
                    onChange={(e) => setEDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Type</label>
                  <select className={inputBox} value={eType} onChange={(e) => setEType(e.target.value)}>
                    <option value="QUEST">QUEST</option>
                    <option value="DAILY_QUEST">DAILY_QUEST</option>
                    <option value="BOSS_FIGHT">BOSS_FIGHT</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Difficulty</label>
                  <select className={inputBox} value={eDifficulty} onChange={(e) => setEDifficulty(e.target.value)}>
                    <option value="EASY">EASY</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HARD">HARD</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Grade</label>
                  <input type="number" className={inputBox} value={eGrade} onChange={(e) => setEGrade(Number(e.target.value))} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Duration (min)</label>
                  <input
                    type="number"
                    className={inputBox}
                    value={eDuration}
                    onChange={(e) => setEDuration(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Base XP</label>
                  <input type="number" className={inputBox} value={eXP} onChange={(e) => setEXP(Number(e.target.value))} />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">Base Gold</label>
                  <input type="number" className={inputBox} value={eGold} onChange={(e) => setEGold(Number(e.target.value))} />
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="public"
                    type="checkbox"
                    checked={ePublic}
                    onChange={(e) => setEPublic(e.target.checked)}
                  />
                  <label htmlFor="public" className="text-sm text-gray-700">
                    Shared publicly
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                  onClick={saveEdit}
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Quest to Class Modal */}
      {assignModalOpen && assigningTemplate && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden">
            <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Assign Quest to Class</h2>
              <button
                className="text-white/90 hover:text-white"
                onClick={() => {
                  setAssignModalOpen(false);
                  setAssigningTemplate(null);
                }}
                disabled={assignLoading}
              >
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 text-black">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-700">Quest Template</p>
                <p className="text-lg font-bold text-blue-900">{safeStr((assigningTemplate as any).title)}</p>
                <p className="text-sm text-blue-700">{safeStr((assigningTemplate as any).subject)}</p>
              </div>

              {assignError && (
                <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
                  {assignError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Select Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={inputBox}
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    required
                    disabled={assignLoading}
                  >
                    <option value="">Choose a class...</option>
                    {classes
                      .filter((cls) => (cls as any).is_active !== false)
                      .map((cls) => (
                        <option key={(cls as any).class_id} value={(cls as any).class_id}>
                          {(cls as any).name} (Grade {(cls as any).grade_level})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      className={inputBox}
                      value={assignStartDate}
                      onChange={(e) => setAssignStartDate(e.target.value)}
                      disabled={assignLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional - when quest becomes available</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
                    <input
                      type="datetime-local"
                      className={inputBox}
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      disabled={assignLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional - when quest expires</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status <span className="text-red-500">*</span></label> 
                  <select
                    className={inputBox}
                    value={assignStatus}
                    onChange={(e) => setAssignStatus(e.target.value as "DRAFT" | "ACTIVE")}
                    disabled={assignLoading}
                  >
                    <option value="DRAFT">DRAFT - Not visible to students yet</option>
                    <option value="ACTIVE">ACTIVE - Visible and available to students</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="manualApproval"
                    type="checkbox"
                    checked={assignManualApproval}
                    onChange={(e) => setAssignManualApproval(e.target.checked)}
                    disabled={assignLoading}
                    className="h-4 w-4"
                  />
                  <label htmlFor="manualApproval" className="text-sm text-gray-700">
                    Requires manual approval (teacher must review submissions)
                  </label>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Override Fields (Optional)</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custom Title</label>
                      <input
                        type="text"
                        className={inputBox}
                        value={assignTitleOverride}
                        onChange={(e) => setAssignTitleOverride(e.target.value)}
                        placeholder="Leave empty to use template title"
                        disabled={assignLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custom Description</label>
                      <textarea
                        className={inputBox + " min-h-[80px]"}
                        value={assignDescriptionOverride}
                        onChange={(e) => setAssignDescriptionOverride(e.target.value)}
                        placeholder="Leave empty to use template description"
                        disabled={assignLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
                  onClick={() => {
                    setAssignModalOpen(false);
                    setAssigningTemplate(null);
                  }}
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-60"
                  onClick={handleAssignQuest}
                  disabled={assignLoading || !assignClassId}
                >
                  {assignLoading ? "Assigning..." : "Assign to Class"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;
