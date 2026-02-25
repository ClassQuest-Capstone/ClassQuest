// guild.tsx
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

// ✅ pull classId from enrollments if missing
import {
  getStudentEnrollments,
  type EnrollmentItem,
} from "../../api/classEnrollments.js";

// ✅ class type (NO getClass export in your file)
import type { ClassItem } from "../../api/classes.js";

// ✅ display names
import { getStudentProfile } from "../../api/studentProfiles.js";

// ✅ your shared http client (so we can fetch class by id safely)
import { api } from "../../api/http.js";

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

  // ✅ fetch class details (name) via api directly (no getClass import)
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
    "min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-900";

  const pageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/background/guilds-bg.png')",
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

  // ✅ Name cache
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

    const results = await Promise.all(
      missing.map(async (sid) => {
        try {
          const prof: any = await getStudentProfile(sid);
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
    } catch (e: any) {
      setRosterError(e?.message ?? "Failed to load guild members.");
      setRoster([]);
    } finally {
      setRosterLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGuildId]);

  useEffect(() => {
    feather.replace();
  }, [myGuild, roster, membershipLoading, rosterLoading]);

  // Placeholder guild stats (not implemented yet)
  const guildPower = "—";
  const guildHearts = "—";

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

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 min-w-[220px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">
                      Guild Power
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {guildPower}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">
                      Guild Hearts
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {guildHearts}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    (Not implemented yet)
                  </p>
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
                    const displayName =
                      nameByStudentId[m.student_id] ?? "Loading…";

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

                {!rosterLoading && myGuildId && roster.length === 0 && (
                  <div className="text-gray-600">
                    No members found for this guild.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuildPage;
