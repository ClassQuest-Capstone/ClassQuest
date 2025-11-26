// Leaderboard.tsx
import React, { useEffect, useState } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";

type Tab = "students" | "guilds";

const Leaderboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("students");

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
                <i data-feather="book-open" className="w-8 h-8 mr-2" />
                <span className="text-xl font-bold">ClassQuest</span>
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

              <div className="flex items-center ml-4">
                <div className="flex items-center bg-blue-600 px-3 py-1 rounded-full">
                  <i
                    data-feather="coins"
                    className="h-5 w-5 text-yellow-400"
                  />
                  <span className="text-white ml-1 font-medium">1,245</span>
                </div>
              </div>
              <a href="#" className="flex items-center">
                <img
                  className="h-8 w-8 rounded-full"
                  src="http://static.photos/people/200x200/8"
                  alt="Profile"
                />
                <span className="ml-2 text-sm font-medium">Alex</span>
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
            <button
              className={tabClass("guilds")}
              onClick={() => setActiveTab("guilds")}
            >
              Guilds
            </button>
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
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      XP
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
                          src="http://static.photos/people/200x200/5"
                          alt="Student"
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <div>
                          <div className="font-medium">Emma Smith</div>
                          <div className="text-sm text-gray-500">
                            The Equation Eliminators
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Mrs. Anderson
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        Level 8
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-red-500 rounded-full mr-2" />
                        <span className="text-sm">Warrior</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      4,850
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">5</td>
                  </tr>

                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold">
                          2
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src="http://static.photos/people/200x200/6"
                          alt="Student"
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <div>
                          <div className="font-medium">Liam Johnson</div>
                          <div className="text-sm text-gray-500">
                            Geometry Guardians
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Mr. Thompson
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Level 7
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-500 rounded-full mr-2" />
                        <span className="text-sm">Mage</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      4,200
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">4</td>
                  </tr>

                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold">
                          3
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src="http://static.photos/people/200x200/7"
                          alt="Student"
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <div>
                          <div className="font-medium">Olivia Brown</div>
                          <div className="text-sm text-gray-500">
                            The Mathletes
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Ms. Garcia
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Level 6
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-green-500 rounded-full mr-2" />
                        <span className="text-sm">Healer</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      3,750
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">3</td>
                  </tr>

                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 font-bold">
                          8
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src="http://static.photos/people/200x200/8"
                          alt="Student"
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <div>
                          <div className="font-medium">Alex Wilson</div>
                          <div className="text-sm text-gray-500">
                            Math Warriors
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Mrs. Anderson
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Level 5
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-red-500 rounded-full mr-2" />
                        <span className="text-sm">Warrior</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      1,245
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">2</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Guilds Leaderboard */}
        {activeTab === "guilds" && (
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
                  {/* Add more guild rows here */}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
