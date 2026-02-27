//classQuest.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import {
  listQuestInstancesByClass,
  updateQuestInstanceDates,
  type QuestInstance,
} from "../../api/questInstances.js";
import {
  getQuestTemplatesByOwner,
  getPublicQuestTemplates,
  type QuestTemplate,
} from "../../api/questTemplates.js";

import {
  createBossBattleInstance,
  listBossBattleInstancesByClass,
  updateBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import {
  listBossBattleTemplatesByOwner,
  listPublicBossBattleTemplates,
} from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplateItem as BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import DropDownProfile from "../features/teacher/dropDownProfile.tsx";

// Utility to convert string input to int
function toInt(val: unknown, fallback = 0) {
  const n = Number(String(val ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

// Utility to safely convert unknown values to strings for display
function safeStr(val: unknown) {
  return String(val ?? "");
}

type ClassQuestState = {
  class_id: string;
  className: string;
};

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

// ---------- Boss Battle helpers ----------
function getBossInstanceId(i: BossBattleInstance): string {
  return safeStr((i as any).boss_instance_id) || safeStr((i as any).id);
}
function getBossTemplateIdFromInstance(i: BossBattleInstance): string {
  return safeStr((i as any).boss_template_id);
}
function getBossStatus(i: BossBattleInstance): string {
  return safeStr((i as any).status);
}

const ClassQuest = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ClassQuestState | null;

  const [instances, setInstances] = useState<QuestInstance[]>([]);
  const [templates, setTemplates] = useState<Map<string, QuestTemplate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Boss battles (templates + instances)
  const [bossTemplates, setBossTemplates] = useState<BossBattleTemplate[]>([]);
  const [bossInstances, setBossInstances] = useState<BossBattleInstance[]>([]);
  const [bossLoading, setBossLoading] = useState(false);
  const [bossError, setBossError] = useState<string | null>(null);

  const [bossAssignOpen, setBossAssignOpen] = useState(false);
  const [selectedBossTemplateId, setSelectedBossTemplateId] = useState<string>("");
  const [bossAssigning, setBossAssigning] = useState(false);

  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<QuestInstance | null>(null);
  const [extensionDueDate, setExtensionDueDate] = useState<string>("");
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSaving, setExtensionSaving] = useState(false);
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  useEffect(() => {
    feather.replace();
  }, []);

  // Load teacher data from localStorage
  useEffect(() => {
    const currentUserJson = localStorage.getItem("cq_currentUser");
    if (currentUserJson) {
      try {
        const teacherData = JSON.parse(currentUserJson) as TeacherUser;
        setTeacher(teacherData);
      } catch (error) {
        console.error("Failed to parse teacher data from localStorage:", error);
      }
    }
  }, []);

  // Load quest instances for this class
  useEffect(() => {
    if (!state?.class_id) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get teacher ID from localStorage
        const currentUserJson = localStorage.getItem("cq_currentUser");
        if (!currentUserJson) {
          setError("User information not found. Please log in again.");
          return;
        }

        let teacherId: string | null = null;
        try {
          const userData = JSON.parse(currentUserJson);
          teacherId =
            userData?.id ??
            userData?.teacher_id ??
            userData?.userId ??
            userData?.sub ??
            null;
        } catch (e) {
          setError("Failed to parse user information.");
          return;
        }

        if (!teacherId) {
          setError("Could not determine teacher ID.");
          return;
        }

        // Load all instances for this class
        const instancesRes = await listQuestInstancesByClass(state.class_id);
        const classInstances = (instancesRes as any).items || [];
        setInstances(classInstances);

        // Load all templates (owned + public)
        const [ownedRes, publicRes] = await Promise.all([
          getQuestTemplatesByOwner(teacherId),
          getPublicQuestTemplates(),
        ]);

        const allTemplates = [
          ...((ownedRes as any).items ?? []),
          ...((publicRes as any).items ?? []),
        ];

        const templateMap = new Map<string, QuestTemplate>();
        for (const t of allTemplates) {
          templateMap.set((t as any).quest_template_id, t);
        }
        setTemplates(templateMap);

        // --------------------
        // Load boss battle templates (owned + public) + boss instances for this class
        // --------------------
        setBossLoading(true);
        setBossError(null);
        try {
          const [bossOwnedRes, bossPublicRes] = await Promise.all([
            listBossBattleTemplatesByOwner(teacherId),
            listPublicBossBattleTemplates(),
          ]);

          const ownedBoss = Array.isArray(bossOwnedRes)
            ? bossOwnedRes
            : (bossOwnedRes as any)?.items || [];
          const publicBoss = Array.isArray(bossPublicRes)
            ? bossPublicRes
            : (bossPublicRes as any)?.items || [];

          // de-dupe by boss_template_id
          const seen = new Set<string>();
          const mergedBoss: BossBattleTemplate[] = [];
          for (const t of [...ownedBoss, ...publicBoss]) {
            const id = safeStr((t as any)?.boss_template_id);
            if (!id) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            mergedBoss.push(t as any);
          }
          setBossTemplates(mergedBoss);

          // Boss instances for this class
          const bossInstRes = await listBossBattleInstancesByClass(state.class_id, {
            limit: 100,
          } as any);
          const bossItems = (bossInstRes as any)?.items || [];
          setBossInstances(bossItems as any);
        } catch (e: any) {
          console.error("Error loading boss battles:", e);
          setBossError(e?.message || "Failed to load boss battles for this class");
          setBossTemplates([]);
          setBossInstances([]);
        } finally {
          setBossLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading class quests:", err);
        setError(err?.message || "Failed to load quests for this class");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [state?.class_id]);

  useEffect(() => {
    feather.replace();
  }, [instances, bossTemplates, bossInstances]);

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

  const openExtensionModal = (instance: QuestInstance) => {
    setSelectedInstance(instance);
    setExtensionDueDate(
      instance.due_date ? new Date(instance.due_date).toISOString().slice(0, 16) : ""
    );
    setExtensionError(null);
    setExtensionModalOpen(true);
  };

  const saveExtensionDate = async () => {
    if (!selectedInstance) return;
    if (!extensionDueDate) {
      setExtensionError("Please select a due date");
      return;
    }

    setExtensionSaving(true);
    setExtensionError(null);

    try {
      const newDueDate = new Date(extensionDueDate).toISOString();
      await updateQuestInstanceDates(selectedInstance.quest_instance_id, {
        start_date: selectedInstance.start_date || undefined,
        due_date: newDueDate,
      });

      // Update in local state
      setInstances((prev) =>
        prev.map((inst) =>
          inst.quest_instance_id === selectedInstance.quest_instance_id
            ? { ...inst, due_date: newDueDate }
            : inst
        )
      );

      setExtensionModalOpen(false);
      setSelectedInstance(null);
      setExtensionDueDate("");
    } catch (err: any) {
      console.error("Error updating due date:", err);
      setExtensionError(err?.message || "Failed to update due date");
    } finally {
      setExtensionSaving(false);
    }
  };

  // --------------------
  // Boss battle actions
  // --------------------
  const openBossAssignModal = () => {
    setSelectedBossTemplateId("");
    setBossAssignOpen(true);
  };

  const handleAssignBoss = async () => {
    if (!selectedBossTemplateId) return;

    const tmpl = bossTemplates.find(
      (t: any) => safeStr((t as any).boss_template_id) === selectedBossTemplateId
    ) as any;
    if (!tmpl) return;

    setBossAssigning(true);
    setBossError(null);

    try {
      const initialHp = toInt((tmpl as any).max_hp, 100) || 100;

      await createBossBattleInstance({
        class_id: state!.class_id,
        boss_template_id: selectedBossTemplateId,
        initial_boss_hp: initialHp,
      } as any);

      // refresh boss instances
      const bossInstRes = await listBossBattleInstancesByClass(state!.class_id, {
        limit: 100,
      } as any);
      const bossItems = (bossInstRes as any)?.items || [];
      setBossInstances(bossItems as any);

      setBossAssignOpen(false);
      setSelectedBossTemplateId("");
    } catch (e: any) {
      console.error("Failed to assign boss battle:", e);
      setBossError(e?.message || "Failed to assign boss battle");
    } finally {
      setBossAssigning(false);
    }
  };

  const abortBossInstance = async (instance: BossBattleInstance) => {
    const instanceId = getBossInstanceId(instance);
    if (!instanceId) return;

    try {
      await updateBossBattleInstance(instanceId, { status: "ABORTED" } as any);

      const bossInstRes = await listBossBattleInstancesByClass(state!.class_id, {
        limit: 100,
      } as any);
      const bossItems = (bossInstRes as any)?.items || [];
      setBossInstances(bossItems as any);
    } catch (e: any) {
      console.error("Failed to abort boss battle:", e);
      alert(e?.message || "Failed to abort boss battle");
    }
  };

  useEffect(() => {
    feather.replace();
  });

  if (!state) {
    return (
      <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
        <nav className="bg-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link
                  to="/teacherDashboard"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center h-full">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-700 mb-4">
              Class data not found. Please go back and try again.
            </p>
            <Link
              to="/classes"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen overflow-y-auto">
      {/* Nav bar */}
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
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Classes
              </Link>
              <Link
                to="/Subjects"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
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

      {/* Back button */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          to="/classes"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-yellow-300  mb-2">
            {state.className}
          </h1>
          <p className="text-white/80">Assigned Quests</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            Loading quests...
          </div>
        )}

        {/* Quests Grid */}
        {!loading && instances.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-700">
            <p>No quests assigned to this class yet.</p>
            <Link
              to="/Subjects"
              className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Go to Quest Management
            </Link>
          </div>
        )}

        {!loading && instances.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => {
              const template = templates.get((instance as any).quest_template_id);
              if (!template) return null;

              const type = safeStr((template as any).type);
              const icon =
                type === "BOSS_FIGHT"
                  ? "shield"
                  : type === "DAILY_QUEST"
                  ? "calendar"
                  : "activity";

              const xp = toInt((template as any).base_xp_reward, 0);
              const gold = toInt((template as any).base_gold_reward, 0);

              return (
                <div
                  key={instance.quest_instance_id}
                  className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300 hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="bg-linear-to-r from-pink-500 to-yellow-600 p-6 text-white text-center">
                    <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3">
                      <i data-feather="file" className="w-10 h-10 text-gray-600"></i>
                    </div>
                    <h3 className="text-lg font-bold">{safeStr((template as any).title)}</h3>
                    <p className="text-white text-sm">{safeStr((template as any).subject)}</p>
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-4">
                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Difficulty</p>
                        <p className="text-gray-900 font-medium text-sm">
                          {safeStr((template as any).difficulty)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Grade</p>
                        <p className="text-gray-900 font-medium text-sm">
                          {safeStr((template as any).grade)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Type</p>
                        <p className="text-gray-900 font-medium text-sm">{type}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Rewards</p>
                        <p className="text-gray-900 font-medium text-sm">
                          + {xp} XP / {gold} Gold
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200"></div>

                    {/* Duration & Visibility */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        <span className="font-semibold">Duration:</span>{" "}
                        {toInt((template as any).estimated_duration_minutes, 0)} min
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          (template as any).is_shared_publicly
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {(template as any).is_shared_publicly ? "Public" : "Private"}
                      </span>
                    </div>

                    {/* Due Date */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                        Due Date
                      </p>
                      <p className="text-gray-900 font-semibold text-sm">
                        {formatDateTime(instance.due_date)}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
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

                    {/* Extend Button */}
                    <button
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                      onClick={() => openExtensionModal(instance)}
                    >
                      <i data-feather="calendar" className="w-4 h-4"></i>
                      Extend Due Date
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Boss Battles Section */}
        <div className="mt-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-red-300 mb-1">Boss Battles</h2>
              <p className="text-white/80">Assign and manage boss battles for this class</p>
            </div>

            <div className="flex gap-3">
              <button
                className="inline-flex items-center bg-green-600 text-white rounded-md px-4 py-2 hover:bg-green-700"
                onClick={openBossAssignModal}
                disabled={bossLoading || bossTemplates.length === 0}
                title={bossTemplates.length === 0 ? "No boss templates available yet" : "Assign a boss battle"}
              >
                <i data-feather="plus-circle" className="w-5 h-5 mr-2"></i>
                Assign Boss Battle
              </button>

              <Link
                to="/Subjects"
                className="inline-flex items-center bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700"
                title="Manage boss templates"
              >
                <i data-feather="edit-3" className="w-5 h-5 mr-2"></i>
                Manage Templates
              </Link>
            </div>
          </div>

          {bossError && (
            <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700 mb-6">
              {bossError}
            </div>
          )}

          {bossLoading && (
            <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center mb-6">
              Loading boss battles...
            </div>
          )}

          {!bossLoading && bossInstances.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-700 mb-6">
              <p>No boss battles assigned to this class yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Click <span className="font-semibold">Assign Boss Battle</span> to assign one.
              </p>
            </div>
          )}

          {!bossLoading && bossInstances.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bossInstances.map((inst) => {
                const bossTemplateId = getBossTemplateIdFromInstance(inst);
                const tmpl = bossTemplates.find(
                  (t: any) => safeStr((t as any).boss_template_id) === bossTemplateId
                ) as any;

                const title = tmpl ? safeStr(tmpl.title) : "Unknown Boss";
                const subject = tmpl ? safeStr(tmpl.subject) : "—";
                const desc = tmpl ? safeStr(tmpl.description) : "";
                const hp = tmpl ? toInt(tmpl.max_hp, 0) : 0;
                const xp = tmpl ? toInt(tmpl.base_xp_reward, 0) : 0;
                const gold = tmpl ? toInt(tmpl.base_gold_reward, 0) : 0;

                const status = getBossStatus(inst) || "DRAFT";

                return (
                  <div
                    key={getBossInstanceId(inst) || `${bossTemplateId}-${safeStr((inst as any).created_at)}`}
                    className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300 hover:shadow-lg"
                  >
                    {/* Header */}
                    <div className="bg-linear-to-r from-red-500 to-purple-700 p-6 text-white text-center">
                      <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3">
                        <i data-feather="shield" className="w-10 h-10 text-gray-600"></i>
                      </div>
                      <h3 className="text-lg font-bold">{title}</h3>
                      <p className="text-white text-sm">{subject}</p>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                      {desc && <p className="text-gray-700 text-sm">{desc}</p>}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">HP</p>
                          <p className="text-gray-900 font-medium text-sm">{hp}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Rewards</p>
                          <p className="text-gray-900 font-medium text-sm">
                            + {xp} XP / {gold} Gold
                          </p>
                        </div>
                      </div>

                      {/* Created / Updated */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700 font-semibold">Created</span>
                          <span className="text-gray-800">
                            {formatDateTime((inst as any).created_at)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-blue-700 font-semibold">Updated</span>
                          <span className="text-gray-800">
                            {formatDateTime((inst as any).updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            status === "LOBBY" || status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : status === "DRAFT"
                              ? "bg-yellow-100 text-yellow-800"
                              : status === "COMPLETED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Abort */}
                      <button
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                        onClick={() => abortBossInstance(inst)}
                      >
                        <i data-feather="slash" className="w-4 h-4"></i>
                        Abort Boss Battle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Boss Assign Modal */}
        {bossAssignOpen && (
          <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-20">
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Assign Boss Battle</h3>
                <button
                  onClick={() => setBossAssignOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  disabled={bossAssigning}
                >
                  <i data-feather="x"></i>
                </button>
              </div>

              {bossTemplates.length === 0 ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 mb-4">
                  No boss templates found. Create one in{" "}
                  <span className="font-semibold">Subjects</span> first.
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Boss Template
                    </label>
                    <select
                      value={selectedBossTemplateId}
                      onChange={(e) => setSelectedBossTemplateId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={bossAssigning}
                    >
                      <option value="">Select a boss...</option>
                      {bossTemplates.map((t: any) => {
                        const id = safeStr((t as any).boss_template_id);
                        const title = safeStr((t as any).title);
                        const subj = safeStr((t as any).subject);
                        return (
                          <option key={id} value={id}>
                            {title} {subj ? `(${subj})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setBossAssignOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      disabled={bossAssigning}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignBoss}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                      disabled={bossAssigning || !selectedBossTemplateId}
                    >
                      {bossAssigning ? "Assigning..." : "Assign"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Extension Modal */}
      {extensionModalOpen && selectedInstance && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-20">
          <div className="relative mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Extend Due Date</h3>
              <button
                onClick={() => {
                  setExtensionModalOpen(false);
                  setSelectedInstance(null);
                }}
                className="text-gray-500 hover:text-gray-700"
                disabled={extensionSaving}
              >
                <i data-feather="x"></i>
              </button>
            </div>

            <div className="mb-6 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Quest:</span>{" "}
                {safeStr(
                  (templates.get((selectedInstance as any).quest_template_id) as any)?.title ||
                    "Unknown"
                )}
              </p>
            </div>

            {extensionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {extensionError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={extensionDueDate}
                onChange={(e) => setExtensionDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={extensionSaving}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setExtensionModalOpen(false);
                  setSelectedInstance(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={extensionSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveExtensionDate}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
                disabled={extensionSaving || !extensionDueDate}
              >
                {extensionSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassQuest;