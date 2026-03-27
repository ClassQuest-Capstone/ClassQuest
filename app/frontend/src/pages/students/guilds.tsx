import React, { useEffect, useMemo, useRef, useState } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

import { getGuild as apiGetGuild, type Guild } from "../../api/guilds.js";

import {
  getGuildMembership,
  listGuildMembers,
  type GuildMembership,
} from "../../api/guildMemberships.js";
import { listEquippedItemsByClass } from "../../api/equippedItems/client.js";
import type { EquippedItems as EquippedItemsRecord } from "../../api/equippedItems/types.js";
import { listPlayerAvatarsByClass } from "../../api/playerAvatars/client.js";
import type { PlayerAvatar } from "../../api/playerAvatars/types.js";
import { listShopItems } from "../../api/shopItems/client.js";
import type { ShopItem } from "../../api/shopItems/types.js";
import { listRewardMilestonesByClass } from "../../api/rewardMilestones/client.js";
import { getAssetUrl } from "../../api/imageUpload/assetUrl.js";

// pull classId from enrollments if missing
import {
  getStudentEnrollments,
  type EnrollmentItem,
} from "../../api/classEnrollments.js";

// class type (NO getClass export in your file)
import type { ClassItem } from "../../api/classes.js";

// display names
import { getStudentProfile } from "../../api/studentProfiles.js";
import { getPlayerState } from "../../api/playerStates.js";

// your shared http client (so we can fetch class by id safely)
import { api } from "../../api/http.js";
import { StudentNavDropdown } from "./StudentNavDropdown.js";

// Boss battle imports
import { listBossBattleInstancesByClass } from "../../api/bossBattleInstances/client.js";
import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

// --------------------
// Student helper
// --------------------
type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed;
  } catch {
    // ignore
  }
  return null;
}

// --------------------
// Gradient by subject
// --------------------
function getGradientBySubject(subject?: string): string {
  if (!subject) return "from-yellow-400 to-yellow-600";
  
  const normalized = subject.toLowerCase().trim();
  
  if (normalized === "math") {
    return "from-blue-500 to-purple-500";
  } else if (normalized === "science") {
    return "from-emerald-400 to-cyan-500";
  } else if (normalized === "social studies") {
    return "from-orange-400 to-red-500";
  } else {
    return "from-yellow-400 to-yellow-600";
  }
}

function getStatusColor(status?: string): string {
  const stat = status?.toLowerCase() ?? "";
  
  if (stat === "completed") return "bg-green-500";
  if (stat === "lobby" || stat === "countdown") return "bg-blue-500";
  if (stat === "question_active" || stat === "resolving") return "bg-purple-500";
  if (stat === "aborted") return "bg-red-500";
  
  return "bg-yellow-500"; // draft, intermission, etc
}


const GuildPage: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;

  // --------------------
  // Resolve classId
  // --------------------
  const [classId, setClassId] = useState<string | null>(null);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError] = useState<string | null>(null);

  // --------------------
  // Resolve class name (show name instead of id)
  // --------------------
  const [classInfo, setClassInfo] = useState<ClassItem | null>(null);
  const [classInfoLoading, setClassInfoLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveClassId() {
      setClassLoading(true);
      setClassError(null);

      // 1) student object
      if (student?.classId) {
        if (!cancelled) {
          setClassId(student.classId);
          setClassLoading(false);
        }
        return;
      }

      // 2) localStorage
      const stored = localStorage.getItem("cq_currentClassId");
      if (stored) {
        if (!cancelled) {
          setClassId(stored);
          setClassLoading(false);
        }
        return;
      }

      // 3) fetch enrollments
      if (!studentId) {
        if (!cancelled) {
          setClassId(null);
          setClassError("Missing studentId (not logged in as student).");
          setClassLoading(false);
        }
        return;
      }

      try {
        const res = await getStudentEnrollments(studentId);
        const items: EnrollmentItem[] = res?.items ?? [];

        const active = items.filter((e) => e.status === "active");
        if (active.length === 0) {
          if (!cancelled) {
            setClassId(null);
            setClassError("No active class enrollment found for this student.");
          }
          return;
        }

        // choose most recent active enrollment
        active.sort(
          (a, b) =>
            new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
        );
        const cid = active[0].class_id;

        if (!cancelled) {
          setClassId(cid);
          localStorage.setItem("cq_currentClassId", cid);
        }
      } catch (e: any) {
        if (!cancelled) {
          setClassId(null);
          setClassError(e?.message ?? "Failed to load class enrollment.");
        }
      } finally {
        if (!cancelled) setClassLoading(false);
      }
    }

    resolveClassId();
    return () => {
      cancelled = true;
    };
  }, [student?.classId, studentId]);

  // fetch class details (name) via api directly (no getClass import)
  useEffect(() => {
    if (!classId) {
      setClassInfo(null);
      return;
    }

    let cancelled = false;

    async function loadClassInfo() {
      try {
        setClassInfoLoading(true);

        // assumes your backend supports GET /classes/:id
        const cls = await api<ClassItem>(`/classes/${encodeURIComponent(classId)}`);

        if (!cancelled) setClassInfo(cls);
      } catch {
        // if endpoint doesn’t exist yet, fail gracefully (no white screen)
        if (!cancelled) setClassInfo(null);
      } finally {
        if (!cancelled) setClassInfoLoading(false);
      }
    }

    loadClassInfo();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  // Keep icons updated
  useEffect(() => {
    feather.replace();
  }, []);

  const { profile } = usePlayerProgression(
    studentId || "",
    classId || ""
  );

  const pageBg =
    "min-h-screen bg-cover bg-fixed bg-no-repeat bg-gray-900";

  const pageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/background/guilds-bg.png')",
    backgroundPosition: "center top",
  };

  // --------------------
  // Membership + Guild state
  // --------------------
  const [membership, setMembership] = useState<GuildMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const myGuildId = membership?.is_active ? membership.guild_id : null;

  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [myGuildLoading, setMyGuildLoading] = useState(false);
  const [myGuildError, setMyGuildError] = useState<string | null>(null);

  // --------------------
  // Roster state
  // --------------------
  const [roster, setRoster] = useState<GuildMembership[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // --------------------
  // Boss Battles state
  // --------------------
  const [bossBattles, setBossBattles] = useState<(BossBattleInstance & { template?: BossBattleTemplate })[]>([]);
  const [bossBattlesLoading, setBossBattlesLoading] = useState(false);
  const [bossBattlesError, setBossBattlesError] = useState<string | null>(null);

  // Hearts cache per student
  const [heartsByStudentId, setHeartsByStudentId] = useState<Record<string, number | null>>({});

  // Character visual data
  const [allEquippedItems, setAllEquippedItems] = useState<EquippedItemsRecord[]>([]);
  const [playerAvatarMap, setPlayerAvatarMap] = useState<Map<string, PlayerAvatar>>(new Map());
  const [shopItemMap, setShopItemMap] = useState<Map<string, ShopItem>>(new Map());
  const [rewardImageMap, setRewardImageMap] = useState<Map<string, string>>(new Map());
  const [targetIdImageMap, setTargetIdImageMap] = useState<Map<string, string>>(new Map());

  // Name cache
  const [nameByStudentId, setNameByStudentId] = useState<Record<string, string>>(
    {}
  );
  const nameCacheRef = useRef<Record<string, string>>({});
  useEffect(() => {
    nameCacheRef.current = nameByStudentId;
  }, [nameByStudentId]);

  useEffect(() => {
    const myName = student?.displayName?.trim();
    if (studentId && myName) {
      setNameByStudentId((prev) =>
        prev[studentId] ? prev : { ...prev, [studentId]: myName }
      );
    }
  }, [studentId, student?.displayName]);

  async function hydrateNames(studentIds: string[]) {
    const unique = Array.from(new Set(studentIds)).filter(Boolean);
    const missing = unique.filter((id) => !nameCacheRef.current[id]);
    if (missing.length === 0) return;

    // Mark as in-progress immediately to prevent duplicate fetches
    for (const id of missing) nameCacheRef.current[id] = "";

    // Fetch in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    const updates: Record<string, string> = {};
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (sid) => {
          try {
            const prof: any = await getStudentProfile(sid);
            const name = String(prof?.display_name ?? "").trim();
            return { sid, name: name || "Unknown Student" };
          } catch {
            // Clear the in-progress marker so it can be retried
            delete nameCacheRef.current[sid];
            return { sid, name: "Unknown Student" };
          }
        })
      );
      for (const r of results) updates[r.sid] = r.name;
    }

    setNameByStudentId((prev) => ({ ...prev, ...updates }));
  }

  // --------------------
  // Loaders
  // --------------------
  async function refreshMembership() {
    if (!classId || !studentId) {
      setMembership(null);
      setMembershipLoading(false);
      setMembershipError(
        !studentId
          ? "Missing studentId (not logged in as student)."
          : "Missing classId (no current class selected)."
      );
      return;
    }

    try {
      setMembershipLoading(true);
      setMembershipError(null);

      const m = await getGuildMembership(classId, studentId);
      setMembership(m);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (String(msg).includes("404")) {
        setMembership(null);
      } else {
        setMembershipError(msg || "Failed to load membership.");
        setMembership(null);
      }
    } finally {
      setMembershipLoading(false);
    }
  }

  async function refreshMyGuild(guildId: string) {
    try {
      setMyGuildLoading(true);
      setMyGuildError(null);
      const g = await apiGetGuild(guildId);
      setMyGuild(g);
    } catch (e: any) {
      setMyGuildError(e?.message ?? "Failed to load your guild.");
      setMyGuild(null);
    } finally {
      setMyGuildLoading(false);
    }
  }

  async function refreshRoster(guildId: string) {
    try {
      setRosterLoading(true);
      setRosterError(null);

      const res = await listGuildMembers(guildId, 50);
      const active = (res.items ?? []).filter((m) => m.is_active !== false);
      setRoster(active);

      hydrateNames(active.map((m) => m.student_id));

      // Load hearts for each member
      if (classId) {
        const heartEntries = await Promise.all(
          active.map(async (m) => {
            try {
              const ps = await getPlayerState(classId, m.student_id);
              return { sid: m.student_id, hearts: ps.hearts };
            } catch {
              return { sid: m.student_id, hearts: null };
            }
          })
        );
        const heartsMap: Record<string, number | null> = {};
        for (const e of heartEntries) heartsMap[e.sid] = e.hearts;
        setHeartsByStudentId(heartsMap);
      }
    } catch (e: any) {
      setRosterError(e?.message ?? "Failed to load guild members.");
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }

  async function refreshBossBattles(classIdParam: string) {
    try {
      setBossBattlesLoading(true);
      setBossBattlesError(null);

      const res = await listBossBattleInstancesByClass(classIdParam, { limit: 20 });
      const instances = res.items ?? [];

      // Fetch templates for each instance and merge data
      const withTemplates = await Promise.all(
        instances.map(async (instance) => {
          try {
            const template = await getBossBattleTemplate(instance.boss_template_id);
            return { ...instance, template };
          } catch {
            // If template fetch fails, just return instance without template
            return instance;
          }
        })
      );

      // Sort by most recent and filter to active/upcoming battles
      withTemplates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBossBattles(withTemplates);
    } catch (e: any) {
      setBossBattlesError(e?.message ?? "Failed to load boss battles.");
      setBossBattles([]);
    } finally {
      setBossBattlesLoading(false);
    }
  }

  useEffect(() => {
    if (classLoading) return;
    refreshMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLoading, classId, studentId]);

  useEffect(() => {
    if (myGuildId) {
      refreshMyGuild(myGuildId);
      refreshRoster(myGuildId);
    } else {
      setMyGuild(null);
      setMyGuildError(null);
      setRoster([]);
      setRosterError(null);
    }
  }, [myGuildId]);

  // Fetch boss battles when classId changes
  useEffect(() => {
    if (!classId || classLoading) return;
    refreshBossBattles(classId);
  }, [classId, classLoading]);

  // Batch-fetch character visual data once per class
  useEffect(() => {
    if (!classId) return;
    Promise.allSettled([
      listEquippedItemsByClass(classId, { limit: 100 }),
      listShopItems({ limit: 200 }),
      listRewardMilestonesByClass(classId),
      listPlayerAvatarsByClass(classId, { limit: 100 }),
    ]).then(([equippedResult, shopResult, rewardsResult, playerAvatarsResult]) => {
      if (equippedResult.status === "fulfilled") {
        setAllEquippedItems((equippedResult.value as any).items ?? []);
      }
      if (shopResult.status === "fulfilled") {
        setShopItemMap(new Map(
          ((shopResult.value as any).items ?? []).map((s: ShopItem) => [s.item_id, s])
        ));
      }
      if (rewardsResult.status === "fulfilled") {
        const rewards: any[] = (rewardsResult.value as any) ?? [];
        const rMap = new Map<string, string>();
        const tMap = new Map<string, string>();
        for (const r of rewards) {
          if (r.reward_id && r.image_asset_key) rMap.set(r.reward_id, r.image_asset_key);
          if (r.reward_target_id && r.image_asset_key) tMap.set(r.reward_target_id, r.image_asset_key);
        }
        setRewardImageMap(rMap);
        setTargetIdImageMap(tMap);
      }
      if (playerAvatarsResult.status === "fulfilled") {
        const avatars: PlayerAvatar[] = (playerAvatarsResult.value as any).items ?? [];
        setPlayerAvatarMap(new Map(avatars.map((a) => [a.student_id, a])));
      }
    });
  }, [classId]);

  useEffect(() => {
    feather.replace();
  }, [myGuild, roster, membershipLoading, rosterLoading, bossBattles]);

  const classLabel = classInfoLoading
    ? "Loading..."
    : classInfo?.name ?? "—";

  return (
    <div className={pageBg} style={pageStyle}>
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
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Character
              </Link>

              <Link
                to="/guilds"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Guilds
              </Link>

              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Leaderboard
              </Link>
              <Link
                to="/shop"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Shop
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

              <StudentNavDropdown displayName={student?.displayName ?? "Student"} />
            </div>

            <div className="-mr-2 flex items-center md:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600 focus:outline-none"
              >
                <i data-feather="menu" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Guild</h1>
            <p className="text-gray-200">Your assigned guild and members.</p>
            <p className="text-xs text-gray-300 mt-1">
              Class: <span className="font-semibold">{classLabel}</span>
            </p>
          </div>

          <button
            onClick={() => {
              refreshMembership();
              if (myGuildId) {
                refreshMyGuild(myGuildId);
                refreshRoster(myGuildId);
              }
            }}
            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 border border-white/30 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {classError && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="alert-triangle" className="w-5 h-5" />
              <span className="font-semibold">Error:</span>
              <span>{classError}</span>
            </div>
          </div>
        )}

        {(membershipError || myGuildError) && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="alert-triangle" className="w-5 h-5" />
              <span className="font-semibold">Error:</span>
              <span>{membershipError ?? myGuildError}</span>
            </div>
          </div>
        )}

        <div className="bg-white/90 rounded-xl shadow-lg p-6">
          {(classLoading || membershipLoading || myGuildLoading) && (
            <p className="text-gray-700">Loading…</p>
          )}

          {!classLoading && !classId && (
            <div className="text-gray-700">
              <p className="mb-1 font-semibold">No Class Found</p>
              <p className="text-sm text-gray-600">
                This student is not enrolled in any active class.
              </p>
            </div>
          )}

          {!membershipLoading && !!classId && !myGuildId && (
            <div className="text-gray-700">
              <p className="mb-1 font-semibold">No Guild Assigned</p>
              <p className="text-sm text-gray-600">
                Your teacher hasn&apos;t placed you into a guild yet.
              </p>
            </div>
          )}

          {myGuildId && !myGuild && !myGuildLoading && (
            <div className="text-gray-700">
              <p className="mb-1 font-semibold">Guild not found</p>
              <p className="text-sm text-gray-600">
                You&apos;re marked as in a guild, but the guild details couldn&apos;t be loaded.
              </p>
            </div>
          )}

          {myGuild && (
            <>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {myGuild.name}
                  </h2>

                  {membership?.role_in_guild && (
                    <div className="mt-2 inline-flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                        {membership.role_in_guild}
                      </span>
                      <span className="text-xs text-gray-500">
                        Joined{" "}
                        {membership?.joined_at
                          ? new Date(membership.joined_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  )}
                </div>

              </div>

              <h3 className="text-lg font-medium mb-4 text-gray-800">
                Members
              </h3>

              {rosterError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  {rosterError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {rosterLoading && (
                  <div className="text-gray-600">Loading roster…</div>
                )}

                {!rosterLoading &&
                  roster.map((m) => {
                    const displayName = nameByStudentId[m.student_id] ?? "Loading…";
                    const equippedRecord = allEquippedItems.find((r) => r.student_id === m.student_id);

                    // Resolve base sprite
                    let baseSpriteUrl: string | undefined;

                    // Current user: read from localStorage
                    if (m.student_id === studentId) {
                      try {
                        const raw = localStorage.getItem(`cq_characterData_${studentId}`);
                        if (raw) {
                          const cd = JSON.parse(raw);
                          const classMap: Record<string, string> = { Guardian: "guardian", Mage: "mage", Healer: "healer" };
                          const genderMap: Record<string, string> = { M: "male", F: "female" };
                          const skinMap: Record<string, string> = { white: "white", brown: "brown", black: "dark" };
                          const c = classMap[cd.class] ?? cd.class?.toLowerCase();
                          const g = genderMap[cd.gender] ?? cd.gender?.toLowerCase();
                          const s = skinMap[cd.skin] ?? cd.skin;
                          if (c && g && s) baseSpriteUrl = `/assets/seed/avatar-assets/bases/${c}/${g}/${s}/base_${c}_${g}_${s}.png`;
                        }
                      } catch { /* ignore */ }
                    }

                    // Other members: use PlayerAvatar.avatar_base_id (set in welcome.tsx, always accurate)
                    if (!baseSpriteUrl) {
                      const playerAvatar = playerAvatarMap.get(m.student_id);
                      const rawId = playerAvatar?.avatar_base_id ?? equippedRecord?.avatar_base_id ?? "";
                      const id = rawId.toLowerCase();
                      const c = ["guardian", "mage", "healer"].find((x) => id.includes(x));
                      const g = ["male", "female"].find((x) => id.includes(x));
                      const s = ["white", "brown", "dark"].find((x) => id.includes(x));
                      if (c && g && s) baseSpriteUrl = `/assets/seed/avatar-assets/bases/${c}/${g}/${s}/base_${c}_${g}_${s}.png`;
                    }

                    baseSpriteUrl ??= "/assets/seed/avatar-assets/bases/default/base_default_global.png";

                    const getItemSprite = (itemId?: string): string | undefined => {
                      if (!itemId) return undefined;
                      const shop = shopItemMap.get(itemId);
                      if (shop) return getAssetUrl(shop.sprite_path) ?? shop.sprite_path;
                      const rKey = rewardImageMap.get(itemId);
                      if (rKey) return getAssetUrl(rKey);
                      const tKey = targetIdImageMap.get(itemId);
                      if (tKey) return getAssetUrl(tKey);
                      return undefined;
                    };

                    const helmetUrl     = getItemSprite(equippedRecord?.helmet_item_id);
                    const weaponUrl     = getItemSprite(equippedRecord?.hand_item_id);
                    const armourUrl     = getItemSprite(equippedRecord?.armour_item_id);
                    const petUrl        = getItemSprite(equippedRecord?.pet_item_id);
                    const backgroundUrl = getItemSprite(equippedRecord?.background_item_id);

                    return (
                      <div
                        key={`${m.class_id}:${m.student_id}`}
                        className="relative rounded-lg shadow-sm border border-gray-200 flex flex-col items-center pt-4 pb-3 px-3 overflow-hidden"
                      >
                        {/* Blurred background fill */}
                        {backgroundUrl ? (
                          <div
                            className="absolute inset-0 scale-110"
                            style={{
                              backgroundImage: `url(${backgroundUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              filter: "blur(10px)",
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gray-50" />
                        )}

                        {/* Character sprite */}
                        <div className="relative z-10 w-24 h-32 pixel-art mb-2 overflow-hidden rounded">
                          {backgroundUrl && <img src={backgroundUrl} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="" />}
                          <img src={baseSpriteUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" onError={(e) => { (e.target as HTMLImageElement).src = "/assets/seed/avatar-assets/bases/default/base_default_global.png"; }} alt="" />
                          {helmetUrl && <img src={helmetUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
                          {weaponUrl && <img src={weaponUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
                          {armourUrl && <img src={armourUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
                          {petUrl    && <img src={petUrl}    className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
                        </div>

                        <h4 className="relative z-10 font-medium text-sm text-center truncate w-full drop-shadow-md" style={{ color: backgroundUrl ? "#fff" : "#1f2937" }}>
                          {displayName}{m.role_in_guild === "LEADER" && " 👑"}
                        </h4>

                        <div className="relative z-10 mt-2 flex justify-between items-center w-full">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {m.role_in_guild}
                          </span>
                          <span className="text-xs text-red-600 font-semibold drop-shadow-md" style={{ color: backgroundUrl ? "#fca5a5" : undefined }}>
                            {heartsByStudentId[m.student_id] !== undefined
                              ? heartsByStudentId[m.student_id] !== null
                                ? `❤️ ${heartsByStudentId[m.student_id]}`
                                : "—"
                              : "…"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {!rosterLoading && myGuildId && roster.length === 0 && (
                  <div className="text-gray-600">
                    No members found for this guild.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/*Boss Battles Section */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-100">Boss Battles</h2>
            <button
              onClick={() => {
                if (classId) {
                  refreshBossBattles(classId);
                }
              }}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 border border-white/30 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>

          {bossBattlesError && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <i data-feather="alert-triangle" className="w-5 h-5" />
                <span className="font-semibold">Error:</span>
                <span>{bossBattlesError}</span>
              </div>
            </div>
          )}

          {bossBattlesLoading && (
            <div className="bg-white/90 rounded-xl shadow-lg p-6">
              <p className="text-gray-700">Loading boss battles…</p>
            </div>
          )}

          {!bossBattlesLoading && bossBattles.filter((battle) => battle.status?.toUpperCase() !== "ARCHIVED" && !battle.template?.is_deleted).length === 0 && (
            <div className="bg-white/90 rounded-xl shadow-lg p-6">
              <p className="text-gray-700">
                <span className="font-semibold">No boss battles found.</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Your teacher hasn't created any boss battles for this class yet.
              </p>
            </div>
          )}

          {!bossBattlesLoading && bossBattles.filter((battle) => battle.status?.toUpperCase() !== "ARCHIVED" && !battle.template?.is_deleted).length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {bossBattles
                .filter((battle) => battle.status?.toUpperCase() !== "ARCHIVED" && !battle.template?.is_deleted)
                .map((battle) => {
                const template = battle.template;
                const subject = template?.subject || "Other";
                const gradient = getGradientBySubject(template?.subject);
                const statusBg = getStatusColor(battle.status);
                
                const hpPercent = battle.initial_boss_hp > 0 
                  ? Math.max(0, (battle.current_boss_hp / battle.initial_boss_hp) * 100)
                  : 0;

                return (
                  <div
                    key={battle.boss_instance_id}
                    className={`bg-gradient-to-r ${gradient} text-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow`}
                  >
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold mb-1">
                            {template?.title || "Unnamed Boss"}
                          </h3>
                          <p className="text-sm opacity-90">
                            {template?.description || "No description provided."}
                          </p>
                        </div>
                        <div className={`${statusBg} text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ml-3`}>
                          {battle.status?.replace(/_/g, " ") || "DRAFT"}
                        </div>
                      </div>

                      {/* Subject Badge */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        <span className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold">
                           {subject}
                        </span>
                        {template?.is_shared_publicly && (
                          <span className="bg-yellow-300/30 text-yellow-100 px-3 py-1 rounded-full text-xs font-semibold">
                            Shared Publicly
                          </span>
                        )}
                      </div>

                      {/* Boss Health Progress */}
                      <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold">Boss HP</span>
                          <span className="text-sm font-semibold">
                            {battle.initial_boss_hp > 0
                              ? ((battle.current_boss_hp / battle.initial_boss_hp) * 100).toFixed(2)
                              : "0.00"}%
                          </span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-white h-full transition-all duration-300"
                            style={{ width: `${hpPercent}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-5 bg-white/10 backdrop-blur p-4 rounded-lg">
                        <div>
                          <p className="text-xs opacity-75 mb-1">Base XP Reward</p>
                          <p className="text-lg font-bold">
                            +{template?.base_xp_reward?.toLocaleString() || "—"} XP
                          </p>
                        </div>
                        <div>
                          <p className="text-xs opacity-75 mb-1">Base Gold Reward</p>
                          <p className="text-lg font-bold">
                            +{template?.base_gold_reward?.toLocaleString() || "—"} Gold
                          </p>
                        </div>
                        <div>
                          <p className="text-xs opacity-75 mb-1">Created</p>
                          <p className="text-lg font-semibold">
                            {template?.created_at
                              ? new Date(template.created_at).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Link
                        to={`/students/boss-lobby/${battle.boss_instance_id}`}
                        className="block w-full bg-white text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-100 transition-colors shadow-lg text-center"
                      >
                        Join Battle
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuildPage;