// guild.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

import {
  createGuild as apiCreateGuild,
  getGuild as apiGetGuild,
  listGuildsByClass,
  type Guild,
} from "../../api/guilds";

import {
  getGuildMembership,
  joinGuild,
  leaveGuild,
  listGuildMembers,
  type GuildMembership,
} from "../../api/guildMemberships";

// ✅ Correct endpoint for display names
import { getStudentProfile } from "../../api/studentProfiles";

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

const GuildPage: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? "student-001";

  // TODO: replace with your real current class source
  const classId =
    student?.classId ?? localStorage.getItem("cq_currentClassId") ?? "class-123";

  // Keep icons updated
  useEffect(() => {
    feather.replace();
  });

  const { profile } = usePlayerProgression({
    studentId,
    level: 1,
    totalXP: 300,
    gold: 0,
    stats: { hp: 55, strength: 17, intelligence: 17, speed: 17 },
  });

  const pageBg =
    "min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-900";

  const pageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/background/guilds-bg.png')",
  };

  // --------------------
  // Guild list state
  // --------------------
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildsError, setGuildsError] = useState<string | null>(null);

  // --------------------
  // Membership state
  // --------------------
  const [membership, setMembership] = useState<GuildMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const myGuildId = membership?.is_active ? membership.guild_id : null;

  const myGuild = useMemo(() => {
    if (!myGuildId) return null;
    return guilds.find((g) => g.guild_id === myGuildId) ?? null;
  }, [guilds, myGuildId]);

  // --------------------
  // Roster state
  // --------------------
  const [roster, setRoster] = useState<GuildMembership[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // ✅ Name cache (student_id -> display_name)
  const [nameByStudentId, setNameByStudentId] = useState<Record<string, string>>(
    {}
  );

  // ✅ Avoid stale closures inside hydrateNames
  const nameCacheRef = useRef<Record<string, string>>({});
  useEffect(() => {
    nameCacheRef.current = nameByStudentId;
  }, [nameByStudentId]);

  // ✅ Pre-fill your own name instantly (so leader/me doesn't stay Loading)
  useEffect(() => {
    const myName = student?.displayName?.trim();
    if (studentId && myName) {
      setNameByStudentId((prev) => (prev[studentId] ? prev : { ...prev, [studentId]: myName }));
    }
  }, [studentId, student?.displayName]);

  async function hydrateNames(studentIds: string[]) {
    const unique = Array.from(new Set(studentIds)).filter(Boolean);

    // only fetch the ones we don't already have (using ref = latest)
    const missing = unique.filter((id) => !nameCacheRef.current[id]);
    if (missing.length === 0) return;

    const results = await Promise.all(
      missing.map(async (sid) => {
        try {
          const prof: any = await getStudentProfile(sid);
          // studentProfiles.ts uses display_name (snake_case)
          const name = String(prof?.display_name ?? "").trim();
          return { sid, name: name || "Unknown Student" };
        } catch {
          return { sid, name: "Unknown Student" };
        }
      })
    );

    const updates: Record<string, string> = {};
    for (const r of results) updates[r.sid] = r.name;

    setNameByStudentId((prev) => ({ ...prev, ...updates }));
  }

  // --------------------
  // Create Guild modal state
  // --------------------
  const [showCreate, setShowCreate] = useState(false);
  const [newGuildName, setNewGuildName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --------------------
  // Loaders
  // --------------------
  async function refreshGuilds() {
    try {
      setGuildsLoading(true);
      setGuildsError(null);

      const res = await listGuildsByClass(classId, 50);
      const active = (res.items ?? []).filter((g) => g.is_active !== false);
      setGuilds(active);
    } catch (e: any) {
      setGuildsError(e?.message ?? "Failed to load guilds.");
    } finally {
      setGuildsLoading(false);
    }
  }

  async function refreshMembership() {
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

  async function refreshRoster(guildId: string) {
    try {
      setRosterLoading(true);
      setRosterError(null);

      const res = await listGuildMembers(guildId, 50);
      const active = (res.items ?? []).filter((m) => m.is_active !== false);
      setRoster(active);

      // ✅ fetch display names for roster
      hydrateNames(active.map((m) => m.student_id));
    } catch (e: any) {
      setRosterError(e?.message ?? "Failed to load guild members.");
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    refreshGuilds();
    refreshMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId]);

  useEffect(() => {
    if (myGuildId) refreshRoster(myGuildId);
    else {
      setRoster([]);
      setRosterError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGuildId]);

  useEffect(() => {
    feather.replace();
  }, [guilds, myGuildId, roster, showCreate, guildsLoading, rosterLoading]);

  // --------------------
  // Actions
  // --------------------
  async function handleCreateGuild() {
    const name = newGuildName.trim();
    if (!name) {
      setCreateError("Guild name cannot be empty.");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);

      const created = await apiCreateGuild(classId, { name });

      // auto-join as LEADER
      await joinGuild(classId, studentId, created.guild_id, "LEADER");

      setShowCreate(false);
      setNewGuildName("");

      await refreshGuilds();
      await refreshMembership();
    } catch (e: any) {
      setCreateError(e?.message ?? "Failed to create guild.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoinGuild(guildId: string) {
    try {
      setMembershipError(null);
      await joinGuild(classId, studentId, guildId, "MEMBER");
      await refreshMembership();
    } catch (e: any) {
      setMembershipError(e?.message ?? "Failed to join guild.");
    }
  }

  async function handleLeaveGuild() {
    try {
      setMembershipError(null);
      await leaveGuild(classId, studentId);
      await refreshMembership();
    } catch (e: any) {
      setMembershipError(e?.message ?? "Failed to leave guild.");
    }
  }

  // --------------------
  // UI helpers
  // --------------------
  const topGuilds = guilds.slice(0, 10);

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

              <div className="relative ml-3">
                <button
                  id="user-menu-button"
                  className="flex items-center text-sm rounded-full focus:outline-none"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt=""
                  />
                  <span className="ml-2 text-sm font-medium">
                    {student?.displayName ?? "Student"}
                  </span>
                </button>
              </div>
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
            <h1 className="text-3xl font-bold text-gray-100">Guilds</h1>
            <p className="text-gray-200">
              Team up with classmates to defeat powerful bosses!
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Class: <span className="font-mono">{classId}</span>
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                refreshGuilds();
                refreshMembership();
                if (myGuildId) refreshRoster(myGuildId);
              }}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 border border-white/30 rounded-lg transition-colors"
            >
              Refresh
            </button>

            <button
              onClick={() => setShowCreate(true)}
              className="bg-black hover:bg-gray-100 text-yellow-400 font-semibold hover:text-yellow-600 py-2 px-6 border border-yellow-600 hover:border-yellow-700 rounded-lg transition-colors"
            >
              Create Guild
            </button>
          </div>
        </div>

        {/* Errors */}
        {(guildsError || membershipError) && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="alert-triangle" className="w-5 h-5" />
              <span className="font-semibold">Error:</span>
              <span>{guildsError ?? membershipError}</span>
            </div>
          </div>
        )}

        {/* My Guild */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">My Guild</h2>

            {myGuildId && (
              <button
                onClick={handleLeaveGuild}
                className="text-sm font-semibold text-red-700 hover:text-red-900"
              >
                Leave Guild
              </button>
            )}
          </div>

          {(membershipLoading || guildsLoading) && (
            <p className="text-gray-700">Loading…</p>
          )}

          {!membershipLoading && !myGuildId && (
            <div className="text-gray-700">
              <p className="mb-3">
                You aren&apos;t in a guild yet. Join one below or create your own.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Create a Guild
              </button>
            </div>
          )}

          {myGuildId && !myGuild && !guildsLoading && (
            <div className="text-gray-700">
              <p className="mb-2">Your guild wasn&apos;t found in the list.</p>
              <button
                onClick={async () => {
                  try {
                    const g = await apiGetGuild(myGuildId);
                    setGuilds((prev) => {
                      if (prev.some((x) => x.guild_id === g.guild_id)) return prev;
                      return [g, ...prev];
                    });
                  } catch {
                    // ignore
                  }
                }}
                className="text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Try fetching guild
              </button>
            </div>
          )}

          {myGuild && (
            <>
              <h3 className="text-lg font-bold mb-4 text-gray-800">
                <span className="text-gray-600">Guild:</span>{" "}
                <span className="text-blue-700">{myGuild.name}</span>
                {membership?.role_in_guild && (
                  <span className="ml-3 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                    {membership.role_in_guild}
                  </span>
                )}
              </h3>

              <div className="flex items-center mb-6">
                <div className="relative">
                  <img
                    src="http://static.photos/education/200x200/20"
                    alt="Guild Banner"
                    className="w-32 h-32 rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 bg-yellow-500 text-white px-3 py-1 rounded-r-full text-xs">
                    Active Guild
                  </div>
                </div>

                <div className="ml-6">
                  <p className="text-gray-700 mb-2">
                    Joined:{" "}
                    <span className="font-semibold">
                      {membership?.joined_at
                        ? new Date(membership.joined_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </p>

                  <p className="text-gray-700 mb-2">
                    Members:{" "}
                    <span className="font-semibold">
                      {rosterLoading ? "…" : roster.length}
                    </span>
                  </p>
                </div>
              </div>

              <h3 className="text-lg font-medium mb-4 text-gray-800">
                Current Members
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
                    // ✅ ONLY show display name (never show id)
                    const displayName = nameByStudentId[m.student_id] ?? "Loading…";

                    return (
                      <div
                        key={`${m.class_id}:${m.student_id}`}
                        className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200"
                      >
                        <div className="flex items-center">
                          <div className="relative mr-4">
                            <img
                              src="http://static.photos/people/200x200/9"
                              alt="Member"
                              className="w-12 h-12 rounded-full"
                            />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">
                              {displayName}
                              {m.role_in_guild === "LEADER" && " (Leader)"}
                            </h4>
                            <p className="text-xs text-gray-500">
                              Joined{" "}
                              {m.joined_at
                                ? new Date(m.joined_at).toLocaleDateString()
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-between">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {m.role_in_guild}
                          </span>
                          <span className="text-xs text-gray-500">
                            {m.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Browse / Join Guilds */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Browse Guilds in Your Class
            </h2>
            {guildsLoading && (
              <span className="text-sm text-gray-600">Loading…</span>
            )}
          </div>

          {!guildsLoading && guilds.length === 0 && (
            <p className="text-gray-700">
              No guilds yet. Be the first to create one!
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guilds.map((g) => {
              const joined = myGuildId === g.guild_id;
              const inSomeGuild = !!myGuildId;

              return (
                <div
                  key={g.guild_id}
                  className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800">{g.name}</h3>
                    </div>

                    {joined ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                        Joined
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinGuild(g.guild_id)}
                        className={`text-sm font-semibold py-2 px-3 rounded-lg ${
                          inSomeGuild
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "bg-blue-700 hover:bg-blue-800 text-white"
                        }`}
                        title={
                          inSomeGuild
                            ? "This will switch your guild."
                            : "Join this guild."
                        }
                      >
                        {inSomeGuild ? "Switch" : "Join"}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex justify-between">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {g.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-gray-600">
                      Created {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Guilds */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Top Guilds</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guild
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topGuilds.map((g, idx) => (
                  <tr key={g.guild_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-800">
                        {g.name}
                        {myGuildId === g.guild_id && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                            Your Guild
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      {g.is_active ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}

                {!guildsLoading && topGuilds.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No guilds yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Create Guild</h2>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                className="text-gray-500 hover:text-gray-800"
              >
                <i data-feather="x" className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Guild Name
            </label>
            <input
              value={newGuildName}
              onChange={(e) => setNewGuildName(e.target.value)}
              placeholder="e.g. Dragon Slayers"
              className="w-full bg-white text-black placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {createError && (
              <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                disabled={createLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGuild}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-60"
                disabled={createLoading}
              >
                {createLoading ? "Creating..." : "Create"}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Creates guild in class <span className="font-mono">{classId}</span>{" "}
              and auto-joins you as <span className="font-semibold">LEADER</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuildPage;
