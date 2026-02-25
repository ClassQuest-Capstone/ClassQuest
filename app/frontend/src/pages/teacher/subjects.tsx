// subjects.tsx (fixed)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import { useQuestions } from "../hooks/teacher/useQuestions.js";
import { EditQuestModal } from "../components/teacher/modals/EditQuestModal.js";
import { AssignQuestModal } from "../components/teacher/modals/AssignQuestModal.js";
import { ExtensionDateModal } from "../components/teacher/modals/ExtensionDateModal.js";
import { QuestionsListModal } from "../components/teacher/modals/QuestionsListModal.js";
import { QuestionEditModal } from "../components/teacher/modals/QuestionEditModal.js";

import {
  getQuestTemplatesByOwner,
  getPublicQuestTemplates,
  updateQuestTemplate,
  softDeleteQuestTemplate,
  deleteQuestTemplate,
  type QuestTemplate,
} from "../../api/questTemplates.js";
import { listClassesByTeacher, type ClassItem } from "../../api/classes.js";
import {
  createQuestInstance,
  listQuestInstancesByTemplate,
  updateQuestInstanceStatus,
  updateQuestInstanceDates,
  type QuestInstance,
  type CreateQuestInstanceRequest,
  type QuestInstanceStatus,
} from "../../api/questInstances.js";
import { type QuestQuestion } from "../../api/questQuestions.js";

// Boss battle templates (existing client)
import {
  createBossBattleTemplate,
  listBossBattleTemplatesByOwner,
  listPublicBossBattleTemplates,
} from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplateItem as BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

// --------------------
// If your backend paths differ, change these two constants.
// These are only used for assign/delete boss templates.
// --------------------
const BOSS_TEMPLATES_API_PATH = "/bossBattleTemplates";
const BOSS_INSTANCES_API_PATH = "/bossBattleInstances";

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
  if (v === "EASY" || v === "MEDIUM" || v === "HARD") return v;
  return "EASY";
}

function normalizeType(v: string) {
  const x = v.trim().toLowerCase();
  if (x === "quest") return "QUEST";
  if (x === "daily quest" || x === "daily_quest") return "DAILY_QUEST";
  if (x === "boss fight" || x === "boss_fight") return "BOSS_FIGHT";
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

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);

  // Boss battle templates
  const [bossTemplates, setBossTemplates] = useState<BossBattleTemplate[]>([]);
  const [bossLoading, setBossLoading] = useState(false);
  const [bossError, setBossError] = useState<string | null>(null);

  // Edit modal state (quests)
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

  // Quest assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<QuestTemplate | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Assignment form fields
  const [assignClassId, setAssignClassId] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>("");
  const [assignDueDate, setAssignDueDate] = useState<string>("");
  const [assignManualApproval, setAssignManualApproval] = useState<boolean>(false);
  const [assignTitleOverride, setAssignTitleOverride] = useState<string>("");
  const [assignDescriptionOverride, setAssignDescriptionOverride] = useState<string>("");

  // Quest instances state - map of template_id -> instances
  const [questInstances, setQuestInstances] = useState<Map<string, QuestInstance[]>>(new Map());

  // Extension date editor modal state
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [selectedInstanceForExtension, setSelectedInstanceForExtension] =
    useState<QuestInstance | null>(null);
  const [extensionDueDate, setExtensionDueDate] = useState<string>("");
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSaving, setExtensionSaving] = useState(false);

  // Boss assignment modal state
  const [bossAssignOpen, setBossAssignOpen] = useState(false);
  const [bossAssigning, setBossAssigning] = useState<BossBattleTemplate | null>(null);
  const [bossAssignLoading, setBossAssignLoading] = useState(false);
  const [bossAssignError, setBossAssignError] = useState<string | null>(null);
  const [bossAssignClassId, setBossAssignClassId] = useState<string>("");
  const [bossAssignStartDate, setBossAssignStartDate] = useState<string>("");
  const [bossAssignDueDate, setBossAssignDueDate] = useState<string>("");
  const [bossAssignManualApproval, setBossAssignManualApproval] = useState<boolean>(false);
  const [bossAssignTitleOverride, setBossAssignTitleOverride] = useState<string>("");
  const [bossAssignDescriptionOverride, setBossAssignDescriptionOverride] = useState<string>("");

  // Use Questions Hook (quests)
  const {
    questionsModalOpen,
    questionEditModalOpen,
    questionsList,
    editingQuestion,
    questionEditLoading,
    questionEditError,
    editFormState,
    openQuestionsEditor,
    closeQuestionsEditor,
    openQuestionEditModal,
    closeQuestionEditModal,
    saveQuestionEdit,
    deleteQuestion,
    setEditFormField,
  } = useQuestions();

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
      const parsed = JSON.parse(currentUserJson) as any;
      // normalize id (works even if your stored object uses teacher_id / sub)
      const teacherId = parsed?.id ?? parsed?.teacher_id ?? parsed?.userId ?? parsed?.sub ?? null;
      if (!teacherId) return;
      setTeacher({ ...(parsed as any), id: teacherId });
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
  }, [
    isModalOpen,
    templates,
    loading,
    error,
    editOpen,
    assignModalOpen,
    questInstances,
    bossTemplates,
    bossLoading,
    bossError,
    bossAssignOpen,
  ]);

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

      const list = [...unique.values()]
        .filter((t) => !(t as any).is_deleted)
        .sort((a, b) => {
          const da = new Date((a as any).created_at).getTime();
          const db = new Date((b as any).created_at).getTime();
          if (!Number.isNaN(da) && !Number.isNaN(db)) return db - da;
          return safeStr((a as any).title).localeCompare(safeStr((b as any).title));
        });

      setTemplates(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load quest templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [teacher?.id]);

  useEffect(() => {
    if (teacher?.id) loadTemplates();
  }, [teacher?.id, loadTemplates]);

  const loadBossTemplates = useCallback(async () => {
    if (!teacher?.id) return;

    setBossLoading(true);
    setBossError(null);

    try {
      const [ownedRes, publicRes] = await Promise.all([
        listBossBattleTemplatesByOwner(teacher.id),
        listPublicBossBattleTemplates({ limit: 100 } as any),
      ]);

      const merged: BossBattleTemplate[] = [
        ...(((ownedRes as any)?.items as BossBattleTemplate[]) ?? []),
        ...(((publicRes as any)?.items as BossBattleTemplate[]) ?? []),
      ];

      const unique = new Map<string, BossBattleTemplate>();
      for (const t of merged) {
        const id = safeStr((t as any).boss_template_id).trim();
        if (!id) continue;
        unique.set(id, t);
      }

      const list = [...unique.values()]
        .filter((t) => !(t as any).is_deleted)
        .sort((a, b) => {
          const da = new Date((a as any).created_at).getTime();
          const db = new Date((b as any).created_at).getTime();
          if (!Number.isNaN(da) && !Number.isNaN(db)) return db - da;
          return safeStr((a as any).title).localeCompare(safeStr((b as any).title));
        });

      setBossTemplates(list);
    } catch (e: any) {
      setBossError(e?.message || "Failed to load boss battle templates");
      setBossTemplates([]);
    } finally {
      setBossLoading(false);
    }
  }, [teacher?.id]);

  useEffect(() => {
    if (teacher?.id) loadBossTemplates();
  }, [teacher?.id, loadBossTemplates]);

  // Load quest instances for all templates
  const loadQuestInstances = useCallback(async () => {
    if (!teacher?.id || templates.length === 0) return;

    const instancesMap = new Map<string, QuestInstance[]>();

    try {
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

  const bossTemplatesBySubject = useMemo(() => {
    const map = new Map<string, BossBattleTemplate[]>();

    for (const t of bossTemplates) {
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
  }, [bossTemplates]);

  const handleCreateQuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    const xp = toInt(formData.get("base_xp_reward"), 0);
    const gold = toInt(formData.get("base_gold_reward"), 0);

    const questName = safeStr(formData.get("questName"));
    const type = safeStr(formData.get("type"));
    const subject = safeStr(formData.get("subject"));
    const grade = safeStr(formData.get("grade"));
    const description = safeStr(formData.get("description"));
    const difficulty = safeStr(formData.get("difficulty"));

    // Boss Fight -> create boss template then go to bossQuestions
    if (type === "Boss Fight") {
      try {
        if (!teacher?.id) throw new Error("Missing teacher id");

        const created: any = await createBossBattleTemplate({
          owner_teacher_id: teacher.id,
          title: questName,
          description,
          subject,
          max_hp: 100,
          base_xp_reward: xp,
          base_gold_reward: gold,
          is_shared_publicly: false,
        } as any);

        const newId =
          safeStr(created?.boss_template_id) ||
          safeStr(created?.item?.boss_template_id) ||
          safeStr(created?.data?.boss_template_id);

        setIsModalOpen(false);
        await loadBossTemplates();

        if (newId) {
          navigate(`/teacher/bossQuestions?boss_template_id=${encodeURIComponent(newId)}`, {
            state: { boss_template_id: newId },
          });
        }

        return;
      } catch (e: any) {
        setError(e?.message || "Failed to create boss battle template");
        return;
      }
    }

    // Normal quest flow
    const questData = {
      name: questName,
      type,
      subject,
      grade,
      description,
      difficulty,
      base_xp_reward: xp,
      base_gold_reward: gold,
    };

    setIsModalOpen(false);
    navigate("/quests", { state: { questData, class_id: (location as any).state?.class_id } });
  };

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

  const deleteTemplate = async (t: QuestTemplate) => {
    const id = (t as any).quest_template_id;
    if (!window.confirm(`Delete "${safeStr((t as any).title)}"?`)) return;

    try {
      await softDeleteQuestTemplate(id, teacher?.id || "");
      setTemplates((prev) => prev.filter((x) => (x as any).quest_template_id !== id));
    } catch (e: any) {
      console.error("Failed to delete template:", e);
      alert("Failed to delete template: " + (e?.message || "Unknown error"));
    }
  };

  // Boss: open assign
  const openBossAssignModal = (t: BossBattleTemplate) => {
    setBossAssigning(t);
    setBossAssignClassId("");
    setBossAssignStartDate("");
    setBossAssignDueDate("");
    setBossAssignManualApproval(false);
    setBossAssignTitleOverride("");
    setBossAssignDescriptionOverride("");
    setBossAssignError(null);
    setBossAssignOpen(true);
  };

  // Boss: create instance (best-effort; depends on your backend routes)
  const handleAssignBoss = async () => {
    if (!bossAssigning || !bossAssignClassId) {
      setBossAssignError("Please select a class");
      return;
    }

    setBossAssignLoading(true);
    setBossAssignError(null);

    const bossTemplateId = safeStr((bossAssigning as any).boss_template_id);

    try {
      const payload: any = {
        boss_template_id: bossTemplateId,
        title_override: bossAssignTitleOverride.trim() || undefined,
        description_override: bossAssignDescriptionOverride.trim() || undefined,
        start_date: bossAssignStartDate || undefined,
        due_date: bossAssignDueDate || undefined,
        requires_manual_approval: bossAssignManualApproval,
        status: "ACTIVE",
        class_id: bossAssignClassId,
      };

      // try: POST /bossBattleInstances
      let res = await fetch(BOSS_INSTANCES_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        // fallback: POST /classes/:id/bossBattleInstances
        res = await fetch(`${"/classes"}/${encodeURIComponent(bossAssignClassId)}${BOSS_INSTANCES_API_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      }

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || data?.error || `Failed to assign boss (HTTP ${res.status})`);
      }

      setBossAssignOpen(false);
      setBossAssigning(null);
    } catch (e: any) {
      setBossAssignError(e?.message || "Failed to assign boss to class");
    } finally {
      setBossAssignLoading(false);
    }
  };

  // Boss: delete template (hard delete first, then soft delete fallbacks)
const deleteBossTemplate = async (t: BossBattleTemplate) => {
  const id = safeStr((t as any).boss_template_id);
  const title = safeStr((t as any).title);
  if (!id) return;
  if (!window.confirm(`Delete "${title}"?`)) return;

  const readBody = async (res: Response) => {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  };

  const attempt = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    const data = res.ok ? null : await readBody(res);
    return { ok: res.ok, res, data };
  };

  try {
    // 1) HARD DELETE patterns
    const hardAttempts = [
      () =>
        attempt(`${BOSS_TEMPLATES_API_PATH}/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        }),
      // common alt route
      () =>
        attempt(`${BOSS_TEMPLATES_API_PATH}/${encodeURIComponent(id)}/delete`, {
          method: "POST",
          credentials: "include",
        }),
    ];

    for (const fn of hardAttempts) {
      const r = await fn();
      if (r.ok) {
        setBossTemplates((prev) => prev.filter((x) => safeStr((x as any).boss_template_id) !== id));
        return;
      }
    }

    // 2) SOFT DELETE patterns (quests-style fallback)
    const softPayloads: any[] = [
      { is_deleted: true, deleted_by: teacher?.id || undefined },
      { is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: teacher?.id || undefined },
      { deleted: true, deleted_by: teacher?.id || undefined },
      { status: "DELETED", deleted_by: teacher?.id || undefined },
      { archived: true, archived_by: teacher?.id || undefined },
    ];

    const softAttemptFns: Array<() => Promise<{ ok: boolean; res: Response; data: any }>> = [];
    for (const body of softPayloads) {
      softAttemptFns.push(() =>
        attempt(`${BOSS_TEMPLATES_API_PATH}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        })
      );
      // common alt soft-delete route
      softAttemptFns.push(() =>
        attempt(`${BOSS_TEMPLATES_API_PATH}/${encodeURIComponent(id)}/soft-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        })
      );
    }

    for (const fn of softAttemptFns) {
      const r = await fn();
      if (r.ok) {
        setBossTemplates((prev) => prev.filter((x) => safeStr((x as any).boss_template_id) !== id));
        return;
      }
    }

    // 3) If we got here, everything failed — show the most useful error we can.
    const lastTry = await attempt(`${BOSS_TEMPLATES_API_PATH}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });

    const msg =
      lastTry.data?.message ||
      lastTry.data?.error ||
      `Backend rejected delete. HTTP ${lastTry.res.status}`;

    alert(`Failed to delete boss template: ${msg}`);
  } catch (e: any) {
    alert("Failed to delete boss template: " + (e?.message || "Unknown error"));
  }
};


  const openAssignModal = (template: QuestTemplate) => {
    setAssigningTemplate(template);
    setAssignClassId("");
    setAssignStartDate("");
    setAssignDueDate("");
    setAssignManualApproval(false);
    setAssignTitleOverride("");
    setAssignDescriptionOverride("");
    setAssignError(null);
    setAssignModalOpen(true);
  };

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
        status: "ACTIVE",
      };

      await createQuestInstance(assignClassId, request);
      await loadQuestInstances();

      setAssignModalOpen(false);
      setAssigningTemplate(null);
    } catch (e: any) {
      console.error("Failed to assign quest:", e);
      setAssignError(e?.message || "Failed to assign quest to class");
    } finally {
      setAssignLoading(false);
    }
  };

  // Hide archived instances so "Remove" stays removed even after refresh
  const getInstancesForTemplate = (templateId: string): QuestInstance[] => {
    return (questInstances.get(templateId) || []).filter((i) => i.status !== "ARCHIVED");
  };

  const getClassNameById = (classId: string): string => {
    const cls = classes.find((c) => (c as any).class_id === classId);
    return cls ? (cls as any).name : classId;
  };

  const openExtensionModal = (instance: QuestInstance) => {
    setSelectedInstanceForExtension(instance);
    setExtensionDueDate(instance.due_date || "");
    setExtensionError(null);
    setExtensionModalOpen(true);
  };

  const saveExtensionDate = async () => {
    if (!selectedInstanceForExtension) return;

    setExtensionSaving(true);
    setExtensionError(null);

    try {
      await updateQuestInstanceDates(selectedInstanceForExtension.quest_instance_id, {
        due_date: extensionDueDate || null,
      });

      setQuestInstances((prev) => {
        const newMap = new Map(prev);
        const instances = newMap.get(selectedInstanceForExtension.quest_template_id!) || [];
        const updated = instances.map((i) =>
          i.quest_instance_id === selectedInstanceForExtension.quest_instance_id
            ? { ...i, due_date: extensionDueDate || null }
            : i
        );
        newMap.set(selectedInstanceForExtension.quest_template_id!, updated);
        return newMap;
      });

      setExtensionModalOpen(false);
      setSelectedInstanceForExtension(null);
    } catch (e: any) {
      setExtensionError(e?.message || "Failed to update due date");
    } finally {
      setExtensionSaving(false);
    }
  };

  const archiveQuestInstance = async (instance: QuestInstance) => {
    if (!window.confirm("Archive this quest instance?")) return;

    try {
      await updateQuestInstanceStatus(instance.quest_instance_id, "ARCHIVED");

      setQuestInstances((prev) => {
        const newMap = new Map(prev);
        const instances = newMap.get(instance.quest_template_id!) || [];
        const updated: QuestInstance[] = instances.map((i) =>
          i.quest_instance_id === instance.quest_instance_id
            ? { ...i, status: "ARCHIVED" as QuestInstanceStatus }
            : i
        );
        newMap.set(instance.quest_template_id!, updated);
        return newMap;
      });
    } catch (e: any) {
      console.error("Failed to archive quest:", e);
      alert("Failed to archive quest");
    }
  };

  const removeAssignedClass = async (instance: QuestInstance) => {
    if (!window.confirm("Remove this quest from the class?")) return;

    try {
      await updateQuestInstanceStatus(instance.quest_instance_id, "ARCHIVED");

      // hide locally right away
      setQuestInstances((prev) => {
        const newMap = new Map(prev);
        const instances = newMap.get(instance.quest_template_id!) || [];
        const updated = instances.map((i) =>
          i.quest_instance_id === instance.quest_instance_id
            ? { ...i, status: "ARCHIVED" as QuestInstanceStatus }
            : i
        );
        newMap.set(instance.quest_template_id!, updated);
        return newMap;
      });
    } catch (e: any) {
      console.error("Failed to remove assignment:", e);
      alert("Failed to remove assignment");
    }
  };

  // auto-archive expired quests
  useEffect(() => {
    const checkAndArchiveExpiredQuests = async () => {
      const now = new Date().getTime();
      const instancesToArchive: string[] = [];

      questInstances.forEach((instances) => {
        instances.forEach((instance) => {
          if (instance.status === "ACTIVE" && instance.due_date) {
            const dueTime = new Date(instance.due_date).getTime();
            if (dueTime < now) {
              instancesToArchive.push(instance.quest_instance_id);
            }
          }
        });
      });

      for (const instanceId of instancesToArchive) {
        try {
          await updateQuestInstanceStatus(instanceId, "ARCHIVED");
        } catch (e) {
          console.error(`Failed to auto-archive instance ${instanceId}:`, e);
        }
      }

      if (instancesToArchive.length > 0) {
        await loadQuestInstances();
      }
    };

    if (questInstances.size > 0) {
      checkAndArchiveExpiredQuests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questInstances]);

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
              <Link
                to="/teacherDashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/Classes"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Classes
              </Link>
              <Link
                to="/Subjects"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Quests
              </Link>
              <Link
                to="/Activity"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Activity
              </Link>
              <Link
                to="/teacherGuilds"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Guilds
              </Link>
              <Link
                to="/profile"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Profile
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          to="/teacher/dashboard"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">Quest Management</h1>
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
              className="bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
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
                      type === "BOSS_FIGHT" ? "shield" : type === "DAILY_QUEST" ? "calendar" : "activity";

                    const xp = toInt((t as any).base_xp_reward, 0);
                    const gold = toInt((t as any).base_gold_reward, 0);

                    return (
                      <div
                        key={(t as any).quest_template_id}
                        className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
                      >
                        <div className="bg-linear-to-r from-green-500 to-orange-300 p-6 text-white text-center">
                          <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                            <i data-feather={icon} className="w-10 h-10 text-gray-800"></i>
                          </div>
                          <h3 className="text-xl font-bold">{safeStr((t as any).title)}</h3>
                          <p className="text-white">{safeStr((t as any).subject)}</p>
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

                          <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex justify-between items-center">
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
                          </div>

                          {/* Quest Instance Status */}
                          {(() => {
                            const templateId = (t as any).quest_template_id;
                            const instances = getInstancesForTemplate(templateId);

                            if (instances.length === 0) {
                              return (
                                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                                  <span className="inline-block px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                                    DRAFT - Not assigned to any class
                                  </span>
                                </div>
                              );
                            }

                            const formatDateTime = (dateString: string | null | undefined) => {
                              if (!dateString) return "Not set";
                              const date = new Date(dateString);
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, "0");
                              const day = String(date.getDate()).padStart(2, "0");
                              const hours = String(date.getHours()).padStart(2, "0");
                              const minutes = String(date.getMinutes()).padStart(2, "0");
                              return `${year}-${month}-${day} ${hours}:${minutes}`;
                            };

                            return (
                              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs font-semibold text-blue-700 mb-2">Classes Assigned to:</p>
                                <div className="space-y-3">
                                  {instances.map((instance: QuestInstance) => {
                                    const title = instance.title_override?.trim() || (t as any).title;

                                    return (
                                      <div
                                        key={instance.quest_instance_id}
                                        className="text-xs border-b border-blue-100 pb-2 last:border-0 last:pb-0 bg-white rounded p-2"
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                                          <span className="font-semibold text-gray-800">
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

                                        <div className="space-y-1 text-gray-600 mt-2">
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium">Start:</span>
                                            <span className="text-right text-gray-700">
                                              {formatDateTime(instance.start_date)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-start">
                                            <span className="font-medium">Due:</span>
                                            <span className="text-right text-gray-700">
                                              {formatDateTime(instance.due_date)}
                                            </span>
                                          </div>
                                        </div>

                                        {instance.title_override?.trim() ? (
                                          <p className="text-gray-600 mt-1 pt-1 border-t border-blue-100">
                                            Title Override: {title}
                                          </p>
                                        ) : null}

                                        <div className="flex gap-1 mt-2 pt-2 border-t border-blue-100">
                                          <button
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                            onClick={() => openExtensionModal(instance)}
                                            title="Edit due date for extension"
                                          >
                                            <i data-feather="calendar" className="w-3 h-3"></i> Extend
                                          </button>
                                          {instance.status === "ACTIVE" && (
                                            <button
                                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                              onClick={() => archiveQuestInstance(instance)}
                                              title="Archive this quest"
                                            >
                                              <i data-feather="archive" className="w-3 h-3"></i> Archive
                                            </button>
                                          )}
                                          <button
                                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                            onClick={() => removeAssignedClass(instance)}
                                            title="Remove from class"
                                          >
                                            <i data-feather="trash-2" className="w-3 h-3"></i> Remove
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() => openAssignModal(t)}
                            >
                              <i data-feather="users" className="mr-1 w-4 h-4"></i> Assign
                            </button>

                            <button
                              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                              onClick={() => openQuestionsEditor((t as any).quest_template_id)}
                            >
                              <i data-feather="help-circle" className="mr-1 w-4 h-4"></i> Questions
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

            {/* Boss Battles */}
            <div>
              <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-yellow-300">Boss Battles</h2>
                  <p className="text-white/80 text-sm">{bossTemplates.length} template(s)</p>
                </div>

                <button
                  className="bg-white/15 hover:bg-white/20 text-white px-6 py-2 rounded-lg flex items-center border border-white/20"
                  onClick={loadBossTemplates}
                  disabled={!teacher?.id || bossLoading}
                >
                  <i data-feather="refresh-cw" className="mr-2"></i>
                  {bossLoading ? "Loading…" : "Refresh Boss Battles"}
                </button>
              </div>

              {bossError && (
                <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700 mb-4">
                  {bossError}
                </div>
              )}

              {bossTemplates.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">
                  No boss battle templates yet. Create one with Type = "Boss Fight".
                </div>
              ) : (
                <div className="space-y-10">
                  {bossTemplatesBySubject.map(({ subject, items }) => (
                    <div key={subject}>
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">{subject}</h3>
                          <p className="text-white/80 text-sm">{items.length} template(s)</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map((t) => {
                          const id = safeStr((t as any).boss_template_id);
                          const title = safeStr((t as any).title);
                          const desc = safeStr((t as any).description);
                          const hp = toInt((t as any).max_hp, 0);
                          const xp = toInt((t as any).base_xp_reward, 0);
                          const gold = toInt((t as any).base_gold_reward, 0);
                          const isPublic = Boolean((t as any).is_shared_publicly);

                          return (
                            <div
                              key={id}
                              className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
                            >
                              <div className="bg-linear-to-r from-red-500 to-purple-600 p-6 text-white text-center">
                                <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                                  <i data-feather="shield" className="w-10 h-10 text-gray-800"></i>
                                </div>
                                <h3 className="text-xl font-bold">{title}</h3>
                                <p className="text-white">{safeStr((t as any).subject)}</p>
                              </div>

                              <div className="p-5 space-y-4">
                                <p className="text-gray-700 text-sm">{desc}</p>

                                <div className="flex items-center justify-between text-sm text-gray-600">
                                  <span className="font-semibold text-gray-900">HP: {hp}</span>
                                  <span className="font-semibold text-gray-900">
                                    +{xp} XP / {gold} Gold
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs">
                                    {isPublic ? "Public" : "Private"}
                                  </span>

                                  <span className="px-2 py-1 rounded-full bg-red-100 border border-red-200 text-red-700 text-xs font-semibold">
                                    BOSS
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                    onClick={() => openBossAssignModal(t)}
                                  >
                                    <i data-feather="users" className="mr-1 w-4 h-4"></i> Assign
                                  </button>

                                  <button
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                    onClick={() =>
                                      navigate(
                                        `/teacher/bossQuestions?boss_template_id=${encodeURIComponent(id)}`,
                                        { state: { boss_template_id: id } }
                                      )
                                    }
                                  >
                                    <i data-feather="help-circle" className="mr-1 w-4 h-4"></i> Questions
                                  </button>

                                  <button
                                    className="bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                    onClick={() => deleteBossTemplate(t)}
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
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  rows={3}
                  required
                />
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

      {/* Boss Assign Modal (inline) */}
      {bossAssignOpen && (
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Assign Boss Battle</h3>
              <button
                onClick={() => {
                  setBossAssignOpen(false);
                  setBossAssigning(null);
                }}
                className="text-blue-500 hover:text-blue-700"
              >
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-700">
                <div className="font-semibold">Template:</div>
                <div>{safeStr((bossAssigning as any)?.title)}</div>
              </div>

              {bossAssignError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
                  {bossAssignError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  className={inputBox}
                  value={bossAssignClassId}
                  onChange={(e) => setBossAssignClassId(e.target.value)}
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option key={(c as any).class_id} value={(c as any).class_id}>
                      {(c as any).name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="datetime-local"
                    className={inputBox}
                    value={bossAssignStartDate}
                    onChange={(e) => setBossAssignStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    className={inputBox}
                    value={bossAssignDueDate}
                    onChange={(e) => setBossAssignDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={bossAssignManualApproval}
                    onChange={(e) => setBossAssignManualApproval(e.target.checked)}
                  />
                  Requires manual approval
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title Override</label>
                <input
                  className={inputBox}
                  value={bossAssignTitleOverride}
                  onChange={(e) => setBossAssignTitleOverride(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description Override</label>
                <textarea
                  className={inputBox}
                  value={bossAssignDescriptionOverride}
                  onChange={(e) => setBossAssignDescriptionOverride(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBossAssignOpen(false);
                    setBossAssigning(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
                  disabled={bossAssignLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignBoss}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                  disabled={bossAssignLoading}
                >
                  {bossAssignLoading ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quest Modals (same props style as your working version) */}
      <EditQuestModal
        isOpen={editOpen}
        editing={editing}
        editError={editError}
        editSaving={editSaving}
        eTitle={eTitle}
        eSubject={eSubject}
        eDescription={eDescription}
        eType={eType}
        eDifficulty={eDifficulty}
        eGrade={eGrade}
        eDuration={eDuration}
        eXP={eXP}
        eGold={eGold}
        ePublic={ePublic}
        questInstances={questInstances}
        classes={classes}
        inputBox={inputBox}
        onTitleChange={setETitle}
        onSubjectChange={setESubject}
        onDescriptionChange={setEDescription}
        onTypeChange={setEType}
        onDifficultyChange={setEDifficulty}
        onGradeChange={setEGrade}
        onDurationChange={setEDuration}
        onXPChange={setEXP}
        onGoldChange={setEGold}
        onPublicChange={setEPublic}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onSave={saveEdit}
        onExtensionClick={openExtensionModal}
        onRemoveAssignment={removeAssignedClass}
        getInstancesForTemplate={getInstancesForTemplate}
        getClassNameById={getClassNameById}
      />

      <AssignQuestModal
        isOpen={assignModalOpen}
        assigningTemplate={assigningTemplate}
        assignError={assignError}
        assignLoading={assignLoading}
        assignClassId={assignClassId}
        assignStartDate={assignStartDate}
        assignDueDate={assignDueDate}
        assignManualApproval={assignManualApproval}
        assignTitleOverride={assignTitleOverride}
        assignDescriptionOverride={assignDescriptionOverride}
        classes={classes}
        inputBox={inputBox}
        onClassChange={setAssignClassId}
        onStartDateChange={setAssignStartDate}
        onDueDateChange={setAssignDueDate}
        onManualApprovalChange={setAssignManualApproval}
        onTitleOverrideChange={setAssignTitleOverride}
        onDescriptionOverrideChange={setAssignDescriptionOverride}
        onClose={() => {
          setAssignModalOpen(false);
          setAssigningTemplate(null);
        }}
        onAssign={handleAssignQuest}
        safeStr={safeStr}
      />

      <ExtensionDateModal
        isOpen={extensionModalOpen}
        selectedInstance={selectedInstanceForExtension}
        extensionDueDate={extensionDueDate}
        extensionError={extensionError}
        extensionSaving={extensionSaving}
        inputBox={inputBox}
        onDueDateChange={setExtensionDueDate}
        onClose={() => {
          setExtensionModalOpen(false);
          setSelectedInstanceForExtension(null);
        }}
        onSave={saveExtensionDate}
        getClassNameById={getClassNameById}
      />

      <QuestionsListModal
        isOpen={questionsModalOpen}
        questionsList={questionsList}
        inputBox={inputBox}
        onClose={closeQuestionsEditor}
        onEditClick={openQuestionEditModal}
        onDeleteClick={deleteQuestion}
      />

      <QuestionEditModal
        isOpen={questionEditModalOpen}
        editingQuestion={editingQuestion}
        editFormState={editFormState}
        questionEditLoading={questionEditLoading}
        questionEditError={questionEditError}
        inputBox={inputBox}
        onFormFieldChange={setEditFormField}
        onClose={closeQuestionEditModal}
        onSave={saveQuestionEdit}
      />
    </div>
  );
};

export default Subjects;
