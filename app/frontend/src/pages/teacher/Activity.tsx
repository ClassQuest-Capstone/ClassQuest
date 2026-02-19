import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import QuizStats from "../features/teacher/quizStats.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

type Tab = "Activity" | "Stats";

const ActivityPage = () => {
  const navigate = useNavigate(); 
  const [activeTab, setActiveTab] = useState<Tab>("Activity"); // Default to activity tab
  const [recentActivity, setRecentActivity] = useState<any[]>([]); // Recent activity data
  const [loading, setIsLoading] = useState(false); // Loading state
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  useEffect(() => {
    feather.replace();
  });

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

  // Fetch recent activity from AWS
  useEffect(() => {
    if (activeTab !== "Activity") return;

    const fetchActivity = async () => {
      try {
        setIsLoading(true);

        const response = await fetch(
          "https://your-api-url.amazonaws.com/activity" // Replace with AWS endpoint (TODO:)
        );

        const data = await response.json();
        setRecentActivity(data.activities || []);
      } catch (error) {
        console.error("Error fetching activity:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [activeTab]);

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
            {loading ? (
              <p>Loading recent activity...</p>
            ) : recentActivity.length === 0 ? (
              <p>No recent activity found.</p>
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((item, index) => (
                  <li
                    key={index}
                    className="p-4 bg-white/10 rounded-lg border border-white/20 shadow"
                  >
                    <p className="font-semibold">{item.studentName}</p>
                    <p className="text-sm">{item.action}</p>
                    <p className="text-xs opacity-70">{item.timestamp}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "Stats" && (
          <div className="mt-6">
            {/** Render pie chart component */}
            <QuizStats />
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityPage;
