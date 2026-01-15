import React, { useEffect, useRef, useState, useMemo } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import "../../styles/character.css";

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
type TabKey = "quests" | "subjects" | "rewards";

type RewardMilestone = {
  level: number; // increments of 5
  title: string;
  description?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

  // Rewards demo data (teacher decided later)
  const rewardMilestones: RewardMilestone[] = useMemo(
    () => [
      { level: 5, title: "Music Time", description: "Pick a class playlist (5 min)" },
      { level: 10, title: "Phone Time", description: "Phone break (5 min)" },
      { level: 15, title: "Seat Choice", description: "Choose your seat for the day" },
      { level: 20, title: "Partner Pick", description: "Choose your partner once" },
      { level: 25, title: "Snack Pass", description: "Snack during independent work" },
      { level: 30, title: "Game Time", description: "Quick classroom game (10 min)" },
    ],
    []
  );

  // Simple XP system (you can wire this to your backend later)
  const xpPerLevel = 200; // change if you want slower/faster leveling
  const currentXp = 1245; // demo value
  const currentLevel = Math.floor(currentXp / xpPerLevel) + 1;
  const xpIntoLevel = currentXp % xpPerLevel;
  const progressPct = clamp((xpIntoLevel / xpPerLevel) * 100, 0, 100);

  // How far along the "milestone road" the student is (0..1)
  const lastMilestone = rewardMilestones[rewardMilestones.length - 1]?.level ?? 5;
  const milestoneProgressPct = clamp((currentLevel / lastMilestone) * 100, 0, 100);

  useEffect(() => {
    feather.replace();
  }, [isUserMenuOpen, inventory, equipped, tab]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
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
                  {/* Gold Bar Image */}
                  <img
                    src="/assets/icons/gold-bar.png"
                    alt="Gold"
                    className="h-5 w-5 mr-1"
                  />

                  {/* Amount */}
                  <span className="text-white font-medium">1,245</span>
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
                      src="http://static.photos/people/200x200/8"
                      alt="User avatar"
                    />
                    <span className="ml-2 text-sm font-medium">Alex</span>
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
                    to="/"
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
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-gradient-to-r from-yellow-600 to-yellow-500 px-4 py-2 rounded-full shadow-lg">
              <i data-feather="coins" className="mr-2 text-yellow-200" />
              <span className="font-bold text-white">1,245 Gold</span>
            </div>
            <div className="flex items-center bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 rounded-full shadow-lg">
              <i data-feather="users" className="mr-2 text-blue-200" />
              <span className="font-bold text-white">Math Warriors</span>
            </div>
          </div>
        </div>

        <div className="character-container p-8 mb-8 border border-gray-700">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Equipment slots (left) */}
            <div className="flex flex-col items-center lg:col-span-1">
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
                        <h3 className="font-medium mb-1">{SLOT_LABELS[slot]}</h3>
                        {item && (
                          <p className="text-[11px] text-gray-400">{item.name}</p>
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
                <div className="relative mb-6 w-full h-[640px] flex items-center justify-center">
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
                    <span className="font-bold text-lg text-white">Level 5 Warrior</span>
                  </div>

                  {/* XP Bar (game style) */}
                  <div className="absolute -bottom-34 left-1/2 transform -translate-x-1/2 w-[320px] max-w-[90vw]">
                    <div className="bg-gray-950/70 border border-blue-400/40 backdrop-blur rounded-xl px-4 py-3 shadow-lg">
                      <div className="flex justify-between text-xs mb-2 text-gray-200">
                        <span className="tracking-wide uppercase">XP</span>
                        <span className="font-semibold text-blue-200">1,245 / 2,000</span>
                      </div>

                      {/* Outer bar frame */}
                      <div className="relative w-full h-4 rounded-full bg-gray-800 border border-gray-600 overflow-hidden">
                        {/* Subtle “track” glow */}
                        <div className="absolute inset-0 opacity-40 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900" />

                        {/* Filled progress */}
                        <div
                          className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500"
                          style={{ width: "62%" }}
                        >
                          {/* Shine highlight */}
                          <div className="absolute inset-0 opacity-30 bg-gradient-to-b from-white to-transparent" />

                          {/* Little moving sparkle (optional but looks game-y) */}
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80 blur-[1px]" />
                        </div>
                      </div>

                      <div className="flex justify-between mt-2 text-[11px] text-gray-300">
                        <span>Next Level</span>
                        <span className="text-blue-200 font-semibold">+755 XP needed</span>
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
              <div className="w-full lg:w-80 bg-gray-800 rounded-xl p-6 h-full">
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

          {/* Stats + Skills + Tabs section */}
          <div className="bg-gray-800 bg-opacity-80 rounded-lg p-6 mt-6">
            <div className="w-full max-w-6xl mx-auto px-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Stats */}
                <div className="bg-gray-800 bg-opacity-80 rounded-xl p-6 w-full">
                  <h3 className="text-xl font-bold text-center mb-4">
                    Alex the Brave
                  </h3>
                  <div className="flex justify-center space-x-4 mb-6">
                    <span className="text-yellow-400">Warrior</span>
                    <span>|</span>
                    <span>Grade 8</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Strength</span>
                        <span>85/100</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-red-500 h-2.5 rounded-full" style={{ width: "85%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Intelligence</span>
                        <span>72/100</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: "72%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">HP</span>
                        <span>75/100</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: "75%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">Speed</span>
                        <span>78/100</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: "78%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="bg-gray-800 bg-opacity-80 rounded-xl p-6 w-full">
                  <h2 className="text-2xl font-bold mb-6 text-yellow-400 text-center">
                    Warrior Skills
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <div className="bg-red-600 rounded-full p-2 mr-3">
                          <i data-feather="zap" className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium">Equation Smash</h4>
                          <p className="text-sm text-gray-400">Level 3</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: "60%" }} />
                      </div>
                    </div>

                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <div className="bg-blue-600 rounded-full p-2 mr-3">
                          <i data-feather="shield" className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium">Math Guard</h4>
                          <p className="text-sm text-gray-400">Level 2</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: "30%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- TABS HEADER --- */}
              <div className="mt-8 mb-6 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-3">
                  <TabButton value="quests" label="Active Quests" icon="flag" />
                  <TabButton value="subjects" label="My Subjects" icon="grid" />
                  <TabButton value="rewards" label="Rewards" icon="gift" />
                </div>

                {/* Small current level indicator on the right */}
                <div className="text-sm text-gray-300 flex items-center gap-2">
                  <i data-feather="trending-up" className="w-4 h-4" />
                  <span>
                    Level <span className="text-yellow-300 font-bold">{currentLevel}</span>{" "}
                    • {xpIntoLevel}/{xpPerLevel} XP to next level
                  </span>
                </div>
              </div>

              {/* --- TAB CONTENT --- */}
              {tab === "quests" && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-yellow-400">
                      Active Quests
                    </h2>
                    <span className="text-sm text-gray-400">
                      Complete quests to boost your stats
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                      <h3 className="font-bold text-white">Algebraic Equations</h3>
                      <p className="text-blue-100 text-sm mb-3">
                        Complete 5 questions to boost Intelligence
                      </p>
                      <div className="flex items-center mb-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-blue-400 h-2 rounded-full" style={{ width: "0%" }} />
                        </div>
                        <span className="ml-2 text-xs text-white">0/5</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-yellow-300 text-sm">+15 Int</span>
                        <Link
                          to="/problemsolve"
                          className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold"
                        >
                          Continue
                        </Link>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                      <h3 className="font-bold text-white">History Research</h3>
                      <p className="text-red-100 text-sm mb-3">
                        Read 5 chapters to boost Wisdom
                      </p>
                      <div className="flex items-center mb-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-red-400 h-2 rounded-full" style={{ width: "80%" }} />
                        </div>
                        <span className="ml-2 text-xs text-white">4/5</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-yellow-300 text-sm">+10 Wis</span>
                        <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                          Continue
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {tab === "subjects" && (
                <>
                  <h2 className="text-2xl font-bold mb-4 text-yellow-400">
                    My Subjects
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 rounded-lg border-2 border-yellow-400 shadow-lg">
                      <h3 className="font-bold text-white">Mathematics</h3>
                      <p className="text-blue-100 text-sm mb-3">
                        Algebra &amp; Geometry
                      </p>
                      <div className="flex items-center mb-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-blue-400 h-2 rounded-full" style={{ width: "65%" }} />
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
                          <div className="bg-green-400 h-2 rounded-full" style={{ width: "45%" }} />
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
                      <p className="text-red-100 text-sm mb-3">World History</p>
                      <div className="flex items-center mb-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div className="bg-red-400 h-2 rounded-full" style={{ width: "30%" }} />
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

              {tab === "rewards" && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-yellow-400">Rewards</h2>
                    <span className="text-sm text-gray-400">
                      Unlock classroom rewards at levels 5, 10, 15...
                    </span>
                  </div>

                  {/* Long "experience road" bar */}
                  <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold">
                        Current Level:{" "}
                        <span className="text-yellow-300">{currentLevel}</span>
                      </div>
                      <div className="text-sm text-gray-300">
                        XP: {currentXp} • Next level in{" "}
                        {xpPerLevel - xpIntoLevel} XP
                      </div>
                    </div>

                    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-yellow-500 h-4 rounded-full"
                        style={{ width: `${milestoneProgressPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-gray-300 mt-2">
                      <span>Level 1</span>
                      <span>Level {lastMilestone}</span>
                    </div>

                    {/* Milestone markers */}
                    <div className="relative mt-4">
                      <div className="flex justify-between">
                        {rewardMilestones.map((m) => {
                          const unlocked = currentLevel >= m.level;
                          return (
                            <div key={m.level} className="flex flex-col items-center w-full">
                              <div
                                className={`w-3 h-3 rounded-full border ${
                                  unlocked
                                    ? "bg-yellow-500 border-yellow-300"
                                    : "bg-gray-600 border-gray-500"
                                }`}
                                title={`Level ${m.level}`}
                              />
                              <div className="mt-2 text-[11px] text-center text-gray-200">
                                <span className={`${unlocked ? "text-yellow-300 font-bold" : ""}`}>
                                  L{m.level}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Reward list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rewardMilestones.map((r) => {
                      const unlocked = currentLevel >= r.level;
                      return (
                        <div
                          key={r.level}
                          className={`rounded-lg p-4 border-2 shadow-lg ${
                            unlocked
                              ? "bg-gradient-to-r from-yellow-600 to-yellow-500 border-yellow-300 text-black"
                              : "bg-gray-900 border-gray-700 text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">
                              {r.title}
                            </div>
                            <div
                              className={`text-xs font-bold px-3 py-1 rounded-full ${
                                unlocked ? "bg-black/20" : "bg-gray-700"
                              }`}
                            >
                              Level {r.level}
                            </div>
                          </div>

                          {r.description && (
                            <p className={`mt-2 text-sm ${unlocked ? "text-black/80" : "text-gray-300"}`}>
                              {r.description}
                            </p>
                          )}

                          <div className="mt-4 flex justify-between items-center">
                            <span className={`text-xs ${unlocked ? "text-black/70" : "text-gray-400"}`}>
                              {unlocked ? "Unlocked" : "Locked"}
                            </span>
                            <button
                              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                unlocked
                                  ? "bg-black text-yellow-300 hover:opacity-90"
                                  : "bg-gray-700 text-gray-300 cursor-not-allowed"
                              }`}
                              disabled={!unlocked}
                            >
                              {unlocked ? "Claim" : "Reach Level"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterPage;