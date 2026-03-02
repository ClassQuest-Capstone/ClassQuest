import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import QuizStats from "../features/teacher/quizStats.js";
import ActivityCard from "../features/teacher/ActivityCard.js";
import { useTeacherActivity, ActivityCategory } from "../hooks/teacher/useTeacherActivity.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

type Tab = "Activity" | "Stats";
type Filter = "ALL" | ActivityCategory;

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All Activities" },
  { value: "QUEST_COMPLETED", label: "Quest Completions" },
  { value: "BOSS_BATTLE", label: "Boss Battles" },
  { value: "TEACHER_ADJUSTMENT", label: "Teacher Adjustments" },
];

const ActivityPage = () => {
  const navigate = useNavigate(); 
  const [activeTab, setActiveTab] = useState<Tab>("Activity");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  // Load teacher data from localStorage
  useEffect(() => {
    const currentUserJson = localStorage.getItem("cq_currentUser");
    if (currentUserJson) {
      try {
        const teacherData = JSON.parse(currentUserJson) as TeacherUser;
        setTeacher(teacherData);
      } catch (error) {
        console.error("Failed to parse teacher data from localStorage:", error);
      }
    }
  }, []);

  // Fetch activity from reward transactions
  const { activities, loading, error } = useTeacherActivity(teacher?.id);

  const filtered = filter === "ALL" ? activities : activities.filter((a) => a.category === filter);

  useEffect(() => {
    feather.replace();
  });

  const tabClass = (tab: Tab) =>
    `py-4 px-1 text-center border-b-2 font-bold text-xl ${
      activeTab === tab
        ? "border-yellow-500 text-yellow-300"
        : "border-transparent text-white hover:text-gray-700 hover:border-gray-300"
    }`;

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
              <nav className="bg-blue-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex items-center">
                      <div className="shrink-0 flex items-center">
                         {/* Logo and Nav Links */}
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
                      <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
                      <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Classes</Link>
                      <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
                      <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Activity</Link>
                      <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
                      <Link to="/profile" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Profile</Link>
                      <DropDownProfile
                                            username={teacher?.displayName || "user"}
                                            onLogout={() => {
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
                  <Link to="/teacherDashboard" className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700">
                    <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                    <span className="text-sm font-medium">Back</span>
                  </Link>
                </div>
      {/* Page content*/}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-yellow-300">Activity</h1>
        <p className="text-white mb-6">
          View your students' activity log and measure their performance
        </p>

        {/* Tabs */}
        <div className="mb-6 flex justify-center">
          <nav className="flex space-x-8">
            <button className={tabClass("Activity")} onClick={() => setActiveTab("Activity")}>
              Activity
            </button>
            <button className={tabClass("Stats")} onClick={() => setActiveTab("Stats")}>
              Stats
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === "Activity" && (
          <div className="bg-white/20 backdrop-blur-md rounded-lg p-6 text-white shadow-lg">
            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                    filter === opt.value
                      ? "bg-yellow-400 text-gray-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {loading ? (
              <p>Loading recent activity...</p>
            ) : error ? (
              <p className="text-red-300">Error: {error}</p>
            ) : filtered.length === 0 ? (
              <p>No activity found{filter !== "ALL" ? " for this filter" : ""}.</p>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {filtered.map((item) => (
                    <ActivityCard key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "Stats" && (
          <div className="mt-6">
            {/** Render pie chart component (switch from pie chart to leader boards across all classes (filter by class)) */}
            <QuizStats />
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityPage;
