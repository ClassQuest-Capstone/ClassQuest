import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";

import { validateJoinCode } from "../../api/classes.js";
import { getClassEnrollments, unenrollStudent } from "../../api/classEnrollments.js";
import { getStudentProfile, updateStudentProfile } from "../../api/studentProfiles.js";
import { getPlayerState, upsertPlayerState } from "../../api/playerStates.js";
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
  // Track changes for dirty detection
  originalUsername: string;
  originalDisplayName: string;
  originalPassword: string;
  originalXp: number;
  originalGold: number;
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

    const loadStudents = async () => {
      try {
        setGlobalError(null);
        
        // Get class info from join code
        const classInfo = await validateJoinCode(teacherClassCode);
        if (!classInfo) {
          setGlobalError("Class not found");
          setRows([]);
          setClassId(null);
          return;
        }
        
        // Store the class_id for later use
        setClassId(classInfo.class_id);

        // Get enrolled students from backend
        const enrollments = await getClassEnrollments(classInfo.class_id);
        const activeEnrollments = enrollments.items.filter(e => e.status === "active");

        if (activeEnrollments.length === 0) {
          setRows([]);
          return;
        }

        const studentPromises = activeEnrollments.map(async (enrollment) => {
          const id = enrollment.student_id;
          const enrollmentId = enrollment.enrollment_id;
          
          try {
            // Load profile first
            let profile;
            try {
              profile = await getStudentProfile(id);
            } catch (profileErr: any) {
              console.error(`Error loading profile for ${id}:`, profileErr);
              throw new Error(`Profile not found`);
            }

            // Load or create player state
            let playerState;
            try {
              playerState = await getPlayerState(classInfo.class_id, id);
            } catch (stateErr: any) {
              console.warn(`Player state not found for ${id}, using defaults`);
              // Player state doesn't exist yet - use defaults
              playerState = {
                current_xp: 0,
                gold: 0,
              };
            }

            const row: StudentRow = {
              id,
              enrollmentId,
              username: profile.username,
              displayName: profile.display_name,
              password: "",
              xp: playerState.current_xp ?? 0,
              gold: playerState.gold ?? 0,
              originalUsername: profile.username,
              originalDisplayName: profile.display_name,
              originalPassword: "",
              originalXp: playerState.current_xp ?? 0,
              originalGold: playerState.gold ?? 0,
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
              originalUsername: "",
              originalDisplayName: "",
              originalPassword: "",
              originalXp: 0,
              originalGold: 0,
              isLoading: false,
              error: err.message,
            } as StudentRow;
          }
        });

        const loaded = await Promise.all(studentPromises);
        setRows(loaded);
      } catch (err: any) {
        console.error("Error loading students:", err);
        setGlobalError(err.message);
      }
    };

    loadStudents();
  }, [teacherClassCode]);

  // Detect if there are unsaved changes
  const hasChanges = useMemo(() => {
    return rows.some(
      (s) =>
        s.username !== s.originalUsername ||
        s.displayName !== s.originalDisplayName ||
        s.password !== s.originalPassword ||
        s.xp !== s.originalXp ||
        s.gold !== s.originalGold
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
    field: keyof Omit<StudentRow, "originalUsername" | "originalDisplayName" | "originalPassword" | "originalXp" | "originalGold" | "isLoading" | "error">,
    value: string | number
  ) => {
    setRows((prevRows) =>
      prevRows.map((s) =>
        s.id === studentId ? { ...s, [field]: value } : s
      )
    );
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
           s.gold !== s.originalGold)
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

      // Update player states (XP and Gold)
      if (!classId) {
        throw new Error("Class ID not available");
      }
      const playerStateUpdates = updates
        .filter((s) => s.xp !== s.originalXp || s.gold !== s.originalGold)
        .map((s) =>
          getPlayerState(classId, s.id).then((state) =>
            upsertPlayerState(classId, s.id, {
              current_xp: s.xp !== s.originalXp ? s.xp : state.current_xp,
              xp_to_next_level: state.xp_to_next_level,
              total_xp_earned: state.total_xp_earned,
              hearts: state.hearts,
              max_hearts: state.max_hearts,
              gold: s.gold !== s.originalGold ? s.gold : state.gold,
              status: state.status,
            })
          )
        );

      // Execute all updates in parallel
      await Promise.all([...profileUpdates, ...playerStateUpdates]);

      // Update original values to mark as saved
      setRows((prevRows) =>
        prevRows.map((s) => ({
          ...s,
          originalUsername: s.username,
          originalDisplayName: s.displayName,
          originalPassword: s.password,
          originalXp: s.xp,
          originalGold: s.gold,
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
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
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
                  <span className="text-xl font-bold">classQuest</span>
                </Link>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/teacher/dashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/students"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Students
              </Link>
              <Link
                to="/profile"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Profile
              </Link>

              <DropDownProfile
                username={teacher.displayName || " "}
                onLogout={() => {
                  // simple logout
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
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

                      {/* Password column TODO: get password from cognito */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {s.error ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <input
                            type="password"
                            value={s.password}
                            onChange={(e) =>
                              updateStudentField(s.id, "password", e.target.value)
                            }
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
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
                      <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
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
                            className="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 mr-1"
                          />
                        )}

                        <button
                          onClick={() => handleRemoveStudent(s.id, s.enrollmentId)}
                          className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700"
                          title="Remove enrollment"
                        >
                          Remove
                        </button>
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
                          s.gold !== s.originalGold ? (
                          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                            Modified
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                            Saved
                          </span>
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
    </div>
  );
};

export default Students;
