import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import ProfileModal from "../features/teacher/ProfileModal.js";

import { validateJoinCode } from "../../api/classes.js";
import { getClassEnrollments, unenrollStudent } from "../../api/classEnrollments.js";
import { getStudentProfile, updateStudentProfile, setStudentPassword } from "../../api/studentProfiles.js";
import { getPlayerState, getLeaderboard, upsertPlayerState } from "../../api/playerStates.js";
import { createTransaction } from "../../api/rewardTransactions.js";
import xpIcon from "../../../dist/assets/icons/XP.png";


type CurrentUser =
  | {
      id: string;
      role: "teacher";
      displayName?: string;
      email?: string;
      classCode?: string;
    }
  | {
      id: string;
      role: "student";
      displayName?: string;
      email?: string;
      joinedClassCode?: string;
    };

type StudentRow = {
  id: string;
  enrollmentId: string; // For unenrolling
  username: string;
  displayName: string;
  password: string;
  xp: number;
  gold: number;
  hearts: number;
  // Track changes for dirty detection
  originalUsername: string;
  originalDisplayName: string;
  originalPassword: string;
  originalXp: number;
  originalGold: number;
  originalHearts: number;
  // Flags for validation
  isLoading: boolean;
  error?: string;
};

const Students = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Heart regeneration settings (class-wide)
  const [regenEnabled, setRegenEnabled] = useState(true);
  const [regenIntervalHours, setRegenIntervalHours] = useState(3);
  const [regenSaving, setRegenSaving] = useState(false);
  const [regenMessage, setRegenMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  //  read teacher
  const teacher = useMemo<CurrentUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CurrentUser;
      if (parsed?.role === "teacher") return parsed;
    } catch {}
    return null;
  }, []);

  // Guard: not logged in as teacher
  if (!teacher || teacher.role !== "teacher") {
    return <Navigate to="/TeacherLogin" replace />;
  }

  // teacher class code - prefer URL param (from /classes page navigation)
  const teacherClassCode = useMemo(() => {
    const fromUrl = searchParams.get("classCode")?.trim().toUpperCase();
    if (fromUrl) return fromUrl;
    const fromTeacher = (teacher.classCode || "").trim().toUpperCase();
    if (fromTeacher) return fromTeacher;
    return (localStorage.getItem("cq_teacherClassCode") || "").trim().toUpperCase();
  }, [searchParams, teacher.classCode]);

  useEffect(() => {
    feather.replace();
  });

  // Load student data from APIs
  useEffect(() => {
    if (!teacherClassCode) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const loadStudents = async () => {
      try {
        setGlobalError(null);
        
        // Get class info from join code
        const classInfo = await validateJoinCode(teacherClassCode);
        if (cancelled) return;
        if (!classInfo) {
          setGlobalError("Class not found");
          setRows([]);
          setClassId(null);
          return;
        }
        
        // Store the class_id for later use
        setClassId(classInfo.class_id);

        // Batch-fetch all player states in one request 
        const playerStateMap = new Map<string, { total_xp_earned: number; gold: number; current_xp: number; xp_to_next_level: number; hearts: number; max_hearts: number; status: "ALIVE" | "DOWNED" | "BANNED" }>();
        try {
          const leaderboard = await getLeaderboard(classInfo.class_id, 200);
          for (const ps of leaderboard.items) {
            playerStateMap.set(ps.student_id, ps);
          }
        } catch {
          // Leaderboard unavailable - all students will show default 0 values
        }

        if (cancelled) return;

        // Get enrolled students from backend
        const enrollments = await getClassEnrollments(classInfo.class_id);
        if (cancelled) return;
        const activeEnrollments = enrollments.items.filter(e => e.status === "active");

        if (activeEnrollments.length === 0) {
          setRows([]);
          return;
        }

        const defaultState = { current_xp: 0, total_xp_earned: 0, xp_to_next_level: 100, hearts: 5, max_hearts: 5, gold: 0, status: "ALIVE" as const };

        // Retry helper for transient server errors
        const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 5, delayMs = 400): Promise<T> => {
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              return await fn();
            } catch (err: any) {
              const isTransient = /50[0-9]|network/i.test(err?.message ?? "");
              if (!isTransient || attempt === retries - 1) throw err;
              await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
            }
          }
          throw new Error("Unreachable");
        };

        const studentPromises = activeEnrollments.map(async (enrollment) => {
          const id = enrollment.student_id;
          const enrollmentId = enrollment.enrollment_id;
          
          try {
            // Load profile with retry to fix transient errors
            let profile;
            try {
              profile = await fetchWithRetry(() => getStudentProfile(id));
            } catch (profileErr: any) {
              console.error(`Error loading profile for ${id}:`, profileErr);
              throw new Error(`Profile not found`);
            }

            // Look up player state from the batch-fetched map
            const playerState = playerStateMap.get(id) ?? defaultState;

            const row: StudentRow = {
              id,
              enrollmentId,
              username: profile.username,
              displayName: profile.display_name,
              password: "",
              xp: playerState.total_xp_earned ?? 0,
              gold: playerState.gold ?? 0,
              hearts: playerState.hearts ?? 5,
              originalUsername: profile.username,
              originalDisplayName: profile.display_name,
              originalPassword: "",
              originalXp: playerState.total_xp_earned ?? 0,
              originalGold: playerState.gold ?? 0,
              originalHearts: playerState.hearts ?? 5,
              isLoading: false,
            };
            return row;
          } catch (err: any) {
            console.error(`Error loading student ${id}:`, err);
            return {
              id,
              enrollmentId,
              username: `⚠️ ${err.message || "Profile missing"}`,
              displayName: "—",
              password: "",
              xp: 0,
              gold: 0,
              hearts: 0,
              originalUsername: "",
              originalDisplayName: "",
              originalPassword: "",
              originalXp: 0,
              originalGold: 0,
              originalHearts: 0,
              isLoading: false,
              error: err.message,
            } as StudentRow;
          }
        });

        const loaded = await Promise.all(studentPromises);
        if (!cancelled) setRows(loaded);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error loading students:", err);
          setGlobalError(err.message);
        }
      }
    };

    loadStudents();
    return () => { cancelled = true; };
  }, [teacherClassCode]);

  // Detect if there are unsaved changes
  const hasChanges = useMemo(() => {
    return rows.some(
      (s) =>
        s.username !== s.originalUsername ||
        s.displayName !== s.originalDisplayName ||
        s.password !== s.originalPassword ||
        s.xp !== s.originalXp ||
        s.gold !== s.originalGold ||
        s.hearts !== s.originalHearts
    );
  }, [rows]);

  useEffect(() => {
    setUnsavedChanges(hasChanges);
  }, [hasChanges]);

  // Warn user when leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedChanges]);

  // Update a field in a student row
  const updateStudentField = (
    studentId: string,
    field: keyof Omit<StudentRow, "originalUsername" | "originalDisplayName" | "originalPassword" | "originalXp" | "originalGold" | "originalHearts" | "isLoading" | "error">,
    value: string | number
  ) => {
    setRows((prevRows) =>
      prevRows.map((s) =>
        s.id === studentId ? { ...s, [field]: value } : s
      )
    );
  };

  // Toggle password visibility
  const togglePasswordVisibility = (studentId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  // Remove a student (unenroll from class)
  const handleRemoveStudent = async (studentId: string, enrollmentId: string) => {
    if (!confirm("Remove this student from the class?")) {
      return;
    }

    try {
      await unenrollStudent(enrollmentId);
      setRows((prevRows) => prevRows.filter((s) => s.id !== studentId));
    } catch (err: any) {
      console.error("Error removing student:", err);
      setGlobalError(`Failed to remove student: ${err.message}`);
    }
  };

  // Apply heart regen settings to all students in the class
  const handleSaveRegenSettings = async () => {
    if (!classId) {
      setRegenMessage({ kind: "err", text: "No class loaded." });
      return;
    }
    if (rows.length === 0) {
      setRegenMessage({ kind: "err", text: "No students to update." });
      return;
    }
    const interval = Number(regenIntervalHours);
    if (!Number.isFinite(interval) || interval <= 0) {
      setRegenMessage({ kind: "err", text: "Interval must be a positive number." });
      return;
    }

    setRegenSaving(true);
    setRegenMessage(null);

    try {
      await Promise.all(
        rows
          .filter((s) => !s.error)
          .map(async (s) => {
            const state = await getPlayerState(classId, s.id).catch(() => null);
            await upsertPlayerState(classId, s.id, {
              current_xp: state?.current_xp ?? 0,
              xp_to_next_level: state?.xp_to_next_level ?? 100,
              total_xp_earned: state?.total_xp_earned ?? 0,
              hearts: state?.hearts ?? 5,
              max_hearts: state?.max_hearts ?? 5,
              gold: state?.gold ?? 0,
              status: state?.status ?? "ALIVE",
              last_weekend_reset_at: state?.last_weekend_reset_at,
              heart_regen_interval_hours: interval,
              heart_regen_enabled: regenEnabled,
            });
          })
      );
      setRegenMessage({
        kind: "ok",
        text: `Regen settings applied to all ${rows.filter((s) => !s.error).length} student(s).`,
      });
    } catch (err: any) {
      setRegenMessage({ kind: "err", text: err.message || "Failed to apply regen settings." });
    } finally {
      setRegenSaving(false);
    }
  };

  // Save changes to backend
  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      setGlobalError(null);

      const updates = rows.filter(
        (s) =>
          !s.error && // Skip students with errors
          (s.username !== s.originalUsername ||
           s.displayName !== s.originalDisplayName ||
           s.password !== s.originalPassword ||
           s.xp !== s.originalXp ||
           s.gold !== s.originalGold ||
           s.hearts !== s.originalHearts)
      );

      // Update student profiles (only for rows without errors)
      const profileUpdates = updates
        .filter(
          (s) =>
            s.username !== s.originalUsername ||
            s.displayName !== s.originalDisplayName
        )
        .map((s) =>
          updateStudentProfile(s.id, {
            username: s.username !== s.originalUsername ? s.username : undefined,
            display_name:
              s.displayName !== s.originalDisplayName
                ? s.displayName
                : undefined,
          })
        );

      // update password (separately)
      const passwordUpdate = updates
        .filter((s) => s.password !== s.originalPassword)
        .map((s) => {
          console.log(`Updating password for ${s.id}`);
          return setStudentPassword(s.id, s.password);
        });

      // Update player states (XP and Gold)
      if (!classId) {
        throw new Error("Class ID not available");
      }
      const playerStateUpdates = updates
        .filter((s) => s.xp !== s.originalXp || s.gold !== s.originalGold || s.hearts !== s.originalHearts)
        .map((s) =>
          getPlayerState(classId, s.id)
            .catch(() => null) // Handling player state does not exist
            .then((state) =>
              upsertPlayerState(classId, s.id, {
                current_xp: s.xp !== s.originalXp ? s.xp : (state?.current_xp ?? 0),
                total_xp_earned: s.xp !== s.originalXp ? s.xp : (state?.total_xp_earned ?? 0),
                xp_to_next_level: state?.xp_to_next_level ?? 100,
                hearts: s.hearts !== s.originalHearts ? s.hearts : (state?.hearts ?? 5),
                max_hearts: state?.max_hearts ?? 5,
                gold: s.gold !== s.originalGold ? s.gold : (state?.gold ?? 0),
                status: state?.status ?? "ALIVE",
              })
            )
        );

      // Execute all updates in parallel
      await Promise.all([...profileUpdates, ...passwordUpdate, ...playerStateUpdates]);

      // Log reward transactions for teacher XP/Gold adjustments
      const statChangedStudents = updates.filter(
        (s) => s.xp !== s.originalXp || s.gold !== s.originalGold || s.hearts !== s.originalHearts
      );

      if (statChangedStudents.length > 0 && classId && teacher) {
        await Promise.all(
          statChangedStudents.map(async (s) => {
            const xpDelta = s.xp - s.originalXp;
            const goldDelta = s.gold - s.originalGold;
            const heartsDelta = s.hearts - s.originalHearts;

            const parts: string[] = [];
            if (xpDelta !== 0) parts.push(`${xpDelta > 0 ? "+" : ""}${xpDelta} XP`);
            if (goldDelta !== 0) parts.push(`${goldDelta > 0 ? "+" : ""}${goldDelta} Gold`);
            if (heartsDelta !== 0) parts.push(`${heartsDelta > 0 ? "+" : ""}${heartsDelta} Hearts`);

            try {
              await createTransaction({
                student_id: s.id,
                class_id: classId,
                xp_delta: xpDelta,
                gold_delta: goldDelta,
                hearts_delta: heartsDelta,
                source_type: "MANUAL_ADJUSTMENT",
                reason: `Teacher adjustment: ${parts.join(", ")}`,
              });
            } catch (Err) {
              console.warn(`Failed to log reward transaction for student ${s.id}:`, Err);
            }
          })
        );
      }

      // Update original values to mark as saved
      setRows((prevRows) =>
        prevRows.map((s) => ({
          ...s,
          originalUsername: s.username,
          originalDisplayName: s.displayName,
          originalPassword: s.password,
          originalXp: s.xp,
          originalGold: s.gold,
          originalHearts: s.hearts,
        }))
      );

      setUnsavedChanges(false);
    } catch (err: any) {
      console.error("Error saving changes:", err);
      setGlobalError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q)
    );
  }, [query, rows]);

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                {/* Logo and Nav Links */}
                <Link
                  to="/teacher/dashboard"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Classes</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
             <DropDownProfile
                                      username={teacher?.displayName || "user"}
                                      onLogout={() => {
                                        localStorage.removeItem("cq_currentUser");
                                        navigate("/TeacherLogin");
                                      }}
                                      onProfileClick={() => setIsProfileModalOpen(true)}
                                    />
            </div>
          </div>
        </div>
      </nav>

      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => {
            if (unsavedChanges) {
              alert("You have unsaved changes. Please save before leaving.");
              return;
            }
            navigate("/classes");
          }}
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">Students</h1>
            <p className="text-white">Manage students in your class</p>
          </div>
        </div>

        {/* Global error message */}
        {globalError && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <div className="flex items-center gap-2">
              <i data-feather="alert-circle" className="w-5 h-5"></i>
              <span>{globalError}</span>
            </div>
          </div>
        )}

        {/* Heart Regeneration Settings */}
        <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-gray-900 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <i data-feather="heart" className="w-4 h-4 text-red-500"></i>
              <span className="text-sm font-bold text-gray-800">Heart Regen</span>
            </div>

            {/* Enable / Disable toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
              <button
                type="button"
                onClick={() => setRegenEnabled(true)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  regenEnabled ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => setRegenEnabled(false)}
                className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-300 ${
                  !regenEnabled ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Off
              </button>
            </div>

            {/* Interval input */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 whitespace-nowrap">Every</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={regenIntervalHours}
                disabled={!regenEnabled}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setRegenIntervalHours(v);
                }}
                className={`w-20 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  !regenEnabled ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200" : "border-gray-300"
                }`}
              />
              <span className="text-sm text-gray-600">hrs</span>
            </div>

            {/* Apply button */}
            <button
              type="button"
              disabled={regenSaving || !classId || rows.filter((s) => !s.error).length === 0}
              onClick={handleSaveRegenSettings}
              className={`px-4 py-1.5 rounded-lg text-white font-medium text-sm transition-colors ${
                regenSaving || !classId || rows.filter((s) => !s.error).length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {regenSaving ? "Applying..." : "Apply to All"}
            </button>

            {regenMessage && (
              <span className={`text-xs font-medium ${regenMessage.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
                {regenMessage.kind === "ok" ? "✓" : "✗"} {regenMessage.text}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
          <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
            <h2 className="text-xl font-bold">Students in your class</h2>

            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full border border-gray-300 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <i
                data-feather="search"
                className="absolute left-3 top-2.5 text-gray-400"
              ></i>
            </div>
          </div>

          {!teacherClassCode ? (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
              <p className="font-medium">No class selected</p>
              <p className="mt-1">Go to <Link to="/classes" className="text-blue-600 underline">Classes</Link> to create or select a class first.</p>
            </div>
          ) : globalError === "Class not found" ? (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
              <p className="font-medium">Class "{teacherClassCode}" not found in database</p>
              <p className="mt-1">This class code doesn't exist in the backend. Go to <Link to="/classes" className="text-blue-600 underline">Classes</Link> to create a new class.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
              No students have joined yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Username
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Displayname
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Password
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      XP
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Gold
                    </th>
                     <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Hearts
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((s) => (
                    <tr key={s.id} className={s.error ? "bg-red-50" : ""}>
                      {/* Username column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.error ? (
                          <div className="text-sm text-red-600 font-medium">{s.username}</div>
                        ) : (
                          <div className="text-sm font-semibold text-gray-900">
                            <input
                              type="text"
                              value={s.username}
                              onChange={(e) =>
                                updateStudentField(s.id, "username", e.target.value)
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      { /* <div className="text-xs text-gray-500 break-all mt-1">{s.id}</div>*/}
                      </td>

                      {/* Display Name column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.error ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <input
                            type="text"
                            value={s.displayName}
                            onChange={(e) =>
                              updateStudentField(s.id, "displayName", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </td>

                      {/* Password column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.error ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type={visiblePasswords.has(s.id) ? "text" : "password"}
                              value={s.password}
                              onChange={(e) =>
                                updateStudentField(s.id, "password", e.target.value)
                              }
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(s.id)}
                              className="text-gray-500 hover:text-gray-700"
                              title={visiblePasswords.has(s.id) ? "Hide password" : "Show password"}
                            >
                              <i 
                                data-feather={visiblePasswords.has(s.id) ? "eye-off" : "eye"}
                                className="w-4 h-4"
                              ></i>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* XP column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img src={xpIcon} alt="xp" className="h-8 w-8" />

                          {s.error ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <input
                              type="number"
                              value={s.xp}
                              onChange={(e) =>
                                updateStudentField(s.id, "xp", parseInt(e.target.value) || 0)
                              }
                              className="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </td>
                      {/* Gold column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src="/assets/icons/gold-bar.png"
                            alt="Gold"
                            className="h-5 w-5"
                          />
                          {s.error ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <input
                              type="number"
                              value={s.gold}
                              onChange={(e) =>
                                updateStudentField(s.id, "gold", parseInt(e.target.value) || 0)
                              }
                              className="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </td>

                      {/* Hearts column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <i data-feather="heart" className="w-5 h-5 text-red-500 fill-red-500 inline" />
                          {s.error ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <select
                              value={s.hearts}
                              onChange={(e) =>
                                updateStudentField(s.id, "hearts", parseInt(e.target.value) || 0)
                              }
                              className="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {[0, 1, 2, 3, 4, 5].map((num) => (
                                <option key={num} value={num}>
                                  {num}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* Status indicator */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {s.error ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                              Error
                            </span>
                            <button
                              onClick={() => handleRemoveStudent(s.id, s.enrollmentId)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                              title="Remove enrollment"
                            >
                              Remove
                            </button>
                          </div>
                        ) : s.username !== s.originalUsername ||
                          s.displayName !== s.originalDisplayName ||
                          s.password !== s.originalPassword ||
                          s.xp !== s.originalXp ||
                          s.gold !== s.originalGold ||
                          s.hearts !== s.originalHearts ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                              Modified
                            </span>
                            <button
                              onClick={() => handleRemoveStudent(s.id, s.enrollmentId)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                              title="Remove enrollment"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              Saved
                            </span>
                            <button
                              onClick={() => handleRemoveStudent(s.id, s.enrollmentId)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                              title="Remove enrollment"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save changes button with warning */}
          <div className="mt-6 flex flex-wrap gap-4 items-center">
            <button
              disabled={!unsavedChanges || saving}
              onClick={handleSaveChanges}
              className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
                unsavedChanges
                  ? "bg-green-600 hover:bg-green-700 cursor-pointer"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {unsavedChanges && (
              <span className="text-sm text-orange-600 font-medium">
                You have unsaved changes
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default Students;
