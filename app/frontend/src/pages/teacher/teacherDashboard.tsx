import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import feather from "feather-icons";
import StatsCard from "../components/teacher/statsCard.js";
import { fetchTeacherStats, TeacherStats, fetchTopStudents, TopStudent } from "../features/teacher/teacherService.js";
import { CurrencyDollarIcon } from "@heroicons/react/24/solid";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import { TutorialProvider } from "../components/tutorial/context.js";
import { TutorialIntroModal } from "../components/tutorial/IntroModal.js";
import { TutorialOverlay } from "../components/tutorial/overlay.js";
import { ensureClassExists } from "../../utils/classStore.js";
import ActivityCard from "../features/teacher/ActivityCard.js";
import { useTeacherActivity } from "../hooks/teacher/useTeacherActivity.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

function generateClassCode(length: number = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids I,O,0,1 confusion
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const TeacherDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<TeacherStats>({
    activeStudents: 0,
    activeSubjects: 0,
    activeTasks: 0,
  });
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ Pull teacher from localStorage (temporary until backend)
  const teacher = useMemo<TeacherUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role === "teacher") return parsed;
    } catch {}
    return null;
  }, []);

  // ✅ Guard
  if (!teacher) {
    return <Navigate to="/TeacherLogin" replace />;
  }

  // ✅ local state for class code so UI updates immediately
  const [classCode, setClassCode] = useState<string>("");

  // ✅ ensure code exists + ensure class record exists
  useEffect(() => {
    const currentUserRaw = localStorage.getItem("cq_currentUser");
    const storedTeacherCode = (localStorage.getItem("cq_teacherClassCode") || "").trim();

    // 1) prefer teacher.classCode
    const fromTeacher = (teacher.classCode || "").trim().toUpperCase();

    // 2) otherwise prefer stored code
    let finalCode = fromTeacher || storedTeacherCode.toUpperCase();

    // 3) otherwise generate
    if (!finalCode) finalCode = generateClassCode(6);

    setClassCode(finalCode);

    // store in teacher code key
    localStorage.setItem("cq_teacherClassCode", finalCode);

    // patch cq_currentUser.classCode too
    if (currentUserRaw) {
      try {
        const parsed = JSON.parse(currentUserRaw);
        parsed.classCode = finalCode;
        localStorage.setItem("cq_currentUser", JSON.stringify(parsed));
      } catch {}
    }

    // ✅ ensure local class record exists so students can join
    ensureClassExists(finalCode, teacher.id || "teacher-123");
  }, [teacher.id, teacher.classCode]);

  useEffect(() => {
    feather.replace();
  }, [sidebarOpen]);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      const teacherId = teacher.id || localStorage.getItem("teacherId") || "teacher-123";
      const data = await fetchTeacherStats(teacherId);
      const topStudentsData = await fetchTopStudents(teacherId);
      setStats(data);
      setTopStudents(topStudentsData);
      setLoading(false);
    };

    loadStats();
  }, [teacher.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      feather.replace();
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, stats]);

  const sidebarLinks = [
    { icon: "home", label: "Dashboard", href: "/teacher/dashboard" },
    { icon: "book", label: "Classes", href: "/classes" },
    { icon: "briefcase", label: "Quest Management", href: "/subjects" },
    { icon: "clock", label: "Activity", href: "/Activity" }, // matches app.tsx
    { icon: "shield", label: "Guilds", href: "/teacherGuilds" },
    { icon: "user", label: "Profile", href: "/profile" },
  ];

  return (
    <div className="font-poppins min-h-screen bg-[url(/assets/background-teacher-dash.png)] bg-center bg-cover bg-no-repeat flex">
      <TutorialProvider>
        <TutorialIntroModal />
        <TutorialOverlay />

        {/* Mobile sidebar */}
        <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? "" : "hidden"}`}>
          <div className="fixed inset-0" onClick={() => setSidebarOpen(false)}>
            <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
          </div>

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-blue-700">
            <div className="absolute top-0 right-0 -mr-14 p-1">
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center h-12 w-12 rounded-full focus:outline-none focus:bg-gray-600"
              >
                <i data-feather="x" className="h-6 w-6 text-white"></i>
              </button>
            </div>

            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="shrink-0 flex items-center px-4">
                <i data-feather="book-open" className="h-8 w-8 text-white mr-2"></i>
                <span className="text-xl font-bold text-white">ClassQuest</span>
              </div>

              <nav className="mt-5 px-2 space-y-1">
                {sidebarLinks.map((link, index) => {
                  const linkId =
                    link.label === "Students"
                      ? "Students"
                      : link.label === "Subjects"
                      ? "quest-tab"
                      : link.label === "Rewards"
                      ? "rewards-panel"
                      : undefined;

                  return (
                    <a
                      key={index}
                      id={linkId}
                      href={link.href}
                      className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-blue-100 hover:text-white hover:bg-blue-600"
                    >
                      <i data-feather={link.icon} className="mr-3 h-6 w-6 text-blue-200"></i>
                      {link.label}
                    </a>
                  );
                })}
              </nav>
            </div>

            <div className="shrink-0 flex border-t border-blue-800 p-4">
              <a href="/profile" className="shrink-0 group block">
                <div className="flex items-center">
                  <img
                    className="inline-block h-8 w-10 rounded-full"
                    src="/assets/warrior-head.png"
                    alt="Profile"
                  />
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col grow pt-5 pb-4 overflow-y-auto bg-blue-700">
              <div className="flex items-center shrink-0 px-4">
                <i data-feather="book-open" className="h-8 w-8 text-white mr-2"></i>
                <span className="text-xl font-bold text-white">ClassQuest</span>
              </div>

              <nav id="nav-menu" className="mt-5 flex-1 px-2 space-y-1">
                {sidebarLinks.map((link, index) => {
                  const linkId =
                    link.label === "Students"
                      ? "Students"
                      : link.label === "Subjects"
                      ? "quest-tab"
                      : link.label === "Rewards"
                      ? "rewards-panel"
                      : undefined;

                  return (
                    <a
                      key={index}
                      id={linkId}
                      href={link.href}
                      className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-blue-100 hover:text-white hover:bg-blue-600"
                    >
                      <i data-feather={link.icon} className="mr-3 h-6 w-6 text-blue-200"></i>
                      {link.label}
                    </a>
                  );
                })}
              </nav>

              <div className="shrink-0 flex border-t border-blue-800 p-4">
                <a href="/profile" className="shrink-0 group block w-full">
                  <div className="flex items-center">
                    <div>
                      <img
                        className="inline-block h-9 w-9 rounded-full"
                        src="/assets/warrior-head.png"
                        alt="Profile"
                      />
                      <p className="text-white"> {teacher?.displayName} </p>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/5 backdrop-blur-[5px]">
          <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white/300 bg-center bg-cover bg-no-repeat">
            <button
              onClick={() => setSidebarOpen(true)}
              className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-white hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <i data-feather="menu" className="h-6 w-6"></i>
            </button>
          </div>

          {/* Search + profile */}
          <div className="bg-white/300 p-4 flex items-center space-x-5">
            <i data-feather="search" className="w-6 h-6 mr-5 text-gray-900"></i>
            <input
              type="text"
              placeholder="search.."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 focus:ring-blue-500"
            />
            <DropDownProfile
              username={teacher.displayName || "user"}
              onLogout={() => {
                localStorage.removeItem("cq_currentUser");
                navigate("/TeacherLogin");
              }}
            />
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 ml-3 mr-3 ">
            <p className="text-2xl font-bold text-yellow-300">Teacher Dashboard</p>

            {loading ? (
              <div className="mt-6 text-center text-white ">Loading stats...</div>
            ) : (
              <div id="Active-tab" className="mt-3 grid grid-cols-1 gap-8 sm:grid-cols-3 text-xl">
                <StatsCard icon="users" label="Active Students" value={stats.activeStudents} />
                <StatsCard icon="book" label="Active Classes" value={stats.activeSubjects} />
                <StatsCard icon="award" label="Active Quests" value={stats.activeTasks} />
              </div>
            )}

            {/* Recent Activity */}
            <RecentActivitySection teacherId={teacher.id} />

            {/* Top Students */}
            <div className="mt-5">
              <p id="Top-students" className="text-2xl font-bold text-yellow-300 mt-6">
                Top Students
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {topStudents.length === 0 ? (
                  <p className="text-white font-bold text-2xl">No students yet</p>
                ) : (
                  topStudents.map((student) => {
                    const avatars = [ "/assets/mage-head.png", "/assets/warrior-head.png", "/assets/healer-head.png", ];
                    return (
                      <div
                        key={student.student_id}
                        className="bg-gradient-to-r from-gray-200 to-gray-500 overflow-hidden shadow rounded-lg"
                      >
                        <div className="px-4 py-5 sm:p-6">
                          <div className="flex items-center">
                            <div className="shrink-0">
                              
                              <img
                                className="h-12 w-12 rounded-full"
                                src={avatars[Math.floor(Math.random() * avatars.length)]}
                                alt={student.display_name}
                              />
                            </div>
                            <div className="ml-4">
                              <h3 className="text-lg font-bold text-gray-900">
                                {student.display_name}
                              </h3>
                              <p className="text-md font-bold text-green-500"> {student.class_name}</p>
                            
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Total XP</p>
                              <p className="text-xl font-semibold text-gray-900">
                                {(student.total_xp_earned ?? 0).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Gold</p>
                              <p className=" flex items-center text-xl font-semibold text-gray-900">
                                <CurrencyDollarIcon className="h-6 w-6 text-yellow-500" />{" "}
                                {(student.gold ?? 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </main>
        </div>
      </TutorialProvider>
    </div>
  );
};

// Recent Activity section component displays top 5 most recent
const RecentActivitySection: React.FC<{ teacherId: string }> = ({ teacherId }) => {
  const { activities, loading: actLoading, error } = useTeacherActivity(teacherId);
  const top5 = activities.slice(0, 5);

  useEffect(() => {
    feather.replace();
  });

  return (
    <div id="recent-activity">
      <p className="text-2xl font-bold text-yellow-300 mt-6">Recent Activity</p>
      <div className="mt-4 p-4 bg-white/300 rounded-lg shadow-md">
        {actLoading ? (
          <p className="text-white text-sm">Loading activity...</p>
        ) : error ? (
          <p className="text-red-300 text-sm">Failed to load activity</p>
        ) : top5.length === 0 ? (
          <p className="text-white text-sm">No recent activity yet.</p>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {top5.map((item) => (
                <ActivityCard key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
