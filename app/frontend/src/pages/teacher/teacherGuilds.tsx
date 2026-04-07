// src/pages/teacher/teacherGuilds.tsx
import React, { useEffect, useMemo, useState,  } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import { fetchAuthSession } from "aws-amplify/auth";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import ProfileModal from "../features/teacher/profileModal.tsx";
import { getTeacherProfile } from "../../api/teacherProfiles.js";
import { listClassesByTeacher, type ClassItem } from "../../api/classes.js";
import { createGuild, listGuildsByClass, type Guild } from "../../api/guilds.js";

import {
  getGuildMembership,
  upsertGuildMembership,
  listGuildMembers,
  leaveGuild,
  type GuildMembership,
} from "../../api/guildMemberships.js";

import { getClassEnrollments, type EnrollmentItem } from "../../api/classEnrollments.js";
import { listStudentsBySchool, type StudentProfile } from "../../api/studentProfiles.js";

// --------------------
// Teacher types / context
// --------------------
type TeacherUser = {
  id: string;
  role: "teacher";
  school_id: string;
  displayName?: string;
  email?: string;
};

type TeacherContext = {
  teacher_id: string;
  school_id: string;
};

function getTeacherIdFromLocalStorage(): string | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return (
      parsed?.id ??
      parsed?.teacher_id ??
      parsed?.userId ??
      parsed?.sub ??
      parsed?.username ??
      null
    );
  } catch {
    return null;
  }
}

async function resolveTeacherContext(): Promise<TeacherContext> {
  // 1) try localStorage
  let teacher_id = getTeacherIdFromLocalStorage();

  // 2) fallback to Amplify session sub
  if (!teacher_id) {
    const session = await fetchAuthSession();
    const sub =
      (session as any)?.userSub ??
      (session as any)?.tokens?.idToken?.payload?.sub ??
      null;

    if (!sub) throw new Error("Could not determine teacher_id. Please log in again.");
    teacher_id = sub;
  }

  // 3) teacher profile is source of truth for school_id
  const profile = await getTeacherProfile(teacher_id);
  if (!profile?.school_id) throw new Error("Teacher profile missing school_id.");

  return { teacher_id, school_id: profile.school_id };
}

// --------------------
// State types
// --------------------
type GuildCardState = {
  members: GuildMembership[];
  loading: boolean;
  error?: string;
};

type StudentRowState = {
  membership?: GuildMembership | null;
  loading: boolean;
  error?: string;
  saving?: boolean;
};

// --------------------
// Component
// --------------------
const TeacherGuilds = () => {
  const location = useLocation();

  // Teacher guard
  const teacher = useMemo<TeacherUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role === "teacher") return parsed as TeacherUser;
    } catch {}
    return null;
  }, []);

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;

  // Preselect via navigation state from Classes page
  const initialClassId =
    (location as any)?.state?.class_id ??
    (location as any)?.state?.classId ??
    "";

  const navigate = useNavigate();
  const [teacherCtx, setTeacherCtx] = useState<TeacherContext | null>(null);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildCards, setGuildCards] = useState<Record<string, GuildCardState>>({});

  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [studentsState, setStudentsState] = useState<Record<string, StudentRowState>>({});

  // display names
  const [studentById, setStudentById] = useState<Record<string, StudentProfile>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Create guild modal
  const [isCreateGuildOpen, setIsCreateGuildOpen] = useState(false);
  const [guildName, setGuildName] = useState("");
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [studentSort, setStudentSort] = useState<"az" | "za" | "guild">("az");

  const selectedClass = useMemo(
    () => classes.find((c) => c.class_id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  // Sorted/grouped student list for the assign panel
  type StudentGroup = { header: string | null; enrollments: typeof enrollments };

  const sortedStudentGroups = useMemo((): StudentGroup[] => {
    const sorted = [...enrollments].sort((a, b) => {
      const na = displayName(a.student_id);
      const nb = displayName(b.student_id);
      return na.localeCompare(nb, undefined, { numeric: true, sensitivity: "base" });
    });

    if (studentSort === "za") {
      sorted.reverse();
    }

    if (studentSort === "guild") {
      const byGuild = new Map<string, typeof enrollments>();
      for (const e of sorted) {
        const gid = studentCurrentGuildId(e.student_id);
        const key = gid || "__none__";
        if (!byGuild.has(key)) byGuild.set(key, []);
        byGuild.get(key)!.push(e);
      }

      const groups: StudentGroup[] = [];
      // Named guilds first (alphabetical by guild name)
      const namedKeys = [...byGuild.keys()]
        .filter((k) => k !== "__none__")
        .sort((a, b) =>
          guildNameById(a).localeCompare(guildNameById(b), undefined, { numeric: true, sensitivity: "base" })
        );
      for (const key of namedKeys) {
        groups.push({ header: guildNameById(key), enrollments: byGuild.get(key)! });
      }
      // No guild at the end
      if (byGuild.has("__none__")) {
        groups.push({ header: "No Guild", enrollments: byGuild.get("__none__")! });
      }
      return groups;
    }

    return [{ header: null, enrollments: sorted }];
  }, [enrollments, studentSort, studentsState, guilds, studentById]);

  function displayName(studentId: string): string {
    const p = studentById[studentId];
    return p?.display_name || p?.username || "Student";
  }

  function guildNameById(guildId: string): string {
    return guilds.find((g) => g.guild_id === guildId)?.name ?? "Guild";
  }

  async function refreshClasses(ctx: TeacherContext) {
    const res = await listClassesByTeacher(ctx.teacher_id);
    setClasses(res.items || []);
  }

  async function refreshGuilds(classId: string) {
    const res = await listGuildsByClass(classId, 100);
    setGuilds((res.items || []).filter((g) => g.is_active !== false));
  }

  async function refreshEnrollments(classId: string) {
    const res = await getClassEnrollments(classId);
    setEnrollments((res.items || []).filter((e) => e.status !== "dropped"));
  }

  async function refreshStudentProfiles(schoolId: string) {
    const res = await listStudentsBySchool(schoolId);
    const items = res.items || [];
    const map: Record<string, StudentProfile> = {};
    for (const s of items) map[s.student_id] = s;
    setStudentById(map);
  }

  // Load teacher context + classes + student profiles
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const ctx = await resolveTeacherContext();
        if (!mounted) return;
        setTeacherCtx(ctx);

        await refreshStudentProfiles(ctx.school_id);

        const response = await listClassesByTeacher(ctx.teacher_id);
        const items = response.items || [];
        if (!mounted) return;

        setClasses(items);

        const active = items.filter((c: any) => c.is_active !== false);
        if (!selectedClassId && active.length > 0) {
          setSelectedClassId(active[0].class_id);
        }
      } catch (err: any) {
        console.error(err);
        if (!mounted) return;
        setError(err?.message || "Failed to load teacher data.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load class-specific data when class changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!selectedClassId) return;
      try {
        setError("");
        setGuildCards({});
        setStudentsState({});

        const [guildsRes, enrollmentsRes] = await Promise.all([
          listGuildsByClass(selectedClassId, 100),
          getClassEnrollments(selectedClassId),
        ]);

        if (!mounted) return;

        const activeGuilds = (guildsRes.items || []).filter((g: any) => g.is_active !== false);
        const activeEnrollments = (enrollmentsRes.items || []).filter((e: any) => e.status !== "dropped");

        setGuilds(activeGuilds);
        setEnrollments(activeEnrollments);

        // Auto-load guild rosters
        await Promise.all(activeGuilds.map((g: any) => loadGuildMembers(g.guild_id)));

        if (!mounted) return;

        // Auto-load student memberships
        await Promise.all(activeEnrollments.map((e: any) => loadStudentMembership(e.student_id)));
      } catch (err: any) {
        console.error(err);
        if (!mounted) return;
        setError(err?.message || "Failed to load guilds or students for class.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedClassId]);

  // icons
  useEffect(() => {
    feather.replace();
  }, [loading, isCreateGuildOpen, guilds, enrollments, selectedClassId, studentById, guildCards, studentsState]);

  // --------------------
  // Guild actions
  // --------------------
  function openCreateGuildModal() {
    setError("");
    setGuildName("");
    setIsCreateGuildOpen(true);
  }

  async function handleCreateGuild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!teacherCtx) {
      setError("Teacher context not loaded yet. Try again in a second.");
      return;
    }
    if (!selectedClassId) {
      setError("Select a class first.");
      return;
    }

    const name = guildName.trim();
    if (!name) {
      setError("Please enter a guild name (e.g. Team Phoenix).");
      return;
    }

    try {
      setIsCreatingGuild(true);
      await createGuild(selectedClassId, { name });
      setIsCreateGuildOpen(false);
      setGuildName("");
      await refreshGuilds(selectedClassId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create guild.");
    } finally {
      setIsCreatingGuild(false);
    }
  }

  async function loadGuildMembers(guildId: string) {
    setGuildCards((prev) => ({
      ...prev,
      [guildId]: { members: prev[guildId]?.members || [], loading: true },
    }));

    try {
      const res = await listGuildMembers(guildId, 100);
      setGuildCards((prev) => ({
        ...prev,
        [guildId]: { members: (res.items || []).filter((m) => m.is_active !== false), loading: false },
      }));
    } catch (err: any) {
      console.error(err);
      setGuildCards((prev) => ({
        ...prev,
        [guildId]: {
          members: prev[guildId]?.members || [],
          loading: false,
          error: err?.message || "Failed to load guild members.",
        },
      }));
    }
  }

  // --------------------
  // Student membership actions
  // --------------------
  async function loadStudentMembership(studentId: string) {
    if (!selectedClassId) return;

    setStudentsState((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { loading: false }),
        loading: true,
        error: undefined,
      },
    }));

    try {
      const membership = await getGuildMembership(selectedClassId, studentId);
      setStudentsState((prev) => ({
        ...prev,
        [studentId]: { loading: false, membership: membership || null },
      }));
    } catch (err: any) {
      // 404 is common if not assigned yet
      const msg = err?.message || "";
      const isNotFound = msg.toLowerCase().includes("not found") || err?.statusCode === 404;

      setStudentsState((prev) => ({
        ...prev,
        [studentId]: {
          loading: false,
          membership: isNotFound ? null : prev[studentId]?.membership ?? null,
          error: isNotFound ? undefined : err?.message || "Failed to load membership.",
        },
      }));
    }
  }

  async function removeStudentFromGuild(studentId: string) {
    if (!selectedClassId) return;

    setStudentsState((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { loading: false }),
        saving: true,
        error: undefined,
      },
    }));

    try {
      const updated = await leaveGuild(selectedClassId, studentId);

      setStudentsState((prev) => ({
        ...prev,
        [studentId]: { loading: false, saving: false, membership: updated },
      }));

      // refresh rosters
      await Promise.all(guilds.map((g) => loadGuildMembers(g.guild_id)));
    } catch (err: any) {
      console.error(err);
      setStudentsState((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { loading: false }),
          saving: false,
          error: err?.message || "Failed to remove from guild.",
        },
      }));
    }
  }

  async function assignStudentToGuild(studentId: string, guildId: string) {
    if (!selectedClassId) return;

    // If teacher selects "(Not assigned)" => remove
    if (!guildId) {
      await removeStudentFromGuild(studentId);
      return;
    }

    setStudentsState((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { loading: false }),
        saving: true,
        error: undefined,
      },
    }));

    try {
      const updated = await upsertGuildMembership(selectedClassId, studentId, {
        guild_id: guildId,
        role_in_guild: "MEMBER",
      });

      setStudentsState((prev) => ({
        ...prev,
        [studentId]: { loading: false, saving: false, membership: updated },
      }));

      await Promise.all(guilds.map((g) => loadGuildMembers(g.guild_id)));
    } catch (err: any) {
      console.error(err);
      setStudentsState((prev) => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { loading: false }),
          saving: false,
          error: err?.message || "Failed to assign student.",
        },
      }));
    }
  }

  function studentCurrentGuildId(studentId: string): string {
    const m: any = studentsState[studentId]?.membership;
    if (!m || m.is_active === false) return "";
    return m.guild_id ?? "";
  }

  function isAssigned(studentId: string): boolean {
    const m: any = studentsState[studentId]?.membership;
    return !!(m?.guild_id && m.is_active !== false);
  }

  // --------------------
  // UI
  // --------------------
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
                to="/classes"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
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
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
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

      {/* Sub-nav with back and wiki links */}
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
                   <Link
                     to="/classes"
                     className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
                   >
                     <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                     <span className="text-sm font-medium">Back</span>
                   </Link>
                   <Link
                     to="/wiki/guilds"
                     className="ml-auto inline-flex items-center bg-white text-indigo-700 border-2 border-indigo-300 rounded-md px-3 py-2 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                   >
                     <i data-feather="book-open" className="w-5 h-5 mr-2"></i>
                     <span className="text-sm font-medium">Wiki / Help</span>
                   </Link>
                 </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">Guild Management</h1>
            <p className="text-white">Create guilds for a class and assign students into teams.</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="bg-white rounded-xl shadow-md px-4 py-2 flex items-center gap-3">
              <i data-feather="layers" className="w-5 h-5 text-gray-700"></i>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-sm font-medium text-gray-800 outline-none bg-white"
              >
                <option value="" disabled>
                  Select a class...
                </option>
                {classes
                  .filter((c: any) => c.is_active !== false)
                  .map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.name} (Grade {c.grade_level})
                    </option>
                  ))}
              </select>
            </div>

            <button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center disabled:opacity-50"
              onClick={openCreateGuildModal}
              disabled={!selectedClassId}
              title={!selectedClassId ? "Select a class first" : "Create a guild"}
            >
              <i data-feather="plus" className="mr-2"></i> Create Guild
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white rounded-xl shadow-md p-4 text-red-600 mb-6">{error}</div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            <p>Loading guild manager...</p>
          </div>
        ) : !selectedClassId ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
            Select a class to start managing guilds.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Guilds */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Guilds</h2>
                    <p className="text-white/80 text-sm">
                      {selectedClass?.name ? `Class: ${selectedClass.name}` : "Class selected"}
                    </p>
                  </div>
                  <i data-feather="shield" className="w-8 h-8"></i>
                </div>
              </div>

              <div className="p-5 text-black">
                {guilds.length === 0 ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-indigo-900">
                    No guilds yet. Click <b>Create Guild</b> to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {guilds.map((g) => {
                      const id = g.guild_id;
                      const card = guildCards[id];

                      return (
                        <div key={id} className="border rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-xs tracking-widest text-gray-500 font-semibold">GUILD</p>
                              <p className="text-lg font-bold text-gray-900">{g.name}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {card && !card.loading && (
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-full">
                                  {card.members.length} member{card.members.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              <button
                                className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                onClick={() => loadGuildMembers(id)}
                              >
                                <i data-feather="refresh-cw" className="w-4 h-4 inline mr-1"></i>
                                {card?.loading ? "Loading..." : "Refresh"}
                              </button>
                            </div>
                          </div>

                          <div className="p-4">
                            {card?.error && (
                              <div className="text-sm text-red-600 bg-red-50 p-3 rounded mb-3">
                                {card.error}
                              </div>
                            )}

                            {!card ? (
                              <div className="text-sm text-gray-600">Loading roster...</div>
                            ) : card.loading ? (
                              <div className="text-sm text-gray-600">Loading roster...</div>
                            ) : card.members.length === 0 ? (
                              <div className="text-sm text-gray-600">No members assigned yet.</div>
                            ) : (
                              <ul className="space-y-2">
                                {card.members.map((m) => (
                                  <li
                                    key={`${m.class_id}-${m.student_id}`}
                                    className="flex items-center justify-between bg-white border rounded-lg px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i data-feather="user" className="w-4 h-4 text-gray-600"></i>
                                      <span className="text-sm text-gray-800 font-medium">
                                        {displayName(m.student_id)}
                                      </span>
                                    </div>

                                    <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {m.role_in_guild || "MEMBER"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Students */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Assign Students</h2>
                    <p className="text-white/80 text-sm">Pick a student and assign them to a guild.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={studentSort}
                      onChange={(e) => setStudentSort(e.target.value as "az" | "za" | "guild")}
                      className="border border-white/30 rounded-lg px-3 py-1.5 text-sm text-white bg-white/20 backdrop-blur-sm"
                    >
                      <option value="az" className="text-black">A → Z</option>
                      <option value="za" className="text-black">Z → A</option>
                      <option value="guild" className="text-black">By Guild</option>
                    </select>
                    <i data-feather="user-check" className="w-8 h-8"></i>
                  </div>
                </div>
              </div>

              <div className="p-5 text-black">
                {enrollments.length === 0 ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-purple-900">
                    No students found for this class.
                  </div>
                ) : guilds.length === 0 ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-indigo-900">
                    Create at least one guild before assigning students.
                  </div>
                ) : (
                  <>

                    <div className="space-y-1">
                      {sortedStudentGroups.map((group) => (
                        <div key={group.header ?? "__flat__"}>
                          {group.header !== null && (
                            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mt-3 mb-1 px-1">
                              {group.header}
                            </p>
                          )}
                          {group.enrollments.map((e) => {
                            const studentId = e.student_id;
                            const row = studentsState[studentId];
                            const assigned = isAssigned(studentId);

                            return (
                              <div key={studentId} className="border rounded-lg px-4 py-3 flex items-center gap-3">
                                <p className="text-sm font-bold text-gray-900 w-32 shrink-0 truncate">
                                  {displayName(studentId)}
                                </p>

                                <select
                                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-black bg-white"
                                  value={studentCurrentGuildId(studentId)}
                                  onChange={(ev) => assignStudentToGuild(studentId, ev.target.value)}
                                  disabled={row?.saving || row?.loading}
                                >
                                  <option value="">(No guild)</option>
                                  {guilds.map((g) => (
                                    <option key={g.guild_id} value={g.guild_id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  className="px-3 py-2 text-sm rounded-lg bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-40 shrink-0"
                                  disabled={row?.saving || !assigned}
                                  onClick={() => removeStudentFromGuild(studentId)}
                                  title={!assigned ? "Not in a guild" : "Remove from guild"}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Guild Modal */}
      {isCreateGuildOpen && (
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Guild</h3>
              <button
                onClick={() => setIsCreateGuildOpen(false)}
                className="text-blue-500 hover:text-blue-700"
                disabled={isCreatingGuild}
              >
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateGuild}>
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-xs tracking-widest text-indigo-700 font-semibold">CLASS</p>
                <p className="mt-1 text-lg font-bold text-indigo-900">
                  {selectedClass?.name || selectedClassId}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guild Name</label>
                <input
                  type="text"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Team Phoenix"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateGuildOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
                  disabled={isCreatingGuild}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                  disabled={isCreatingGuild || !teacherCtx || !selectedClassId}
                >
                  {isCreatingGuild ? "Creating..." : "Create Guild"}
                </button>
              </div>

              {!teacherCtx && (
                <p className="text-xs text-gray-500">
                  Teacher context not loaded yet. If this persists, re-login.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default TeacherGuilds;
