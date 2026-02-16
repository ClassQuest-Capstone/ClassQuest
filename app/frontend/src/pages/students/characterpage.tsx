// CharacterPage.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import feather from "feather-icons";
import { Link, Navigate } from "react-router-dom";
import "../../styles/character.css";
import { TutorialProvider } from "../components/tutorial/contextStudent.tsx";
import { TutorialIntroModal } from "../components/tutorial/introModalStudent.tsx";
import { TutorialOverlay } from "../components/tutorial/overlayStudent.tsx";
import { getGuild as apiGetGuild, type Guild } from "../../api/guilds.js";
import { getGuildMembership } from "../../api/guildMemberships.js";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";

import { listQuestInstancesByClass, type QuestInstance, } from "../../api/questInstances.js";

// ✅ use enrollments instead of student.class_id
import { getStudentEnrollments, type EnrollmentItem, } from "../../api/classEnrollments.js";

import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

type EquipmentSlot = "helmet" | "armour" | "shield" | "pet" | "background";

interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  icon: string; // path under public/
}

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  helmet: "Helmet",
  armour: "Armour",
  shield: "Shield",
  pet: "Pet",
  background: "Background",
};

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "helmet",
  "armour",
  "shield",
  "pet",
  "background",
];

// Render order for the character preview (back → front)
const PREVIEW_ORDER: EquipmentSlot[] = [
  "background",
  "helmet",
  "armour",
  "shield",
  "pet",
];

// starter inventory
const INITIAL_INVENTORY: EquipmentItem[] = [
  {
    id: "helm1",
    name: "Helmet 1",
    slot: "helmet",
    icon: "/assets/warrior/helmets/helm1.png",
  },
  {
    id: "helm2",
    name: "Helmet 2",
    slot: "helmet",
    icon: "/assets/warrior/helmets/helm2.png",
  },
  {
    id: "armour1",
    name: "Armour 1",
    slot: "armour",
    icon: "/assets/warrior/armours/armour1.png",
  },
  {
    id: "armour2",
    name: "Armour 2",
    slot: "armour",
    icon: "/assets/warrior/armours/armour2.png",
  },
  {
    id: "shield1",
    name: "Shield 1",
    slot: "shield",
    icon: "/assets/warrior/shields/shield1.png",
  },
  {
    id: "shield2",
    name: "Shield 2",
    slot: "shield",
    icon: "/assets/warrior/shields/shield2.png",
  },
  {
    id: "background1",
    name: "Background 1",
    slot: "background",
    icon: "/assets/background/background1.png",
  },
  {
    id: "dog",
    name: "Pet 1",
    slot: "pet",
    icon: "/assets/pets/dog.png",
  },
];

// --------------------
// Tabs + Rewards helpers
// --------------------
type TabKey = "quests" | "subjects" | "rewards" | "hearts";

// Subject color mapping
const SUBJECT_COLORS = {
  mathematics: {
    gradient: "from-blue-600 to-blue-800",
    text: "text-blue-100",
    bar: "bg-blue-400",
    label: "Mathematics",
  },
  science: {
    gradient: "from-green-600 to-green-800",
    text: "text-green-100",
    bar: "bg-green-400",
    label: "Science",
  },
  history: {
    gradient: "from-red-600 to-red-800",
    text: "text-red-100",
    bar: "bg-red-400",
    label: "History",
  },
  ELA: {
    gradient: "from-purple-600 to-purple-800",
    text: "text-purple-100",
    bar: "bg-purple-400",
    label: "ELA",
  },
};

type SubjectKey = keyof typeof SUBJECT_COLORS;

// UI Quest model for rendering
type UIQuest = {
  id: string; // quest_instance_id
  title: string;
  description: string;
  subjectKey: SubjectKey;
  completed: number;
  total: number;
  rewardText: string;
  action: string;
  dueDate?: string | null;
  questTemplateId?: string | null;
};

// --------------------
// Current student
// --------------------
type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  class_id?: string;
  classCode?: string;
  avatarUrl?: string;
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

function normalizeSubjectKey(subject: unknown): SubjectKey {
  const s = safeStr(subject).toLowerCase();

  if (s.includes("math")) return "mathematics";
  if (s.includes("sci")) return "science";
  if (s.includes("hist")) return "history";
  if (s.includes("ela") || s.includes("english") || s.includes("language"))
    return "ELA";

  return "mathematics";
}

const CharacterPage: React.FC = () => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [inventory] = useState<EquipmentItem[]>(INITIAL_INVENTORY);
  const [equipped, setEquipped] = useState<
    Partial<Record<EquipmentSlot, EquipmentItem | null>>
  >({
    helmet: null,
    armour: null,
    shield: null,
    pet: null,
    background: null,
  });

  // Tabs state
  const [tab, setTab] = useState<TabKey>("quests");
  const [showAllQuests, setShowAllQuests] = useState(false);

  // ✅ Student from localStorage
  const student = useMemo(() => getCurrentStudent(), []);
  if (!student) return <Navigate to="/StudentLogin" replace />;

  const studentId = student.id;
  const displayName = student.displayName ?? "Student";
  const avatarUrl = student.avatarUrl ?? "http://static.photos/people/200x200/8";

  // Track class_id for player progression hook
  const [classId, setClassId] = useState<string | null>(
    student.class_id || localStorage.getItem("cq_currentClassId")
  );

  // Fetch first active class enrollment to get classId if not already set
  useEffect(() => {
    if (!studentId || classId) return; // Skip if classId is already set

    (async () => {
      try {
        const enr = await getStudentEnrollments(studentId);
        const activeEnrollment = (enr.items || []).find(
          (e: EnrollmentItem) => e.status === "active"
        );
        if (activeEnrollment?.class_id) {
          setClassId(activeEnrollment.class_id);
          localStorage.setItem("cq_currentClassId", activeEnrollment.class_id);
        }
      } catch (err) {
        console.error("Failed to fetch enrollments:", err);
      }
    })();
  }, [studentId, classId]);

  // Player progression fetches from player state and student profile
  const {
    profile,
    gainXP,
    purchaseReward,
    getRewardsWithStatus,
    getXPProgress,
    getMilestoneProgress,
    regenerateHearts,
    weekendReset,
  } = usePlayerProgression(studentId, classId || "");

  // Get current XP progress for bars
  const xpProgress = getXPProgress();
  const milestoneProgress = getMilestoneProgress();
  const rewards = getRewardsWithStatus();

  // Check for heart regeneration every 60 seconds
  useEffect(() => {
    const heartRegenInterval = setInterval(() => {
      regenerateHearts();
    }, 60 * 1000);
    return () => clearInterval(heartRegenInterval);
  }, [regenerateHearts]);

  // Check for weekend reset every hour
  useEffect(() => {
    const weekendResetInterval = setInterval(() => {
      weekendReset();
    }, 60 * 60 * 1000);
    return () => clearInterval(weekendResetInterval);
  }, [weekendReset]);

  // --------------------
  // ✅ Dynamic quests via enrollments (multi-class)
  // --------------------
  const [quests, setQuests] = useState<UIQuest[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [questsError, setQuestsError] = useState<string | null>(null);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);

  useEffect(() => {
    if (!studentId) return;

    (async () => {
      try {
        setQuestsLoading(true);
        setQuestsError(null);

        // 1) Find all ACTIVE class enrollments for this student
        const enr = await getStudentEnrollments(studentId);
        const classIds = (enr.items || [])
          .filter((e: EnrollmentItem) => e.status === "active")
          .map((e: EnrollmentItem) => e.class_id)
          .filter(Boolean);

        if (classIds.length === 0) {
          setQuests([]);
          return;
        }

        // 2) Fetch quest instances for each class, then merge
        const perClass = await Promise.all(
          classIds.map((cid) =>
            listQuestInstancesByClass(cid).catch(() => ({ items: [], count: 0 }))
          )
        );

        const merged: QuestInstance[] = perClass.flatMap((r: any) => r.items || []);

        // 3) Keep ACTIVE only + dedupe by quest_instance_id
        const seen = new Set<string>();
        const active = merged.filter((q: QuestInstance) => {
          if (q.status !== "ACTIVE") return false;
          const id = q.quest_instance_id;
          if (!id) return false;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        // 4) OPTIONAL template join (kept from your code)
        let templateMap = new Map<string, any>();
        const templateIds = Array.from(
          new Set(active.map((q) => q.quest_template_id).filter(Boolean))
        ) as string[];

        if (templateIds.length > 0) {
          try {
            const mod: any = await import("../../api/questTemplates.js");
            const getQuestTemplate =
              mod?.getQuestTemplate ?? mod?.getQuestTemplateById;

            if (typeof getQuestTemplate === "function") {
              const templates = await Promise.all(
                templateIds.map((id) => getQuestTemplate(id).catch(() => null))
              );
              templates
                .filter(Boolean)
                .forEach((t: any) =>
                  templateMap.set(t.quest_template_id ?? t.id ?? t.quest_template_id, t)
                );
            }
          } catch {
            // no templates available — fine
          }
        }

        // 5) Convert to UI model
        const ui: UIQuest[] = active.map((inst: QuestInstance) => {
          const tmpl = inst.quest_template_id
            ? templateMap.get(inst.quest_template_id)
            : null;

          const subjectKey = normalizeSubjectKey(tmpl?.subject);

          return {
            id: inst.quest_instance_id,
            questTemplateId: inst.quest_template_id ?? null,
            title: inst.title_override || tmpl?.title || "Quest",
            description: inst.description_override || tmpl?.description || "",
            subjectKey,
            // progress not wired yet (needs quest attempt/progress table)
            completed: 0,
            total: Number(tmpl?.question_count ?? 1) || 1,
            rewardText: safeStr(tmpl?.reward ?? ""),
            action: "Start",
            dueDate: inst.due_date ?? null,
          };
        });

        setQuests(ui);
      } catch (e: any) {
        setQuestsError(e?.message || "Failed to load quests");
        setQuests([]);
      } finally {
        setQuestsLoading(false);
      }
    })();
  }, [studentId]);

  // Fetch guild for the student
  useEffect(() => {
    if (!studentId) return;

    (async () => {
      try {
        // Get the first active enrollment to get a class_id
        const enr = await getStudentEnrollments(studentId);
        const activeEnrollment = (enr.items || []).find(
          (e: EnrollmentItem) => e.status === "active"
        );

        if (!activeEnrollment?.class_id) {
          setMyGuild(null);
          return;
        }

        // Get the student's guild membership in this class
        const membership = await getGuildMembership(
          activeEnrollment.class_id,
          studentId
        );

        if (!membership?.guild_id) {
          setMyGuild(null);
          return;
        }

        // Fetch the guild details
        const guild = await apiGetGuild(membership.guild_id);
        setMyGuild(guild || null);
      } catch (e: any) {
        // Student not in a guild or API error
        setMyGuild(null);
      }
    })();
  }, [studentId]);

  useEffect(() => {
    feather.replace();
  }, [isUserMenuOpen, inventory, equipped, tab, quests, questsLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        userMenuButtonRef.current &&
        !userMenuButtonRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isUserMenuOpen]);

  // drag handlers
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: EquipmentItem
  ) => {
    e.dataTransfer.setData("equip-id", item.id);
    e.dataTransfer.setData("equip-slot", item.slot);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverSlot = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnSlot = (
    e: React.DragEvent<HTMLDivElement>,
    slot: EquipmentSlot
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("equip-id");
    const itemSlot = e.dataTransfer.getData("equip-slot") as EquipmentSlot;

    if (!id || !itemSlot) return;
    if (itemSlot !== slot) return;

    const item = inventory.find((i) => i.id === id);
    if (!item) return;

    setEquipped((prev) => ({
      ...prev,
      [slot]: item,
    }));
  };

  const TabButton = ({
    value,
    label,
    icon,
  }: {
    value: TabKey;
    label: string;
    icon: string;
  }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition border ${
          active
            ? "bg-yellow-500 text-black border-yellow-300 shadow"
            : "bg-gray-900/40 text-gray-200 border-gray-700 hover:bg-gray-800"
        }`}
      >
        <i data-feather={icon} className="w-4 h-4" />
        {label}
      </button>
    );
  };

  // group quests by subject for "All Quests"
  const questsBySubject = useMemo(() => {
    const groups: Record<SubjectKey, UIQuest[]> = {
      mathematics: [],
      science: [],
      history: [],
      ELA: [],
    };
    for (const q of quests) groups[q.subjectKey].push(q);
    return groups;
  }, [quests]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <TutorialProvider>
        <TutorialIntroModal />
        <TutorialOverlay />

        {/* Navigation */}
        <nav className="bg-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div id="nav-tab" className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <Link
                    to="/character"
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                    <span className="text-xl font-bold"> ClassQuest</span>
                  </Link>
                </div>
              </div>

              <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
                <Link
                  to="/character"
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
                >
                  Character
                </Link>
                <Link
                  to="/guilds"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Guilds
                </Link>
                <Link
                  to="/leaderboards"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-600 hover:bg-blue-600"
                >
                  Leaderboard
                </Link>

                <div className="flex items-center ml-4">
                  <Link
                    to="/shop"
                    className="flex items-center bg-primary-600 px-3 py-1 rounded-full hover:bg-primary-700 transition"
                  >
                    <img
                      src="/assets/icons/gold-bar.png"
                      alt="Gold"
                      className="h-5 w-5 mr-1"
                    />
                    <span className="text-white font-medium">
                      {profile.gold.toLocaleString()}
                    </span>
                  </Link>
                </div>

                <div className="relative ml-3" ref={userMenuRef}>
                  <div>
                    <button
                      id="user-menu-button"
                      ref={userMenuButtonRef}
                      type="button"
                      className="flex items-center text-sm rounded-full focus:outline-none"
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    >
                      <img
                        className="h-8 w-8 rounded-full"
                        src={avatarUrl}
                        alt="User avatar"
                      />
                      <span className="ml-2 text-sm font-medium">
                        {displayName}
                      </span>
                    </button>
                  </div>

                  <div
                    id="user-menu"
                    className={`origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 ${
                      isUserMenuOpen ? "" : "hidden"
                    }`}
                  >
                    <button className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Your Profile
                    </button>
                    <Link
                      to="/role"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign out
                    </Link>
                  </div>
                </div>
              </div>

              <div className="-mr-2 flex items-center md:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-primary-100 hover:text-white hover:bg-primary-600 focus:outline-none"
                >
                  <i data-feather="menu" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold glow-text">My Character</h1>
            <div id="guilds" className="flex items-center space-x-4">
              <div className="flex items-center bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-2 rounded-full shadow-lg">
                <i data-feather="coins" className="mr-2 text-yellow-200" />
                <span className="font-bold text-white">
                  {profile.gold.toLocaleString()} Gold
                </span>
              </div>

              {/* Guild name*/}
              <div className="flex items-center bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 rounded-full shadow-lg">
                <i data-feather="users" className="mr-2 text-blue-200" />
                <span className="font-bold text-white">{myGuild?.name ?? "No Guild"}</span>
              </div>
            </div>
          </div>

          <div className="character-container p-8 mb-8 border border-gray-700">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Equipment slots (left) */}
              <div
                id="equipment"
                className="flex flex-col items-center lg:col-span-1"
              >
                <h2 className="text-2xl font-bold mb-4 text-yellow-300 glow-text">
                  Equipment
                </h2>
                <div className="bg-gray-800 bg-opacity-80 rounded-xl p-6 w-full border border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    {EQUIPMENT_SLOTS.map((slot) => {
                      const item = equipped[slot] ?? null;
                      return (
                        <div
                          key={slot}
                          onDragOver={handleDragOverSlot}
                          onDrop={(e) => handleDropOnSlot(e, slot)}
                          className="bg-gray-900 rounded-lg p-4 text-center border border-gray-700/70 min-h-[120px] flex flex-col items-center justify-center relative"
                        >
                          <div className="h-20 w-20 mx-auto mb-2 flex items-center justify-center">
                            {item ? (
                              <img
                                src={item.icon}
                                alt={item.name}
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            ) : (
                              <div className="text-gray-500 flex flex-col items-center justify-center text-xs">
                                <i
                                  data-feather="box"
                                  className="w-8 h-8 mb-1 opacity-60"
                                />
                                <span>Empty</span>
                              </div>
                            )}
                          </div>
                          <h3 className="font-medium mb-1">
                            {SLOT_LABELS[slot]}
                          </h3>
                          {item && (
                            <p className="text-[11px] text-gray-400">
                              {item.name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Character Appearance & Inventory */}
              <div className="flex flex-col lg:flex-row lg:col-span-2 gap-6">
                {/* Character Appearance */}
                <div className="flex-1 flex flex-col items-center">
                  <h2 className="text-2xl font-bold mb-4 text-yellow-300 glow-text">
                    Character Appearance
                  </h2>

                  <div
                    id="appear"
                    className="relative mb-6 w-full h-[640px] flex items-center justify-center"
                  >
                    <div className="relative w-full h-full">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-pink-900/30 rounded-xl animate-pulse" />
                      <div className="relative h-full flex items-center justify-center">
                        <div className="relative w-full h-full max-w-[360px] max-h-[480px] pixel-art">
                          {/* Base sprite would go here */}
                          {PREVIEW_ORDER.map((slot) => {
                            const item = equipped[slot] ?? null;
                            if (!item) return null;
                            return (
                              <img
                                key={slot}
                                src={item.icon}
                                alt={item.name}
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Level Badge */}
                    <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 level-badge px-6 py-1 rounded-full">
                      <span className="font-bold text-lg text-white">
                        Level {profile.level} Warrior
                      </span>
                    </div>

                    {/* XP Bar (game style) */}
                    <div className="absolute -bottom-34 left-1/2 transform -translate-x-1/2 w-[320px] max-w-[90vw]">
                      <div className="bg-gray-950/70 border border-blue-400/40 backdrop-blur rounded-xl px-4 py-3 shadow-lg">
                        <div className="flex justify-between text-xs mb-2 text-gray-200">
                          <span className="tracking-wide uppercase">XP</span>
                          <span className="font-semibold text-blue-200">
                            {xpProgress.current.toLocaleString()} /{" "}
                            {xpProgress.needed.toLocaleString()}
                          </span>
                        </div>

                        <div className="relative w-full h-4 rounded-full bg-gray-800 border border-gray-600 overflow-hidden">
                          <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900" />
                          <div
                            className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${xpProgress.percentage}%` }}
                          >
                            <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-white to-transparent" />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80 blur-[1px]" />
                          </div>
                        </div>

                        <div className="flex justify-between mt-2 text-[11px] text-gray-300">
                          <span>Next Level</span>
                          <span className="text-blue-200 font-semibold">
                            +{(xpProgress.needed - xpProgress.current).toLocaleString()}{" "}
                            XP needed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-0 right-0 flex space-x-2 bg-black/50 p-2 rounded-tl-xl">
                      <button className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-white transition-all hover:rotate-45">
                        <i data-feather="rotate-cw" />
                      </button>
                      <button className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-white transition-all">
                        <i data-feather="zoom-in" />
                      </button>
                      <button className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-white transition-all">
                        <i data-feather="zoom-out" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inventory Panel */}
                <div
                  id="inventory"
                  className="w-full lg:w-80 bg-gray-800 rounded-xl p-6 h-full"
                >
                  <h2 className="text-2xl font-bold mb-4 text-yellow-400">
                    Inventory
                  </h2>

                  <div className="space-y-4">
                    <div className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Equipment</h3>
                        <span className="text-xs text-gray-400">
                          {inventory.length}/10 slots
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {inventory.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            className="bg-gray-800 p-2 rounded flex flex-col items-center text-yellow-300 border border-yellow-500 cursor-grab active:cursor-grabbing"
                            title={`Drag to ${SLOT_LABELS[item.slot]} slot`}
                          >
                            <div className="w-12 h-12 mb-1 flex items-center justify-center">
                              <img
                                src={item.icon}
                                alt={item.name}
                                className="max-w-full max-h-full object-contain pointer-events-none"
                              />
                            </div>
                            <span className="text-[10px] text-center">
                              {item.name}
                            </span>
                            <span className="text-[9px] text-gray-400">
                              {SLOT_LABELS[item.slot]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Materials */}
                    <div className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Materials</h3>
                        <span className="text-xs text-gray-400">5/10 slots</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-800 p-2 rounded flex flex-col items-center text-yellow-300 border border-yellow-500">
                          <i data-feather="feather" className="text-white mb-1" />
                          <span className="text-xs">Math Feather (5)</span>
                        </div>
                        <div className="bg-gray-800 p-2 rounded flex flex-col items-center text-yellow-300 border border-yellow-500">
                          <i data-feather="star" className="text-purple-500 mb-1" />
                          <span className="text-xs">Knowledge Gem (2)</span>
                        </div>
                        <div className="bg-gray-800 p-2 rounded flex flex-col items-center text-yellow-300 border border-yellow-500">
                          <i data-feather="book" className="text-green-500 mb-1" />
                          <span className="text-xs">Ancient Page (7)</span>
                        </div>
                      </div>
                    </div>

                    {/* Quest items */}
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Quest Items</h3>
                        <span className="text-xs text-gray-400">1/5 slots</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-800 p-2 rounded flex flex-col items-center text-yellow-300 border border-yellow-500">
                          <i data-feather="map" className="text-red-500 mb-1" />
                          <span className="text-xs">Algebra Map</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hearts & tabs section*/}
            <div className="bg-gray-800 bg-opacity-80 rounded-lg p-6 mt-6 ">
              <div className="w-full max-w-6xl mx-auto px-4">
                {/* Quick Hearts Display */}
                <div className="flex items-center justify-center gap-2 mb-6 p-4 ">
                  <span className="text-xl font-bold text-red-500">Hearts available:</span>
                  <div className="flex gap-1">
                    {[...Array(profile.maxHearts)].map((_, i) => (
                      <span key={i}>
                        {i < profile.hearts ? (
                          <HeartSolid className="w-5 h-5 text-red-500" />
                        ) : (
                          <HeartOutline className="w-5 h-5 text-gray-600" />
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-lg text-red-300 font-bold ml-0.1">
                    {profile.hearts} / {profile.maxHearts}
                  </span>
                </div>

                {/* --- TABS HEADER --- */}
                <div className="mt-8 mb-6 flex flex-wrap gap-3 items-center justify-between">
                  <div id="footer" className="flex flex-wrap gap-3">
                    <TabButton value="quests" label="Active Quests" icon="flag" />
                    <TabButton value="rewards" label="Rewards" icon="gift" />
                    <TabButton value="hearts" label="Hearts" icon="heart" />
                  </div>

                  <div className="text-sm text-gray-300 flex items-center gap-2">
                    <i data-feather="trending-up" className="w-4 h-4" />
                    <span>
                      Level{" "}
                      <span className="text-yellow-300 font-bold">
                        {profile.level}
                      </span>{" "}
                      • {xpProgress.current.toLocaleString()}/
                      {xpProgress.needed.toLocaleString()} XP to next level
                    </span>
                  </div>
                </div>

                {/* --- TAB CONTENT --- */}
                {tab === "quests" && !showAllQuests && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-yellow-400">
                        Active Quests
                      </h2>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                          Complete quests to boost your stats
                        </span>
                        <button
                          onClick={() => setShowAllQuests(true)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-full text-xs font-bold transition"
                        >
                          View More
                        </button>
                      </div>
                    </div>

                    {questsLoading ? (
                      <div className="opacity-80">Loading quests…</div>
                    ) : questsError ? (
                      <div className="text-red-300">{questsError}</div>
                    ) : quests.length === 0 ? (
                      <div className="opacity-80">
                        No active quests for your class yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quests.slice(0, 2).map((quest) => {
                          const colors = SUBJECT_COLORS[quest.subjectKey];
                          const progressPercentage =
                            (quest.completed / quest.total) * 100;

                          return (
                            <div
                              key={quest.id}
                              className={`bg-gradient-to-r ${colors.gradient} p-4 rounded-lg border-2 border-yellow-400 shadow-lg`}
                            >
                              <h3 className="font-bold text-white">
                                {quest.title}
                              </h3>
                              <p className={`${colors.text} text-sm mb-3`}>
                                {quest.description}
                              </p>

                              <div className="flex items-center mb-2">
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`${colors.bar} h-2 rounded-full`}
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                                <span className="ml-2 text-xs text-white">
                                  {quest.completed}/{quest.total}
                                </span>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-yellow-300 text-sm">
                                  {quest.rewardText ||
                                    (quest.dueDate ? `Due: ${quest.dueDate}` : "")}
                                </span>

                                <Link
                                  to={`/problemsolve?quest_instance_id=${encodeURIComponent(
                                    quest.id
                                  )}`}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold"
                                >
                                  {quest.action}
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {tab === "quests" && showAllQuests && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-yellow-400">
                        All Quests
                      </h2>
                      <button
                        onClick={() => setShowAllQuests(false)}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full text-xs font-bold transition"
                      >
                        Back
                      </button>
                    </div>

                    {questsLoading ? (
                      <div className="opacity-80">Loading quests…</div>
                    ) : questsError ? (
                      <div className="text-red-300">{questsError}</div>
                    ) : quests.length === 0 ? (
                      <div className="opacity-80">
                        No active quests for your class yet.
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {(Object.keys(SUBJECT_COLORS) as SubjectKey[]).map(
                          (subjectKey) => {
                            const colors = SUBJECT_COLORS[subjectKey];
                            const subjectQuests = questsBySubject[subjectKey];
                            if (!subjectQuests || subjectQuests.length === 0)
                              return null;

                            return (
                              <div key={subjectKey}>
                                <h3 className="text-xl font-bold mb-4 text-yellow-300">
                                  {colors.label} Quests
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {subjectQuests.map((quest) => {
                                    const progressPercentage =
                                      (quest.completed / quest.total) * 100;

                                    return (
                                      <div
                                        key={quest.id}
                                        className={`bg-gradient-to-r ${colors.gradient} p-4 rounded-lg border-2 border-yellow-400 shadow-lg hover:shadow-xl transition-shadow`}
                                      >
                                        <h4 className="font-bold text-white mb-2">
                                          {quest.title}
                                        </h4>
                                        <p className={`${colors.text} text-xs mb-3`}>
                                          {quest.description}
                                        </p>

                                        <div className="flex items-center mb-3">
                                          <div className="w-full bg-gray-700 rounded-full h-2">
                                            <div
                                              className={`${colors.bar} h-2 rounded-full`}
                                              style={{
                                                width: `${progressPercentage}%`,
                                              }}
                                            />
                                          </div>
                                          <span className="ml-2 text-xs text-white font-semibold">
                                            {quest.completed}/{quest.total}
                                          </span>
                                        </div>

                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-yellow-300 font-medium">
                                            {quest.rewardText ||
                                              (quest.dueDate
                                                ? `Due: ${quest.dueDate}`
                                                : "")}
                                          </span>

                                          <Link
                                            to={`/problemsolve?quest_instance_id=${encodeURIComponent(
                                              quest.id
                                            )}`}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded-full font-bold"
                                          >
                                            Start
                                          </Link>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </>
                )}

                {tab === "subjects" && (
                  <>
                    <h2 className="text-2xl font-bold mb-4 text-yellow-400">
                      My Subjects
                    </h2>

                    {/* keep as-is for now; later we can derive subjects from templates/quests */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                        <h3 className="font-bold text-white">Mathematics</h3>
                        <p className="text-blue-100 text-sm mb-3">
                          Algebra &amp; Geometry
                        </p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-400 h-2 rounded-full"
                              style={{ width: "65%" }}
                            />
                          </div>
                          <span className="ml-2 text-xs text-white">65%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-300 text-sm">Level 5</span>
                          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                            View
                          </button>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-600 to-green-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                        <h3 className="font-bold text-white">Science</h3>
                        <p className="text-green-100 text-sm mb-3">
                          Chemistry &amp; Physics
                        </p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-400 h-2 rounded-full"
                              style={{ width: "45%" }}
                            />
                          </div>
                          <span className="ml-2 text-xs text-white">45%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-300 text-sm">Level 3</span>
                          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                            View
                          </button>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                        <h3 className="font-bold text-white">History</h3>
                        <p className="text-red-100 text-sm mb-3">
                          World History
                        </p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-red-400 h-2 rounded-full"
                              style={{ width: "30%" }}
                            />
                          </div>
                          <span className="ml-2 text-xs text-white">30%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-300 text-sm">Level 2</span>
                          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {tab === "hearts" && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-red-400">
                        Hearts
                      </h2>
                      <div className="text-sm text-gray-300">
                        Use hearts to attempt quests & boss battles. Each failure costs a heart.
                      </div>
                    </div>

                    {/* Hearts display */}
                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-8 mb-8 text-center">
                      <div className="text-6xl mb-4">
                        {[...Array(profile.maxHearts)].map((_, i) => (
                          <span key={i} className="inline-block mx-2">
                            {i < profile.hearts ? (
                              <i data-feather="heart" className="w-12 h-12 text-red-500 fill-red-500 inline" />
                            ) : (
                              <i data-feather="heart" className="w-12 h-12 text-gray-600 inline" />
                            )}
                          </span>
                        ))}
                      </div>
                      <div className="text-3xl font-bold text-red-300 mt-4">
                        {profile.hearts} / {profile.maxHearts} Hearts
                      </div>
                      
                      {/* Regeneration info */}
                      <div className="mt-6 space-y-3">
                        {profile.lastHeartRegenAt && profile.hearts < profile.maxHearts && (
                          <p className="text-yellow-300 text-sm">
                            ⏱️ Next regen: <span className="font-semibold">~{Math.ceil((3* 60 * 60 * 1000 - (Date.now() - profile.lastHeartRegenAt)) / (60 * 1000))} minutes</span>
                          </p>
                        )}
                        <p className="text-blue-300 text-sm">
                          📅 <span className="font-semibold">Weekend reset:</span> Full hearts every Saturday at midnight
                        </p>
                      </div>
                    </div>

                    {/* Hearts tips */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-r from-red-600/20 to-red-800/20 border border-red-600/50 rounded-lg p-4">
                        <h3 className="font-bold text-red-300 mb-2">How Hearts Work</h3>
                        <ul className="text-sm text-gray-300 space-y-2">
                          <li>• Lose a heart when you get a question wrong</li>
                          <li>• 💚 Hearts regenerate every 3 hours</li>
                        </ul>
                      </div>

                      <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-800/20 border border-yellow-600/50 rounded-lg p-4">
                        <h3 className="font-bold text-yellow-300 mb-2">Perfect Attempt Bonus</h3>
                        <ul className="text-sm text-gray-300 space-y-2">
                          <li>✨ Complete a quest without losing any hearts</li>
                          <li>✨ Increase your leaderboard score</li>
                          
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {tab === "rewards" && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-bold text-yellow-400">
                        Rewards
                      </h2>
                      <span className="text-sm text-gray-400">
                        Unlock classroom rewards at levels 5, 10, 15...
                      </span>
                    </div>

                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold">
                          Current Level:{" "}
                          <span className="text-yellow-300">{profile.level}</span>
                        </div>
                        <div className="text-sm text-gray-300">
                          XP: {profile.totalXP.toLocaleString()} • Next level in{" "}
                          {(xpProgress.needed - xpProgress.current).toLocaleString()}{" "}
                          XP
                        </div>
                      </div>

                      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-yellow-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${milestoneProgress.percentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-xs text-gray-300 mt-2">
                        <span>Level 1</span>
                        <span>Level 30</span>
                      </div>

                      <div className="relative mt-4">
                        <div className="flex justify-between">
                          {rewards.map((m: any) => (
                            <div
                              key={m.level}
                              className="flex flex-col items-center w-full"
                            >
                              <div
                                className={`w-3 h-3 rounded-full border ${
                                  m.unlocked
                                    ? "bg-yellow-500 border-yellow-300"
                                    : "bg-gray-600 border-gray-500"
                                }`}
                                title={`Level ${m.level}`}
                              />
                              <div className="mt-2 text-[11px] text-center text-gray-200">
                                <span
                                  className={`${
                                    m.unlocked ? "text-yellow-300 font-bold" : ""
                                  }`}
                                >
                                  L{m.level}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rewards.map((r: any) => (
                        <div
                          key={r.level}
                          className={`rounded-lg p-4 border-2 shadow-lg ${
                            r.unlocked
                              ? "bg-gradient-to-r from-yellow-600 to-yellow-500 border-yellow-300 text-black"
                              : "bg-gray-900 border-gray-700 text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{r.title}</div>
                            <div
                              className={`text-xs font-bold px-3 py-1 rounded-full ${
                                r.unlocked ? "bg-black/20" : "bg-gray-700"
                              }`}
                            >
                              Level {r.level}
                            </div>
                          </div>

                          {r.description && (
                            <p
                              className={`mt-2 text-sm ${
                                r.unlocked ? "text-black/80" : "text-gray-300"
                              }`}
                            >
                              {r.description}
                            </p>
                          )}

                          <div className="mt-4 flex justify-between items-center">
                            <span
                              className={`text-xs ${
                                r.unlocked ? "text-black/70" : "text-gray-400"
                              }`}
                            >
                              {r.purchased
                                ? "Purchased"
                                : r.unlocked
                                ? `${r.cost} gold`
                                : "Locked"}
                            </span>

                            <button
                              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                r.unlocked && !r.purchased
                                  ? "bg-black text-yellow-300 hover:opacity-90 cursor-pointer"
                                  : r.purchased
                                  ? "bg-green-700 text-white cursor-default"
                                  : "bg-gray-700 text-gray-300 cursor-not-allowed"
                              }`}
                              disabled={!r.unlocked || r.purchased}
                              onClick={() => {
                                if (
                                  r.unlocked &&
                                  !r.purchased &&
                                  profile.gold >= r.cost
                                ) {
                                  purchaseReward(r.level).catch((err: any) =>
                                    console.error("Purchase failed:", err)
                                  );
                                }
                              }}
                            >
                              {r.purchased
                                ? "Owned"
                                : r.unlocked
                                ? "Purchase"
                                : "Reach Level"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </TutorialProvider>
    </div>
  );
};

export default CharacterPage;
