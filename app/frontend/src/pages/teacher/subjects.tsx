// subjects.tsx (fixed) — now uses BossBattleInstance (assign + list + extend + archive/remove + auto-archive)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import ProfileModal from "../features/teacher/ProfileModal.js";
import { useQuestions } from "../hooks/teacher/useQuestions.js";
import { EditQuestModal } from "../components/teacher/modals/EditQuestModal.js";
import { AssignQuestModal } from "../components/teacher/modals/AssignQuestModal.js";
import { ExtensionDateModal } from "../components/teacher/modals/ExtensionDateModal.js";
import { QuestionsListModal } from "../components/teacher/modals/QuestionsListModal.js";
import { QuestionEditModal } from "../components/teacher/modals/QuestionEditModal.js";
import { BossAssignModal, BossExtendModal } from "../components/teacher/modals/BossBattleModals.js";

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
  softDeleteBossBattleTemplate,
} from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate as BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";
import { createBossBattleInstance as createBossBattleInstanceApi, listBossBattleInstancesByTemplate as listBossBattleInstancesByTemplateApi, updateBossBattleInstance as updateBossBattleInstanceApi, } from "../../api/bossBattleInstances/client.js";

// --------------------
// If your backend paths differ, change these two constants.
// These are used for boss instances/templates fallback fetches.
// --------------------
const BOSS_TEMPLATES_API_PATH = "/bossBattleTemplates";
const BOSS_INSTANCES_API_PATH = "/boss-battle-instances";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

type BossBattleInstance = {
  boss_instance_id?: string;
  bossBattleInstanceId?: string;
  id?: string;

  boss_template_id?: string;
  bossTemplateId?: string;

  class_id?: string;
  classId?: string;

  status?: string;
  start_date?: string | null;
  due_date?: string | null;

  title_override?: string | null;
  description_override?: string | null;

  requires_manual_approval?: boolean;
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

function formatDateTime(dateString: string | null | undefined) {
   if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${month}. ${day} ${year}, ${time}`;
  } catch (e) {
    return dateString;
  }
}

// ---------- Boss Battle Instance helpers (best-effort, supports multiple backend route styles) ----------
function getBossInstanceId(i: BossBattleInstance): string {
  return (
    safeStr((i as any).boss_instance_id) ||
    safeStr((i as any).bossBattleInstanceId) ||
    safeStr((i as any).id)
  );
}

function getBossTemplateIdFromInstance(i: BossBattleInstance): string {
  return safeStr((i as any).boss_template_id) || safeStr((i as any).bossTemplateId);
}

function getClassIdFromBossInstance(i: BossBattleInstance): string {
  return safeStr((i as any).class_id) || safeStr((i as any).classId);
}

function getBossStatus(i: BossBattleInstance): string {
  return safeStr((i as any).status || "DRAFT");
}

async function fetchBossInstancesByTemplateId(bossTemplateId: string): Promise<BossBattleInstance[]> {
  try {
    const result = await listBossBattleInstancesByTemplateApi(bossTemplateId);
    return result?.items ?? [];
  } catch (e) {
    console.error(`Failed to fetch boss instances for template ${bossTemplateId}:`, e);
    return [];
  }
}

async function updateBossInstanceStatusBestEffort(instanceId: string, status: string) {
  try {
    await updateBossBattleInstanceApi(instanceId, { status: status as any });
    return { ok: true };
  } catch (error: any) {
    throw new Error(`Failed to update boss instance status: ${error.message}`);
  }
}

/**
 * Update the status of a boss template
 * Best-effort to update the status, using either the standard PATCH endpoint or the soft-delete endpoint if available
 * @param {string} templateId - Boss template ID
 * @param {string} status - New status of the boss template
 * @returns {Promise<{ok: boolean}>}
 */
async function updateBossTemplateStatusBestEffort(templateId: string, status: string) {
  const attempt = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status };
  };
 // Soft delete template here
}

// TODO: Boss battle instances don't support due_date/start_date storage on the backend.
async function updateBossInstanceDatesBestEffort(instanceId: string, dates: { due_date?: string | null }) 
{
  console.warn("updateBossInstanceDatesBestEffort: Backend does not support due_date for boss battles yet.");
  throw new Error("Boss battle date updates are not yet supported by the backend");
}

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extraSubjects, setExtraSubjects] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

  // Extension date editor modal state (quests)
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
  
  // Boss battle configuration state
  const [bossAssignModeType, setBossAssignModeType] = useState<string>("");
  const [bossAssignQuestionSelectionMode, setBossAssignQuestionSelectionMode] = useState<string>("");
  const [bossAssignLateJoinPolicy, setBossAssignLateJoinPolicy] = useState<string>("");
  const [bossAssignPassingScorePercent, setBossAssignPassingScorePercent] = useState<number>(50);
  const [bossAssignCountdownSeconds, setBossAssignCountdownSeconds] = useState<number>(5);
  const [bossAssignQuestionTimeLimit, setBossAssignQuestionTimeLimit] = useState<number | "">("");
  const [bossAssignSpeedBonusEnabled, setBossAssignSpeedBonusEnabled] = useState<boolean>(false);
  const [bossAssignSpeedBonusFloor, setBossAssignSpeedBonusFloor] = useState<number>(0.2);
  const [bossAssignSpeedWindow, setBossAssignSpeedWindow] = useState<number>(30);

  // Boss instances state - map of boss_template_id -> instances
  const [bossInstances, setBossInstances] = useState<Map<string, BossBattleInstance[]>>(new Map());

  // Boss extension modal state
  const [bossExtensionOpen, setBossExtensionOpen] = useState(false);
  const [bossSelectedForExtension, setBossSelectedForExtension] = useState<BossBattleInstance | null>(null);
  const [bossExtensionDueDate, setBossExtensionDueDate] = useState<string>("");
  const [bossExtensionError, setBossExtensionError] = useState<string | null>(null);
  const [bossExtensionSaving, setBossExtensionSaving] = useState(false);

  // Use Questions Hook (quests)
  const {
    questionsModalOpen,
    questionEditModalOpen,
    questionsList,
    editingQuestion,
    questionEditLoading,
    questionEditError,
    editFormState,
    questTemplateId,
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
    bossInstances,
    bossExtensionOpen,
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
      const [ownedResult, publicResult] = await Promise.allSettled([
        listBossBattleTemplatesByOwner(teacher.id),
        listPublicBossBattleTemplates({ limit: 100 } as any),
      ]);

      const ownedItems: BossBattleTemplate[] =
        ownedResult.status === "fulfilled"
          ? (((ownedResult.value as any)?.items as BossBattleTemplate[]) ?? [])
          : [];

      const publicItems: BossBattleTemplate[] =
        publicResult.status === "fulfilled"
          ? (((publicResult.value as any)?.items as BossBattleTemplate[]) ?? [])
          : [];

      const merged = [...ownedItems, ...publicItems];

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

      if (ownedResult.status === "rejected" && publicResult.status === "rejected") {
        setBossError("Failed to load boss battle templates");
      }
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

  // Load boss instances for all boss templates
  const loadBossInstances = useCallback(async () => {
    if (!teacher?.id || bossTemplates.length === 0) return;

    const instancesMap = new Map<string, BossBattleInstance[]>();

    try {
      await Promise.all(
        bossTemplates.map(async (template) => {
          const bossTemplateId = safeStr((template as any).boss_template_id);
          if (!bossTemplateId) return;

          try {
            const instances = await fetchBossInstancesByTemplateId(bossTemplateId);
            instancesMap.set(bossTemplateId, instances || []);
          } catch (e) {
            console.error(`Failed to load boss instances for template ${bossTemplateId}:`, e);
            instancesMap.set(bossTemplateId, []);
          }
        })
      );

      setBossInstances(instancesMap);
    } catch (e) {
      console.error("Failed to load boss instances:", e);
    }
  }, [teacher?.id, bossTemplates]);

  useEffect(() => {
    if (bossTemplates.length > 0) {
      loadBossInstances();
    }
  }, [bossTemplates, loadBossInstances]);

  const usedSubjects = useMemo(() => {
    const subjects = new Set<string>();
    templates.forEach((t) => {
      const s = safeStr((t as any).subject).trim();
      if (s) subjects.add(s);
    });
    extraSubjects.forEach((s) => { if (s) subjects.add(s); });
    return Array.from(subjects).sort();
  }, [templates, extraSubjects]);

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
        if (subject && !usedSubjects.includes(subject)) {
          setExtraSubjects((prev) => [...prev, subject]);
        }
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

    // Track the subject for the dropdown in this session
    if (subject && !usedSubjects.includes(subject)) {
      setExtraSubjects((prev) => [...prev, subject]);
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

  // Boss: create instance and assign
  const handleAssignBoss = async () => {
    if (!bossAssigning || !bossAssignClassId) {
      setBossAssignError("Please select a class");
      return;
    }
    
    if (!bossAssignModeType || !bossAssignQuestionSelectionMode) {
      setBossAssignError("Please configure battle settings (mode and question selection)");
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
        //start_date: bossAssignStartDate || undefined,
        //due_date: bossAssignDueDate || undefined,
        requires_manual_approval: bossAssignManualApproval,
        status: "ACTIVE",
        class_id: bossAssignClassId,
        // Battle configuration
        mode_type: bossAssignModeType,
        question_selection_mode: bossAssignQuestionSelectionMode,
        late_join_policy: bossAssignLateJoinPolicy || undefined,
        initial_boss_hp: 1,
        countdown_seconds: bossAssignCountdownSeconds,
        time_limit_seconds_default: bossAssignQuestionTimeLimit === "" ? undefined : bossAssignQuestionTimeLimit,
        speed_bonus_enabled: bossAssignSpeedBonusEnabled,
        speed_bonus_floor_multiplier: bossAssignSpeedBonusFloor,
        speed_window_seconds: bossAssignSpeedWindow,
      };

      // POST 
      await createBossBattleInstanceApi({
        class_id: payload.class_id,
        boss_template_id: payload.boss_template_id,
        initial_boss_hp: payload.initial_boss_hp,
        status: "ACTIVE",
        mode_type: payload.mode_type,
        question_selection_mode: payload.question_selection_mode,
        late_join_policy: payload.late_join_policy,
        speed_bonus_enabled: payload.speed_bonus_enabled,
        speed_bonus_floor_multiplier: payload.speed_bonus_floor_multiplier,
        speed_window_seconds: payload.speed_window_seconds,
        time_limit_seconds_default: payload.time_limit_seconds_default,
        created_by_teacher_id: teacher?.id || "",
        passing_score_percent: bossAssignPassingScorePercent,
      });

      // Reset form state
      setBossAssignOpen(false);
      setBossAssigning(null);
      setBossAssignClassId("");
     // setBossAssignStartDate("");
    // setBossAssignDueDate("");
      setBossAssignManualApproval(false);
      setBossAssignTitleOverride("");
      setBossAssignDescriptionOverride("");
      setBossAssignModeType("");
      setBossAssignQuestionSelectionMode("");
      setBossAssignLateJoinPolicy("");
      setBossAssignPassingScorePercent(50);
      setBossAssignCountdownSeconds(0);
      setBossAssignQuestionTimeLimit("");
      setBossAssignSpeedBonusEnabled(false);
      setBossAssignSpeedBonusFloor(0.2);
      setBossAssignSpeedWindow(30);

      // refresh instances so UI shows class assignment under the boss card
      await loadBossInstances();
    } catch (e: any) {
      setBossAssignError(e?.message || "Failed to assign boss to class");
    } finally {
      setBossAssignLoading(false);
    }
  };

  // Boss: soft-delete template
  const deleteBossTemplate = async (t: BossBattleTemplate) => {
    const id = safeStr((t as any).boss_template_id);
    const title = safeStr((t as any).title);
    if (!id) return;
    if (!window.confirm(`Delete "${title}"?`)) return;

    try {
      // Use soft-delete API endpoint
      await softDeleteBossBattleTemplate(id, teacher?.id || "");

      // Remove from templates list
      setBossTemplates((prev) => prev.filter((x) => safeStr((x as any).boss_template_id) !== id));
      
      // also drop instances for this template
      setBossInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      console.error("Failed to delete boss template:", e);
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

  const getBossInstancesForTemplate = (bossTemplateId: string): BossBattleInstance[] => {
    const list = bossInstances.get(bossTemplateId) || [];
    return list.filter((i) => getBossStatus(i) !== "ARCHIVED");
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

  // Boss: open extension modal
  const openBossExtensionModal = (instance: BossBattleInstance) => {
    setBossSelectedForExtension(instance);
    setBossExtensionDueDate((instance as any).due_date || "");
    setBossExtensionError(null);
    setBossExtensionOpen(true);
  };

  const saveBossExtensionDate = async () => {
    if (!bossSelectedForExtension) return;

    setBossExtensionSaving(true);
    setBossExtensionError(null);

    try {
      const id = getBossInstanceId(bossSelectedForExtension);
      if (!id) throw new Error("Missing boss instance id");

      await updateBossInstanceDatesBestEffort(id, { due_date: bossExtensionDueDate || null });

      // update local map
      const bossTemplateId = getBossTemplateIdFromInstance(bossSelectedForExtension);
      setBossInstances((prev) => {
        const next = new Map(prev);
        const list = next.get(bossTemplateId) || [];
        const updated = list.map((x) => {
          const xid = getBossInstanceId(x);
          return xid === id ? { ...(x as any), due_date: bossExtensionDueDate || null } : x;
        });
        next.set(bossTemplateId, updated);
        return next;
      });

      setBossExtensionOpen(false);
      setBossSelectedForExtension(null);
    } catch (e: any) {
      setBossExtensionError(e?.message || "Failed to update due date");
    } finally {
      setBossExtensionSaving(false);
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

  const archiveBossInstance = async (instance: BossBattleInstance) => {
    if (!window.confirm("Archive this boss battle instance?")) return;

    try {
      const id = getBossInstanceId(instance);
      if (!id) throw new Error("Missing boss instance id");

      await updateBossInstanceStatusBestEffort(id, "ARCHIVED");

      const bossTemplateId = getBossTemplateIdFromInstance(instance);
      setBossInstances((prev) => {
        const next = new Map(prev);
        const list = next.get(bossTemplateId) || [];
        const updated = list.map((x) => {
          const xid = getBossInstanceId(x);
          return xid === id ? { ...(x as any), status: "ARCHIVED" } : x;
        });
        next.set(bossTemplateId, updated);
        return next;
      });
    } catch (e: any) {
      console.error("Failed to archive boss:", e);
      alert("Failed to archive boss battle");
    }
  };

  const removeAssignedClass = async (instance: QuestInstance) => {
    if (!window.confirm("Remove this quest from the class?")) return;

    try {
      await updateQuestInstanceStatus(instance.quest_instance_id, "ARCHIVED");

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

  const removeBossAssignedClass = async (instance: BossBattleInstance) => {
    if (!window.confirm("Remove this boss battle from the class?")) return;

    try {
      const id = getBossInstanceId(instance);
      if (!id) throw new Error("Missing boss instance id");

      await updateBossInstanceStatusBestEffort(id, "ARCHIVED");

      const bossTemplateId = getBossTemplateIdFromInstance(instance);
      setBossInstances((prev) => {
        const next = new Map(prev);
        const list = next.get(bossTemplateId) || [];
        const updated = list.map((x) => {
          const xid = getBossInstanceId(x);
          return xid === id ? { ...(x as any), status: "ARCHIVED" } : x;
        });
        next.set(bossTemplateId, updated);
        return next;
      });
    } catch (e: any) {
      console.error("Failed to remove boss assignment:", e);
      alert("Failed to remove boss assignment");
    }
  };

  // Auto-archive quests past due date
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

  // Auto-archive boss battles past due date
  useEffect(() => {
    const checkAndArchiveExpiredBosses = async () => {
      const now = new Date().getTime();
      const toArchive: BossBattleInstance[] = [];

      bossInstances.forEach((instances) => {
        instances.forEach((instance) => {
          const status = getBossStatus(instance);
          const due = (instance as any).due_date;
          if (status === "ACTIVE" && due) {
            const dueTime = new Date(due).getTime();
            if (dueTime < now) {
              toArchive.push(instance);
            }
          }
        });
      });

      for (const inst of toArchive) {
        try {
          const id = getBossInstanceId(inst);
          if (!id) continue;
          await updateBossInstanceStatusBestEffort(id, "ARCHIVED");
        } catch (e) {
          console.error(`Failed to auto-archive boss instance ${getBossInstanceId(inst)}:`, e);
        }
      }

      if (toArchive.length > 0) {
        await loadBossInstances();
      }
    };

    if (bossInstances.size > 0) {
      checkAndArchiveExpiredBosses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossInstances]);

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
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Classes
              </Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">
                Quests
              </Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Activity
              </Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Guilds
              </Link>
              <DropDownProfile
                username={teacher?.displayName || "user"}
                onLogout={() => {
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
                onProfileClick={() => setIsProfileModalOpen(true)}
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

        {loading && <div className="bg-white rounded-xl shadow-md p-5 text-gray-700">Loading templates…</div>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700">{error}</div>
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
                      <div key={(t as any).quest_template_id} className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300">
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

                <div className="flex gap-2">
                  <button
                    className="bg-white/15 hover:bg-white/20 text-white px-6 py-2 rounded-lg flex items-center border border-white/20"
                    onClick={async () => {
                      await loadBossTemplates();
                      await loadBossInstances();
                    }}
                    disabled={!teacher?.id || bossLoading}
                  >
                    <i data-feather="refresh-cw" className="mr-2"></i>
                    {bossLoading ? "Loading…" : "Refresh Boss Battles"}
                  </button>
                </div>
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

                          const assignedInstances = getBossInstancesForTemplate(id);

                          return (
                            <div key={id} className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300">
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

                                {/* Boss Instance Status */}
                                {(() => {
                                  if (assignedInstances.length === 0) {
                                    return (
                                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                                        <span className="inline-block px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                                          DRAFT - Not assigned to any class
                                        </span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                      <p className="text-xs font-semibold text-red-700 mb-2">Classes Assigned to:</p>
                                      <div className="space-y-3">
                                        {assignedInstances.map((instance: BossBattleInstance) => {
                                          const instId = getBossInstanceId(instance);
                                          const classId = getClassIdFromBossInstance(instance);
                                          const status = getBossStatus(instance);

                                          return (
                                            <div
                                              key={instId}
                                              className="text-xs border-b border-red-100 pb-2 last:border-0 last:pb-0 bg-white rounded p-2"
                                            >
                                              <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                                                <span className="font-semibold text-gray-800">
                                                  {getClassNameById(classId)}
                                                </span>
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    status === "ACTIVE"
                                                      ? "bg-green-100 text-green-800"
                                                      : status === "DRAFT"
                                                      ? "bg-yellow-100 text-yellow-800"
                                                      : status === "LOBBY"
                                                      ? "bg-blue-100 text-blue-800"
                                                      : "bg-gray-100 text-gray-800"
                                                  }`}
                                                >
                                                  {status}
                                                </span>
                                              </div>

                                              <div className="space-y-1 text-gray-600 mt-2">
                                                <div className="flex justify-between items-start">
                                                  <span className="font-medium">Date created:</span>
                                                  <span className="text-right text-gray-700">
                                                    {formatDateTime((instance as any).created_at)}
                                                  </span>
                                                </div>
                                                {/*(instance as any).due_date && (
                                                  <div className="flex justify-between items-start">
                                                    <span className="font-medium">Due:</span>
                                                    <span className="text-right text-gray-700">
                                                      {formatDateTime((instance as any).due_date)}
                                                    </span>
                                                  </div>
                                                )*/}
                                              </div>

                                              <div className="flex gap-1 mt-2 pt-2 border-t border-red-100">
                                               {/* <button
                                                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                                  onClick={() => openBossExtensionModal(instance)}
                                                  title="Edit due date for extension"
                                                >
                                                  <i data-feather="calendar" className="w-3 h-3"></i> Extend
                                                </button>*/}
                                                {status === "ACTIVE" && (
                                                  <button
                                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                                    onClick={() => archiveBossInstance(instance)}
                                                    title="Archive this boss battle"
                                                  >
                                                    <i data-feather="archive" className="w-3 h-3"></i> Archive
                                                  </button>
                                                )}
                                                <button
                                                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs flex items-center justify-center gap-1"
                                                  onClick={() => removeBossAssignedClass(instance)}
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
                                    onClick={() => openBossAssignModal(t)}
                                  >
                                    <i data-feather="users" className="mr-1 w-4 h-4"></i> Assign
                                  </button>

                                  <button
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                                    onClick={() =>
                                      navigate(`/teacher/bossQuestions?boss_template_id=${encodeURIComponent(id)}`, {
                                        state: { boss_template_id: id },
                                      })
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
              <button onClick={() => setIsModalOpen(false)} className="text-blue-500 hover:text-blue-700">
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateQuest}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quest Name</label>
                <input type="text" name="questName" className="w-full border border-gray-300 rounded-lg px-4 py-2" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full border border-gray-300 rounded-lg px-4 py-2" required defaultValue="Quest">
                  <option value="Quest">Quest</option>
                  <option value="Side Quest">Side Quest</option>
                  <option value="Boss Fight">Boss Battle</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  name="subject"
                  list="subject-suggestions"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="Type a subject..."
                  required
                />
                <datalist id="subject-suggestions">
                  {usedSubjects.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
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

      {/* Boss Assign Modal */}
      <BossAssignModal
        isOpen={bossAssignOpen}
        bossAssigning={bossAssigning}
        bossAssignError={bossAssignError}
        bossAssignLoading={bossAssignLoading}
        bossAssignClassId={bossAssignClassId}
        bossAssignStartDate={bossAssignStartDate}
        bossAssignDueDate={bossAssignDueDate}
        bossAssignManualApproval={bossAssignManualApproval}
        bossAssignTitleOverride={bossAssignTitleOverride}
        bossAssignDescriptionOverride={bossAssignDescriptionOverride}
        bossAssignModeType={bossAssignModeType}
        bossAssignQuestionSelectionMode={bossAssignQuestionSelectionMode}
        bossAssignLateJoinPolicy={bossAssignLateJoinPolicy}
        bossAssignPassingScorePercent={bossAssignPassingScorePercent}
        bossAssignCountdownSeconds={bossAssignCountdownSeconds}
        bossAssignQuestionTimeLimit={bossAssignQuestionTimeLimit}
        bossAssignSpeedBonusEnabled={bossAssignSpeedBonusEnabled}
        bossAssignSpeedBonusFloor={bossAssignSpeedBonusFloor}
        bossAssignSpeedWindow={bossAssignSpeedWindow}
        classes={classes}
        onClassIdChange={setBossAssignClassId}
        onStartDateChange={setBossAssignStartDate}
        onDueDateChange={setBossAssignDueDate}
        onManualApprovalChange={setBossAssignManualApproval}
        onTitleOverrideChange={setBossAssignTitleOverride}
        onDescriptionOverrideChange={setBossAssignDescriptionOverride}
        onModeTypeChange={setBossAssignModeType}
        onQuestionSelectionModeChange={setBossAssignQuestionSelectionMode}
        onLateJoinPolicyChange={setBossAssignLateJoinPolicy}
        onPassingScorePercentChange={setBossAssignPassingScorePercent}
        onCountdownSecondsChange={setBossAssignCountdownSeconds}
        onQuestionTimeLimitChange={setBossAssignQuestionTimeLimit}
        onSpeedBonusEnabledChange={setBossAssignSpeedBonusEnabled}
        onSpeedBonusFloorChange={setBossAssignSpeedBonusFloor}
        onSpeedWindowChange={setBossAssignSpeedWindow}
        onClose={() => {
          setBossAssignOpen(false);
          setBossAssigning(null);
        }}
        onAssign={handleAssignBoss}
      />

      {/* Boss Extend Modal */}
      <BossExtendModal
        isOpen={bossExtensionOpen}
        bossSelectedForExtension={bossSelectedForExtension}
        bossExtensionDueDate={bossExtensionDueDate}
        bossExtensionError={bossExtensionError}
        bossExtensionSaving={bossExtensionSaving}
        getClassNameById={getClassNameById}
        onDueDateChange={setBossExtensionDueDate}
        onClose={() => {
          setBossExtensionOpen(false);
          setBossSelectedForExtension(null);
        }}
        onSave={saveBossExtensionDate}
      />

      {/* Quest Modals */}
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
        questId={questTemplateId}
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

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default Subjects;