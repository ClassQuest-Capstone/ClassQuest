import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import StatsCard from "../components/teacher/statsCard";
import { fetchTeacherStats, TeacherStats } from "../features/teacher/teacherService";
import { CurrencyDollarIcon } from "@heroicons/react/24/solid";
import DropDownProfile from "../features/teacher/dropDownProfile";

{/** Todo: seprate dash board components into different files */}
const TeacherDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<TeacherStats>({
    activeStudents: 0,
    activeSubjects: 0,
    activeTasks: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    feather.replace();
  }, [sidebarOpen]);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      // Replace "teacher-123" with actual ID from auth
      const teacherId = localStorage.getItem("teacherId") || "teacher-123";
      const data = await fetchTeacherStats(teacherId);
      setStats(data);
      setLoading(false);
    };

    loadStats();
  }, []);

  // Replace all feather icons after component mounts and when content updates
  useEffect(() => {
    const timer = setTimeout(() => {
      feather.replace();
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, stats]);

  // Also replace icons on initial mount
  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    feather.replace();
  }, [sidebarOpen]);

  function reloadelements() {
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  }


  const sidebarLinks = [
    { icon: "home", label: "Dashboard", href: "/TeacherDashboard",},
    { icon: "users", label: "Students", href: "#" },
    { icon: "book", label: "Quests", href: "/subjects" },
    { icon: "clock", label: "Activity", href: "#" },
    { icon: "shopping-bag", label: "Rewards", href: "/rewards" },
    { icon: "settings", label: "Settings", href: "#" },
  ];

  return (
    <div className="font-poppins min-h-screen bg-[url(/assets/background-teacher-dash.png)] bg-center bg-cover bg-no-repeat flex">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
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
              {sidebarLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-blue-100 hover:text-white hover:bg-blue-600"
                >
                  <i
                    data-feather={link.icon}
                    className="mr-3 h-6 w-6 text-blue-200"
                  ></i>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="shrink-0 flex border-t border-blue-800 p-4">
            <a href="#" className="shrink-0 group block">
              <div className="flex items-center">
                <div>
                  <img
                    className="inline-block h-9 w-9 rounded-full"
                    src="/assets/warrior-head.png"
                    alt="Profile"
                  />
                </div>
               
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

            <nav className="mt-5 flex-1 px-2 space-y-1">
              {sidebarLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-blue-100 hover:text-white hover:bg-blue-600"
                >
                  <i
                    data-feather={link.icon}
                    className="mr-3 h-6 w-6 text-blue-200"
                  ></i>
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="shrink-0 flex border-t border-blue-800 p-4">
              <a href="#" className="shrink-0 group block w-full">
                <div className="flex items-center">
                  <div>
                    <img
                      className="inline-block h-9 w-9 rounded-full"
                      src="/assets/warrior-head.png"
                      alt="Profile"
                    />
                    <p className="text-white"> Profile </p>
                  </div>
                  
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      <div className="flex-1 flex flex-col overflow-hidden">
       
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white/300 bg-center bg-cover bg-no-repeat">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-white hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <i data-feather="menu" className="h-6 w-6"></i>
          </button>
        </div>

        {/* Search bar  and profile/logout*/}
        <div className="bg-white/300 p-4 flex items-center  space-x-5">
          <i data-feather="search" className="w-6 h-6 mr-5 text-gray-900"></i>
          <input
            type="text"
            placeholder="search.."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 focus:ring-blue-500"
          />
          <DropDownProfile username="user"onLogout={() => {console.log("Logging out"); /**TODO: Logout logic */}}/>

        </div>

        {/* Students stats */}
        <main className="flex-1 overflow-y-auto p-4 ml-3 mr-3">
          <p className="text-2xl font-bold text-indigo-600">Teacher Dashboard</p>
          
          {loading ? (
            <div className="mt-6 text-center text-gray-500">Loading stats...</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
              <StatsCard
                icon="users"
                label="Active Students"
                value={stats.activeStudents}
              />
              <StatsCard
                icon="book"
                label="Active Subjects"
                value={stats.activeSubjects}
              />
              <StatsCard
                icon="award"
                label="Active Tasks"
                value={stats.activeTasks}
              />
              <StatsCard
                icon="check-circle"
                label="Completion Rate"
                value={`${stats.completionRate}%`}
              />
            </div>
          )}

          {/**Static pages for now */}
          <div>
            <p className="text-2xl font-bold text-indigo-500 mt-6"> Recent Activity</p>
            <div className="mt-4 p-4 bg-white/300 rounded-lg shadow-md">
                        <div className=" bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                <li>
                                    <a href="#" className="block hover:bg-gray-300">
                                        <div className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-primary-600 truncate text-gray-900">
                                                    Michael completed Algebra Quiz
                                                </p>
                                                <div className="ml-2 flex-shrink-0 flex">
                                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        +150 XP
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:flex sm:justify-between">
                                                <div className="sm:flex">
                                                    <p className="flex items-center text-sm text-gray-500">
                                                        <i data-feather="user" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                                                        Michael Johnson
                                                    </p>
                                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                                        <i data-feather="calendar" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                                                        <span>November 24, 2025</span>
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                                    <i data-feather="clock" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                                                    <span>
                                                        2h ago
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                                 <li>
                                    <a href="#" className="block hover:bg-gray-300">
                                        <div className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-primary-600 truncate text-gray-900">
                                                    You added a new shield
                                                </p>
                                                <div className="ml-2 flex-shrink-0 flex">
                                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        New Reward
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:flex sm:justify-between">
                                                <div className="sm:flex">
                                                    <p className="flex items-center text-sm text-gray-500">
                                                        <i data-feather="shield" className="flex-shrink-0 mr-1.5 h-5 w-5 text-yellow-500"></i>
                                                        Gold shield
                                                    </p>
                                                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                                        <i data-feather="calendar" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                                                        <span>November 24, 2025</span>
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                                    <i data-feather="clock" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                                                    <span>
                                                        5m ago
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                </li>
                                </ul>  
                            </div>
                        </div>
          </div>
          {/** Top students page (dynamic logic to be added) */} 
          <div className="mt-5"> 
            <p className="text-2xl font-bold text-indigo-500 mt-6"> Top Students</p>
             <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="bg-gradient-to-r from-gray-200 to-gray-500 overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                          <div className="flex items-center">
                              <div className="shrink-0">
                                  <img className="h-12 w-12 rounded-full" src="/assets/mage-head.png" alt=""/>
                              </div>
                              <div className="ml-4">
                                  <h3 className="text-lg font-medium text-gray-900">Emma Smith</h3>
                                  <div className="flex items-center mt-1">
                                      <div className="h-2 w-24 bg-gray-500 rounded-full overflow-hidden">
                                          <div className="h-full bg-green-500 rounded-full"></div>
                                      </div>
                                      <span className="ml-2 text-sm text-gray-900">Level 8</span>
                                  </div>
                              </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Total XP</p>
                                  <p className="text-xl font-semibold text-gray-900">4,850</p>
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Gold</p>
                                
                                 <p className=" flex items-center text-xl font-semibold text-gray-900"> <CurrencyDollarIcon className="h-6 w-6 text-yellow-500" /> 1,250</p>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="bg-gradient-to-r from-gray-200 to-gray-500 overflow-hidden shadow rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                          <div className="flex items-center">
                              <div className="shrink-0">
                                  <img className="h-12 w-12 rounded-full" src="/assets/warrior-head.png" alt=""/>
                              </div>
                              <div className="ml-4">
                                  <h3 className="text-lg font-medium text-gray-900">Olivia brown</h3>
                                  <div className="flex items-center mt-1">
                                      <div className="h-2 w-24 bg-gray-500 rounded-full overflow-hidden">
                                          <div className="h-full bg-green-500 rounded-full"></div>
                                      </div>
                                      <span className="ml-2 text-sm text-gray-900">Level 6</span>
                                  </div>
                              </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Total XP</p>
                                  <p className="text-xl font-semibold text-gray-900">3,750</p>
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Gold</p>
                                
                                 <p className=" flex items-center text-xl font-semibold text-gray-900"> <CurrencyDollarIcon className="h-6 w-6 text-yellow-500" /> 850</p>
                              </div>
                          </div>
                      </div>
                  </div>
                  </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
