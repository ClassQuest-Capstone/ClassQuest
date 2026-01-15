// guild.tsx
import React, { useEffect } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";

const Guild: React.FC = () => {
  useEffect(() => {
    feather.replace();
  }, []);

  const pageBg =
    "min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-900";

  // TODO: replace this URL with your own pixel-art background if you want
  const pageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/background/guilds-bg.png')",
  };

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
              {/* Character */}
              <Link
                to="/character"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Character
              </Link>

              {/* Guilds (current page) */}
              <Link
                to="/guilds"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Guilds
              </Link>

              {/* Leaderboard */}
              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Leaderboard
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

                {/* Amount */}
                <span className="text-white font-medium">1,245</span>
            </Link>
            </div>

              <div className="relative ml-3">
                <button
                  id="user-menu-button"
                  className="flex items-center text-sm rounded-full focus:outline-none"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt=""
                  />
                  <span className="ml-2 text-sm font-medium">Alex</span>
                </button>
                {/* dropdown is static for now */}
                <div className="hidden origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Your Profile
                  </a>
                  <Link
                    to="/"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </Link>
                </div>
              </div>
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Guilds</h1>
            <p className="text-gray-200">
              Team up with classmates to defeat powerful bosses!
            </p>
          </div>
          <button className="bg-black hover:bg-gray-100 text-yellow-400 font-semibold hover:text-yellow-600 py-2 px-6 border border-yellow-600 hover:border-yellow-700 rounded-lg transition-colors">
            Create Guild
          </button>
        </div>

        {/* My Guild */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            My Guild: <span className="text-blue-700">Math Warriors</span>
          </h2>

          <div className="flex items-center mb-6">
            <div className="relative">
              <img
                src="http://static.photos/education/200x200/20"
                alt="Guild Banner"
                className="w-32 h-32 rounded-lg"
              />
              <div className="absolute bottom-0 left-0 bg-yellow-500 text-white px-3 py-1 rounded-r-full text-xs">
                Level 3 Guild
              </div>
            </div>
            <div className="ml-6">
              <div className="flex items-center mb-2">
                <div className="h-2 w-48 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: "45%" }}
                  />
                </div>
                <span className="ml-2 text-sm text-gray-500">
                  45% to next level
                </span>
              </div>
              <p className="text-gray-700 mb-4">
                &quot;We conquer math problems and eat equations for
                breakfast!&quot;
              </p>
              <div className="flex space-x-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Members</p>
                  <p className="text-xl font-bold text-gray-800">5/8</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Bosses Defeated</p>
                  <p className="text-xl font-bold text-gray-800">3</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Guild XP</p>
                  <p className="text-xl font-bold text-gray-800">1,245</p>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-medium mb-4 text-gray-800">
            Current Members
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center">
                <div className="relative mr-4">
                  <img
                    src="http://static.photos/people/200x200/8"
                    alt="Member"
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full">
                    <img
                      src="https://tse4.mm.bing.net/th/id/OIP.vUAkyc_b9WIXM-1a78LiGQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3"
                      alt="Shield"
                      className="w-5 h-5"
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Alex (Leader)</h4>
                  <p className="text-sm text-gray-500">Level 5 Warrior</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  Tank
                </span>
                <span className="text-xs text-gray-500">1,245 XP</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center">
                <div className="relative mr-4">
                  <img
                    src="http://static.photos/people/200x200/9"
                    alt="Member"
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full">
                    <img
                      src="https://png.pngtree.com/png-clipart/20231008/original/pngtree-game-magic-book-icons-asset-png-image_13290928.png"
                      alt="Book"
                      className="w-5 h-5"
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Emma</h4>
                  <p className="text-sm text-gray-500">Level 4 Mage</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  DPS
                </span>
                <span className="text-xs text-gray-500">980 XP</span>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center">
                <div className="relative mr-4">
                  <img
                    src="http://static.photos/people/200x200/10"
                    alt="Member"
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full">
                    <img
                      src="https://media.forgecdn.net/avatars/927/489/638398081470952649.png"
                      alt="Staff"
                      className="w-5 h-5"
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Liam</h4>
                  <p className="text-sm text-gray-500">Level 3 Healer</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Support
                </span>
                <span className="text-xs text-gray-500">750 XP</span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg shadow-sm flex">
              <button className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <i data-feather="plus" className="w-8 h-8 mb-2" />
                <span className="text-gray-600">Invite Member</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Boss Fights */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Active Boss Fights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg p-6 text-white bg-gradient-to-r from-red-500 to-orange-500 shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl">The Algebra Dragon</h3>
                  <p className="text-red-100">
                    Chapter 5: Solving Equations
                  </p>
                </div>
                <div className="bg-white text-red-600 px-3 py-1 rounded-full text-sm font-bold">
                  In Progress
                </div>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Guild Progress</span>
                  <span>65%</span>
                </div>
                <div className="w-full bg-red-700 rounded-full h-3">
                  <div
                    className="bg-yellow-400 h-3 rounded-full"
                    style={{ width: "65%" }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-red-100">Time Remaining</p>
                  <p className="font-bold">2d 4h 32m</p>
                </div>
                <div>
                  <p className="text-sm text-red-100">Reward</p>
                  <p className="font-bold">+500 XP, +200 Gold</p>
                </div>
              </div>
              <button className="mt-4 w-full bg-white text-red-600 font-bold py-2 rounded-lg">
                Join Fight
              </button>
            </div>

            <div className="rounded-lg p-6 text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl">Geometry Golem</h3>
                  <p className="text-blue-100">Chapter 3: Angles &amp; Shapes</p>
                </div>
                <div className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
                  Available
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-blue-100 mb-2">
                  Requires Level 4 Guild
                </p>
                <div className="w-full bg-blue-700 rounded-full h-3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-100">Time Limit</p>
                  <p className="font-bold">3 days</p>
                </div>
                <div>
                  <p className="text-sm text-blue-100">Reward</p>
                  <p className="font-bold">+750 XP, +300 Gold</p>
                </div>
              </div>
              <button className="mt-4 w-full bg-white text-blue-600 font-bold py-2 rounded-lg">
                Start Fight
              </button>
            </div>
          </div>
        </div>

        {/* Guild Leaderboard */}
        <div className="bg-white/90 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Top Guilds</h2>
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
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bosses Defeated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guild XP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-500">
                    1
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src="http://static.photos/education/200x200/25"
                        alt="Guild"
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-800">
                          Equation Eliminators
                        </div>
                        <div className="text-sm text-gray-500">
                          Mrs. Smith&apos;s Class
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    5
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    8/8
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    7
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                    3,450
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                    2
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src="http://static.photos/education/200x200/26"
                        alt="Guild"
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-800">
                          Geometry Guardians
                        </div>
                        <div className="text-sm text-gray-500">
                          Mr. Johnson&apos;s Class
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    4
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    7/8
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    5
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                    2,780
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-700">
                    3
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src="http://static.photos/education/200x200/20"
                        alt="Guild"
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-800">
                          Math Warriors
                        </div>
                        <div className="text-sm text-gray-500">
                          Your Guild
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    3
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    5/8
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    3
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                    1,245
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Guild;
