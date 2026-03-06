// bossClasses.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import feather from "feather-icons";
import {
  createBossBattleInstance,
  listBossBattleInstancesByClass,
  updateBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import type {
  BossBattleInstance,
  ModeType,
  QuestionSelectionMode,
} from "../../api/bossBattleInstances/types.js";

import {
  listBossBattleTemplatesByOwner,
  listPublicBossBattleTemplates,
} from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate as BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

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

type BossClassState = {
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

function formatModeType(mode: unknown): string {
  const modeStr = safeStr(mode);
  switch (modeStr) {
    case "SIMULTANEOUS_ALL":
      return "All Questions sent to Guilds";
    case "TURN_BASED_GUILD":
      return "Guild Rotation";
    case "RANDOMIZED_PER_GUILD":
      return "Random Guild Challenge";
    default:
      return modeStr;
  }
}

function formatQuestionSelectionMode(mode: unknown): string {
  const modeStr = safeStr(mode);
  switch (modeStr) {
    case "ORDERED":
      return "Sequential Order";
    case "RANDOM_NO_REPEAT":
      return "Shuffle Mode";
    default:
      return modeStr;
  }
}

const BossClasses = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as BossClassState | null;

  const [bossTemplates, setBossTemplates] = useState<BossBattleTemplate[]>([]);
  const [bossInstances, setBossInstances] = useState<BossBattleInstance[]>([]);
  const [bossLoading, setBossLoading] = useState(false);
  const [bossError, setBossError] = useState<string | null>(null);

  const [bossAssignOpen, setBossAssignOpen] = useState(false);
  const [selectedBossTemplateId, setSelectedBossTemplateId] = useState<string>("");
  const [bossAssigning, setBossAssigning] = useState(false);

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

  // Load boss battle templates (owned + public) + boss instances for this class
  useEffect(() => {
    if (!state?.class_id) return;

    const loadBossData = async () => {
      setBossLoading(true);
      setBossError(null);

      try {
        const currentUserJson = localStorage.getItem("cq_currentUser");
        if (!currentUserJson) {
          setBossError("User information not found. Please log in again.");
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
          setBossError("Failed to parse user information.");
          return;
        }

        if (!teacherId) {
          setBossError("Could not determine teacher ID.");
          return;
        }

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
    };

    loadBossData();
  }, [state?.class_id]);

  useEffect(() => {
    feather.replace();
  }, [bossTemplates, bossInstances, bossAssignOpen]);

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.toLocaleString("en-US", { month: "short" });
      const day = date.getDate();
      const time = date.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${month}. ${day} ${year}, ${time}`;
    } catch (e) {
      return String(dateString);
    }
  };

  const refreshBossInstances = async () => {
    if (!state?.class_id) return;
    try {
      const bossInstRes = await listBossBattleInstancesByClass(state.class_id, {
        limit: 100,
      } as any);
      const bossItems = (bossInstRes as any)?.items || [];
      setBossInstances(bossItems as any);
    } catch (e) {
      console.error("Failed to refresh boss instances:", e);
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

      await refreshBossInstances();

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
      await refreshBossInstances();
    } catch (e: any) {
      console.error("Failed to abort boss battle:", e);
      alert(e?.message || "Failed to abort boss battle");
    }
  };

  const launchBossBattle = async (instance: BossBattleInstance) => {
    const instanceId = getBossInstanceId(instance);
    if (!instanceId) return;

    try {
      const now = new Date();

      await updateBossBattleInstance(
        instanceId,
        {
          status: "LOBBY",
          lobby_opened_at: now.toISOString(),
        } as any
      );

      await refreshBossInstances();

      navigate(`/teacher/boss-lobby/${instanceId}`);
    } catch (e: any) {
      console.error("Failed to launch boss battle:", e);
      alert(e?.message || "Failed to launch boss battle");
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
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        <Link
          to="/classes"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>

        <button
          onClick={openBossAssignModal}
          className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          <i data-feather="plus" className="w-4 h-4 mr-2"></i>
          Assign Boss Battle
        </button>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-red-300 mb-2">
            {state.className} - Boss Battles
          </h1>
          <p className="text-white">Assign and manage boss battles for this class</p>
        </div>

        {/* Error */}
        {bossError && (
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-md p-5 text-red-700 mb-6">
            {bossError}
          </div>
        )}

        {/* Loading */}
        {bossLoading && (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            Loading boss battles...
          </div>
        )}

        {/* Empty State */}
        {!bossLoading && bossInstances.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-700">
            <p>No boss battles assigned to this class yet.</p>
          </div>
        )}

        {/* Boss Battles Grid */}
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
              const initialHearts = toInt((inst as any).initial_boss_hp, 0);
              const xp = tmpl ? toInt(tmpl.base_xp_reward, 0) : 0;
              const gold = tmpl ? toInt(tmpl.base_gold_reward, 0) : 0;

              const status = getBossStatus(inst) || "DRAFT";

              return (
                <div
                  key={
                    getBossInstanceId(inst) ||
                    `${bossTemplateId}-${safeStr((inst as any).created_at)}`
                  }
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
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Boss Hearts
                        </p>
                        <p className="text-gray-900 font-medium text-sm">
                          {initialHearts}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Rewards
                        </p>
                        <p className="text-gray-900 font-medium text-sm">
                          + {xp} XP / {gold} Gold
                        </p>
                      </div>
                    </div>

                    {/* Battle Configuration */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-indigo-700 font-semibold">
                          Battle Mode
                        </span>
                        <span className="text-gray-800 font-medium">
                          {formatModeType((inst as any).mode_type)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-indigo-700 font-semibold">
                          Questions Type
                        </span>
                        <span className="text-gray-800 font-medium">
                          {formatQuestionSelectionMode(
                            (inst as any).question_selection_mode
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Created */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 font-semibold">Created</span>
                        <span className="text-gray-800">
                          {formatDateTime((inst as any).created_at)}
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

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">
                      <button
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                        onClick={() => launchBossBattle(inst)}
                      >
                        <i data-feather="play-circle" className="w-4 h-4"></i>
                        Open Lobby
                      </button>

                      <button
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                        onClick={() => abortBossInstance(inst)}
                      >
                        <i data-feather="slash" className="w-4 h-4"></i>
                        Abort Boss Battle
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Boss Assign Modal */}
        {bossAssignOpen && (
          <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-20">
            <div className="relative mx-auto p-6 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Assign Boss Battle
                </h3>
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
    </div>
  );
};

export default BossClasses;