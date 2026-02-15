// src/pages/teacher/classes.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import { fetchAuthSession } from "aws-amplify/auth";

import {
  createClass,
  listClassesByTeacher,
  deactivateClass,
  type ClassItem,
} from "../../api/classes.js";

import { getTeacherProfile } from "../../api/teacherProfiles.js";

// Teacher interface
type TeacherUser = {
  id: string;
  role: "teacher";
  school_id: string;
  displayName?: string;
  email?: string;
};

// Teacher context
type TeacherContext = {
  teacher_id: string;
  school_id: string;
};

type TeacherClass = ClassItem;

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
  // 1) try localStorage (TeacherUser id)
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

const Classes = () => {
  const navigate = useNavigate();

  // Teacher guard (same pattern as dashboard)
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

  // we’ll prefer the resolved context values (so school_id is always correct)
  const [teacherCtx, setTeacherCtx] = useState<TeacherContext | null>(null);

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number>(6);
  const [subject, setSubject] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeClasses = useMemo(
    () => classes.filter((c) => c.is_active !== false),
    [classes]
  );

  async function refreshClasses(teacherId: string) {
    const response = await listClassesByTeacher(teacherId);
    setClasses(response.items || []);
  }

  // Load teacher context + classes on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const ctx = await resolveTeacherContext();
        if (!mounted) return;
        setTeacherCtx(ctx);

        await refreshClasses(ctx.teacher_id);
      } catch (err: any) {
        console.error("Error loading classes:", err);
        if (!mounted) return;
        setError(err?.message || "Failed to load classes. Please try again.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // icons
  useEffect(() => {
    feather.replace();
  }, [isModalOpen, classes, loading]);

  function handleOpenModal() {
    setError("");
    setClassName("");
    setGradeLevel(6);
    setSubject("");
    setIsModalOpen(true);
  }

  async function handleCreateClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!teacherCtx) {
      setError("Teacher context not loaded yet. Try again in a second.");
      return;
    }

    const name = className.trim();
    if (!name) {
      setError("Please enter a class name (e.g. Math 10A).");
      return;
    }

    if (gradeLevel < 5 || gradeLevel > 8) {
      setError("Grade level must be between 5 and 8.");
      return;
    }

    try {
      setIsCreating(true);

      const newClass = await createClass({
        school_id: teacherCtx.school_id,
        name,
        grade_level: gradeLevel,
        created_by_teacher_id: teacherCtx.teacher_id,
        subject: subject.trim() ? subject.trim() : undefined,
      });

      // optimistic add
      setClasses((prev) => [newClass, ...prev]);

      setIsModalOpen(false);
      setClassName("");
      setGradeLevel(6);
      setSubject("");

      // refresh to match backend truth
      await refreshClasses(teacherCtx.teacher_id);
    } catch (err: any) {
      console.error("Error creating class:", err);
      setError(err?.message || "Failed to create class. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteClass(classId: string) {
    if (!teacherCtx) return;

    if (!confirm("Deactivate this class? Students won’t be able to join anymore.")) {
      return;
    }

    try {
      setError("");
      await deactivateClass(classId);

      // remove locally + refresh
      setClasses((prev) => prev.filter((c) => c.class_id !== classId));
      await refreshClasses(teacherCtx.teacher_id);
    } catch (err: any) {
      console.error("Error deactivating class:", err);
      setError(err?.message || "Failed to deactivate class. Please try again.");
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000)
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
                to="/classes"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          to="/teacherDashboard"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">
              Class Management
            </h1>
            <p className="text-white">
              Create and manage multiple classes with unique join codes.
            </p>
          </div>

          <button
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
            onClick={handleOpenModal}
          >
            <i data-feather="plus" className="mr-2"></i> Create Class
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-white rounded-xl shadow-md p-4 text-red-600 mb-6">
            {error}
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            <p>Loading classes...</p>
          </div>
        ) : activeClasses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
            No classes yet. Click <b>Create Class</b> to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeClasses.map((c) => (
              <div
                key={c.class_id}
                className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
              >
                {/* Card header gradient */}
                <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-6 text-white text-center">
                  <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                    <i data-feather="layers" className="w-10 h-10 text-gray-800"></i>
                  </div>
                  <h3 className="text-xl font-bold">{c.name}</h3>
                  <p className="text-white/80 text-sm">
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Extra clear name */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs tracking-widest text-indigo-700 font-semibold">
                      CLASS NAME
                    </p>
                    <p className="mt-1 text-lg font-bold text-indigo-900">
                      {c.name}
                    </p>
                  </div>

                  {/* Grade Level */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs tracking-widest text-purple-700 font-semibold">
                      GRADE LEVEL
                    </p>
                    <p className="mt-1 text-lg font-bold text-purple-900">
                      Grade {c.grade_level}
                    </p>
                  </div>

                  {/* Code */}
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-xs tracking-widest text-gray-500 font-semibold">
                      CLASS CODE
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      Code for{" "}
                      <span className="font-bold text-gray-900">{c.name}</span>
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-2xl font-extrabold tracking-[0.35em] text-indigo-700">
                      {c.join_code}
                    </p>

                    <button
                      onClick={() => handleCopy(c.join_code)}
                      className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Copy
                    </button>
                  </div>
                      {copied && (
                        <div className="mt-2 rounded-md bg-green-100 text-green-800 px-3 py-1 text-sm font-medium w-fit">
                          Copied to clipboard!
                        </div>
                      )}

                    <p className="mt-2 text-sm text-gray-600">
                      Students enter this code during signup to join this class.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() =>
                        navigate(
                          `/students?classCode=${encodeURIComponent(c.join_code)}`
                        )
                      }
                    >
                      <i data-feather="users" className="mr-1 w-4 h-4"></i>{" "}
                      Students
                    </button>

                    <button
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => alert("rewards page later")}
                    >
                      <i data-feather="gift" className="mr-1 w-4 h-4"></i>{" "}
                      Rewards
                    </button>

                    {/*<button
                      className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => navigate("/Subjects", { state: { openCreateQuest: true, class_id: c.class_id } })}
                    >
                      <i data-feather="plus-circle" className="mr-1 w-4 h-4"></i>{" "}
                      Create Quest
                    </button>*/}
                    <button
                      className="col-span-2 bg-purple-600 hover:bg-purple-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => navigate("/ClassQuest", { state: { class_id: c.class_id, className: c.name } })}
                    >
                      <i data-feather="eye" className="mr-1 w-4 h-4"></i>{" "}
                      View Quests
                    </button>

                    <button
                      className="col-span-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => handleDeleteClass(c.class_id)}
                    >
                      <i data-feather="trash-2" className="mr-1 w-4 h-4"></i>{" "}
                      Delete Class
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Class</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-blue-500 hover:text-blue-700"
                disabled={isCreating}
              >
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateClass}>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                  {error}
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Math 10A"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value={5}>Grade 5</option>
                  <option value={6}>Grade 6</option>
                  <option value={7}>Grade 7</option>
                  <option value={8}>Grade 8</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Mathematics"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                  disabled={isCreating || !teacherCtx}
                >
                  {isCreating ? "Creating..." : "Create Class"}
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
    </div>
  );
};

export default Classes;