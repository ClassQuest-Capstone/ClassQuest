import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";

import { getClass } from "../../utils/classStore";

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
  name: string;
  level: number;
  xp: number;
  gold: number;
};

const Students = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);

  // ✅ read teacher
  const teacher = useMemo<CurrentUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CurrentUser;
      if (parsed?.role === "teacher") return parsed;
    } catch {}
    return null;
  }, []);

  // ✅ Guard: not logged in as teacher
  if (!teacher || teacher.role !== "teacher") {
    return <Navigate to="/TeacherLogin" replace />;
  }

  // ✅ teacher class code
  const teacherClassCode =
    (teacher.classCode || "").trim().toUpperCase() ||
    (localStorage.getItem("cq_teacherClassCode") || "").trim().toUpperCase();

  useEffect(() => {
    feather.replace();
  });

  // ✅ Load joined students from localStorage class record
  useEffect(() => {
    if (!teacherClassCode) {
      setRows([]);
      return;
    }

    const cls = getClass(teacherClassCode);
    const studentIds = cls?.studentIds || [];

    // For now we don’t have student profiles to show, so use IDs as names.
    // Later: fetch from backend by these IDs.
    const mapped: StudentRow[] = studentIds.map((id, idx) => ({
      id,
      name: `Student ${idx + 1}`, // fallback display name
      level: 1,
      xp: 0,
      gold: 0,
    }));

    setRows(mapped);
  }, [teacherClassCode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
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
                username={teacher.displayName || "user"}
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
        <Link
          to="/teacher/dashboard"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-600">Students</h1>
            <p className="text-white">Add and manage students in your class</p>
            <p className="text-white/80 mt-2 text-sm">
              Class Code:{" "}
              <span className="font-bold tracking-widest">
                {teacherClassCode || "------"}
              </span>
            </p>
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
              No class code found for this teacher yet. Go to the dashboard once to generate it.
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
                      Student
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Level
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
                      Passwords
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500 break-all">{s.id}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {s.level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {s.xp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {s.gold}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        —
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900"
                          onClick={() => alert(`Student ID:\n${s.id}`)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Students;
