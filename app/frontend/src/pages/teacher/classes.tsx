import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import feather from "feather-icons";


type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
};

export type TeacherClass = {
  id: string;
  teacherId: string;
  name: string;
  code: string;
  createdAt: string;
};

function generateClassCode(length: number = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeStorageKey(teacherId: string) {
  return `cq_teacherClasses_${teacherId}`;
}

function loadTeacherClasses(teacherId: string): TeacherClass[] {
  const raw = localStorage.getItem(makeStorageKey(teacherId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTeacherClasses(teacherId: string, classes: TeacherClass[]) {
  localStorage.setItem(makeStorageKey(teacherId), JSON.stringify(classes));
}

function makeUniqueCode(existing: Set<string>) {
  let code = generateClassCode(6);
  while (existing.has(code)) code = generateClassCode(6);
  return code;
}

const Classes = () => {
  const navigate = useNavigate();

  // ✅ Teacher guard (same pattern as your dashboard)
  const teacher = useMemo<TeacherUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role === "teacher") return parsed;
    } catch {}
    return null;
  }, []);

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;

  const teacherId = teacher.id || "teacher-123";

  const [classes, setClasses] = useState<TeacherClass[]>(() => loadTeacherClasses(teacherId));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [error, setError] = useState<string>("");

  // ✅ icons
  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    feather.replace();
  }, [isModalOpen, classes]);

  // ✅ persist to localStorage
  useEffect(() => {
    saveTeacherClasses(teacherId, classes);
  }, [teacherId, classes]);

  function handleOpenModal() {
    setError("");
    setClassName("");
    setIsModalOpen(true);
  }

  function handleCreateClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const name = className.trim();
    if (!name) {
      setError("Please enter a class name (e.g. Math 10A).");
      return;
    }

    const existingCodes = new Set(classes.map((c) => c.code.toUpperCase()));
    const code = makeUniqueCode(existingCodes);

    const newClass: TeacherClass = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
      teacherId,
      name,
      code,
      createdAt: new Date().toISOString(),
    };

    // ✅ keep your current local join system working (safe to remove later)
    try {
      ensureClassExists(code, teacherId);
    } catch {
      // ignore if classStore path changes
    }

    setClasses((prev) => [newClass, ...prev]);
    setIsModalOpen(false);
  }

  function handleDeleteClass(id: string) {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
  }

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
      {/* Nav (similar vibe to Subjects) */}
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
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Quests
              </Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Activity
              </Link>
              {/* If you want the real dropdown later, add it back here */}
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
            <h1 className="text-3xl font-bold text-indigo-800">Class Management</h1>
            <p className="text-white">Create and manage multiple classes with unique join codes.</p>
          </div>

          <button
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
            onClick={handleOpenModal}
          >
            <i data-feather="plus" className="mr-2"></i> Create Class
          </button>
        </div>

        {/* Cards */}
        {classes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
            No classes yet. Click <b>Create Class</b> to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((c) => (
              <div key={c.id} className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300">
                {/* Card header gradient */}
                <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-6 text-white text-center">
                  <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                    <i data-feather="layers" className="w-10 h-10 text-gray-800"></i>
                  </div>
                  <h3 className="text-xl font-bold">{c.name}</h3>
                  <p className="text-white/80 text-sm">
                    Created {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Extra clear name */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-xs tracking-widest text-indigo-700 font-semibold">CLASS NAME</p>
                    <p className="mt-1 text-lg font-bold text-indigo-900">{c.name}</p>
                  </div>

                  {/* Code */}
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-xs tracking-widest text-gray-500 font-semibold">CLASS CODE</p>
                    <p className="text-sm text-gray-700 mt-1">
                      Code for <span className="font-bold text-gray-900">{c.name}</span>
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-2xl font-extrabold tracking-[0.35em] text-indigo-700">{c.code}</p>
                      <button
                        onClick={() => handleCopy(c.code)}
                        className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Copy
                      </button>
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      Students enter this code during signup to join this class.
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => navigate(`/students?classCode=${encodeURIComponent(c.code)}`)}
                    >
                      <i data-feather="users" className="mr-1 w-4 h-4"></i> Students
                    </button>

                    <button
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => alert("Settings page later")}
                    >
                      <i data-feather="settings" className="mr-1 w-4 h-4"></i> Settings
                    </button>

                    <button
                      className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => navigate("/Subjects")}
                    >
                      <i data-feather="plus-circle" className="mr-1 w-4 h-4"></i> Create Quest
                    </button>

                    <button
                      className="col-span-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center"
                      onClick={() => handleDeleteClass(c.id)}
                    >
                      <i data-feather="trash-2" className="mr-1 w-4 h-4"></i> Delete Class
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
              <button onClick={() => setIsModalOpen(false)} className="text-blue-500 hover:text-blue-700">
                <i data-feather="x-circle"></i>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateClass}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Math 10A"
                  required
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
