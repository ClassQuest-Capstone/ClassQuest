// Leaderboard.tsx
import React, { useEffect, useState, useMemo } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import { getStudentProfile, type StudentProfile } from "../../api/studentProfiles.js";
import { getLeaderboard, type PlayerState } from "../../api/playerStates.js";
import { usePlayerProgression, getLevelFromXP } from "../hooks/students/usePlayerProgression.js";

type Tab = "students" | "guilds";

type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  displayName: string;
  level: number;
  totalXP: number;
}

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

const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("students");
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;
  const [classId, setClassId] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
  // From student
  if (student?.classId) {
    setClassId(student.classId);
    return;
  }

  // From localStorage
  const stored = localStorage.getItem("cq_currentClassId");
  if (stored) {
    setClassId(stored);
    return;
  }

  // Fallback → no class
  setClassId(null);
}, [student?.classId]);
  
  const { profile } = usePlayerProgression(
    studentId || "",
    classId || ""
  );

  // Fetch leaderboard data when classId changes
  useEffect(() => {
    if (!classId) {
      setLeaderboardData([]);
      return;
    }

    let cancelled = false;

    const fetchLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(null);

        // Fetch the leaderboard for the class
        const response = await getLeaderboard(classId, 100);
        const playerStates = response?.items ?? [];

        // Fetch student profiles for all players
        const profilesPromise = playerStates.map(async (player: PlayerState) => {
          try {
            const profile = await getStudentProfile(player.student_id);
            return {
              studentId: player.student_id,
              displayName: profile?.display_name ?? "Unknown",
              level: getLevelFromXP(player.total_xp_earned),
              totalXP: player.total_xp_earned,
            };
          } catch (err) {
            // If profile fetch fails, use defaults
            return {
              studentId: player.student_id,
              displayName: "Unknown",
              level: getLevelFromXP(player.total_xp_earned),
              totalXP: player.total_xp_earned,
            };
          }
        });

        const profiles = await Promise.all(profilesPromise);

        // Sort by XP descending and add ranks
        const sorted = profiles.sort((a, b) => b.totalXP - a.totalXP);
        const entriesWithRank = sorted.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

        if (!cancelled) {
          setLeaderboardData(entriesWithRank);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLeaderboardError(err?.message ?? "Failed to load leaderboard");
          console.error("Error loading leaderboard:", err);
        }
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    };

    fetchLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  // Function to get level color based on level ranges
  const getLevelColor = (level: number): string => {
    if (level <= 10) {
      return "bg-blue-100 text-blue-800";
    } else if (level <= 15) {
      return "bg-green-100 text-green-800";
    } else if (level <= 25) {
      return "bg-purple-100 text-purple-800";
    } else {
      return "bg-yellow-100 text-yellow-800";
    }
  };

  useEffect(() => {
    feather.replace();
  }, [activeTab]);

  const pageBg =
    "min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-100/90 backdrop-blur-sm";

  const pageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/background/leaderboards-bg.png')",
  };

  const tabClass = (tab: Tab) =>
    `py-4 px-1 text-center border-b-2 font-medium text-sm ${
      activeTab === tab
        ? "border-indigo-500 text-indigo-600 font-semibold"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`;

  return (
    <div className={pageBg} style={pageStyle}>
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/character" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold"> ClassQuest</span>
                  </Link>
              </div>
            </div>
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              {/* Character (characterpage.tsx) */}
              <Link
                to="/character"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Character
              </Link>
              {/* Guild */}
              <Link to="/guilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                 Guilds
              </Link>
              {/* Leaderboard (this page) */}
              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Leaderboard
              </Link>
              <Link
                to="/shop"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Shop
              </Link>

            <div className="flex items-center ml-4">
            <Link
                to="/shop"
                className="flex items-center bg-primary-600 px-3 py-1 rounded-full hover:bg-primary-700 transition"
            >
                {/* Gold Bar Image */}
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
              <a href="#" className="flex items-center">
                <img
                  className="h-8 w-8 rounded-full"
                  src="http://static.photos/people/200x200/8"
                  alt="Profile"
                />
                <span className="ml-2 text-sm font-medium">{student?.displayName ?? "Student"}</span>
              </a>
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Leaderboards</h1>
          <p className="text-gray-600">
            See how you rank against your classmates
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              className={tabClass("students")}
              onClick={() => setActiveTab("students")}
            >
              Students
            </button>
           {/* <button
              className={tabClass("guilds")}
              onClick={() => setActiveTab("guilds")}
            >
              Guilds
            </button>*/}
          </nav>
        </div>

        {/* Students Leaderboard */}
        {activeTab === "students" && (
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Student Rankings
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Top performing students by XP
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-indigo-400/30 to-indigo-500/30">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Display name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      XP
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leaderboardLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        Loading leaderboard...
                      </td>
                    </tr>
                  ) : leaderboardError ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-red-500">
                        Error: {leaderboardError}
                      </td>
                    </tr>
                  ) : leaderboardData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No students in this class yet.
                      </td>
                    </tr>
                  ) : (() => {
                    const top5 = leaderboardData.slice(0, 5);
                    const currentStudentEntry = leaderboardData.find(
                      (entry) => entry.studentId === studentId
                    );
                    const isCurrentStudentInTop5 = currentStudentEntry && currentStudentEntry.rank <= 5;
                    
                    return (
                      <>
                        {/* Top 5 rows */}
                        {top5.map((entry) => (
                          <tr key={entry.studentId} className={isCurrentStudentInTop5 && entry.studentId === studentId ? 'bg-pink-50' : ''}> 
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-gray-900 font-bold`}>
                                  {entry.rank <= 3 ? (
                                    entry.rank === 1 ? <span className="text-2xl">🥇</span> : entry.rank === 2 ? <span className="text-2xl">🥈</span> : <span className="text-2xl">🥉</span>
                                  ) : (
                                    entry.rank
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">
                                {entry.displayName}
                                {isCurrentStudentInTop5 && entry.studentId === studentId && (
                                  <span className="text-indigo-600 text-xs font-semibold ml-2">(You)</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelColor(entry.level)}`}>
                                Level {entry.level} 
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                              {entry.totalXP.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Current student row if outside top 5 */}
                        {currentStudentEntry && !isCurrentStudentInTop5 && (
                          <>
                            <tr>
                              <td colSpan={4} className="px-6 py-4 text-center text-gray-400 text-sm italic">
                                • • •
                              </td>
                            </tr>
                            <tr className="bg-pink-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 font-bold text-md">
                                    {currentStudentEntry.rank}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{currentStudentEntry.displayName} <span className="text-indigo-600 text-xs font-semibold">(You)</span></div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelColor(currentStudentEntry.level)}`}>
                                  Level {currentStudentEntry.level}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                {currentStudentEntry.totalXP.toLocaleString()}
                              </td>
                            </tr>
                          </>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Guilds Leaderboard */}
        {/*activeTab === "guilds" && (
          <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Guild Rankings
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Top performing guilds by XP
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guild
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leader
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total XP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bosses Defeated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                          1
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src="http://static.photos/education/200x200/25"
                          alt="Guild"
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <div>
                          <div className="font-medium">
                            Equation Eliminators
                          </div>
                          <div className="text-sm text-gray-500">
                            Mrs. Smith&apos;s Class
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      Emma Smith
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">8/8</td>
                    <td className="px-6 py-4 whitespace-nowrap">3,450</td>
                    <td className="px-6 py-4 whitespace-nowrap">7</td>
                  </tr>
                  Add more guild rows here 
                </tbody>
              </table>
            </div>
          </div>
        )}*/}
      </div>
    </div>
  );
};

export default Leaderboard;
