import React, { useEffect, useState, useMemo } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

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

// Determine rarity tier based on gold price
function getRarityTier(price: number) {
  if (price >= 900) return { tier: "Legendary", border: "border-yellow-400", gradient: "from-yellow-900/70 to-orange-900/70", badge: "bg-yellow-400 text-yellow-900", glow: "hover:shadow-yellow-500/50" };
  if (price >= 500) return { tier: "Epic", border: "border-purple-500", gradient: "from-purple-900/70 to-pink-900/70", badge: "bg-purple-400 text-white", glow: "hover:shadow-purple-500/50" };
  if (price >= 300) return { tier: "Rare", border: "border-blue-400", gradient: "from-blue-900/80 to-cyan-900/80", badge: "bg-blue-400 text-white", glow: "hover:shadow-blue-500/50" };
  if (price >= 160) return { tier: "Uncommon", border: "border-green-400", gradient: "from-green-900/70 to-emerald-900/70", badge: "bg-green-400 text-green-900", glow: "hover:shadow-green-500/50" };
  return { tier: "Common", border: "border-gray-300", gradient: "from-gray-500/70 to-gray-600/70", badge: "bg-gray-300 text-gray-700", glow: "hover:shadow-gray-400/50" };
}

const StudentShop: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;
  const [classId, setClassId] = useState<string | null>(null);
  
    useEffect(() => {
    // From student
    if (student?.classId) {
      setClassId(student.classId);
      return;
    }
  
    // From localStorage (most important)
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
  
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/originals/df/96/29/df9629c20480fa6cb0b6241d0fdd3a47.jpg')",
      }}
    >
      {/* NAVIGATION */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                <span className="text-xl font-bold">ClassQuest</span>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/character"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Character
              </Link>

              <Link
                to="/guilds"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Guilds
              </Link>

              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Leaderboard
              </Link>
              <Link
                to="/shop"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
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

                {/* Amount */}
                <span className="text-white font-medium">
                  {profile.gold.toLocaleString()}
                  </span>
            </Link>
            </div>


              {/* Profile */}
              <div className="relative ml-3">
                <button className="flex items-center text-sm rounded-full focus:outline-none">
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt="profile"
                  />
                  <span className="ml-2 text-sm font-medium">{student?.displayName ?? "Student"}</span>
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-primary-100 hover:text-white hover:bg-primary-600">
                <i data-feather="menu"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* SHOP CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-500">ClassQuest Shop</h1>
            <p className="text-gray-200">
              Spend your hard-earned gold on awesome items!
            </p>
          </div>

          <div className="flex items-center bg-yellow-100 px-4 py-2 rounded-full">
            <i data-feather="coins" className="text-yellow-900 mr-2"></i>
            <img
                src="/assets/icons/gold-bar.png"
                alt="Gold"
                className="h-5 w-5 mr-1"
                />
            <span className="text-gray-600 font-bold">{profile.gold.toLocaleString()} Gold</span>
          </div>
        </div>

        {/* SORT AND FILTER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-blue-500">Available Items</h2>
            <p className="text-gray-300 text-sm">Browse and purchase rewards from your teacher</p>
          </div>

          <div className="relative">
            <select className="block appearance-none bg-white/80 border border-gray-600 px-4 py-2 pr-8 rounded-full text-gray-900 shadow-sm">
              <option>Sort by: Newest</option>
              <option>Sort by: Price Low to High</option>
              <option>Sort by: Price High to Low</option>
            </select>

            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-900">
              <i data-feather="chevron-down" className="w-4 h-4"></i>
            </div>
          </div>
        </div>

        {/* SHOP ITEMS GRID */}
        <div className="bg-white/30 rounded-xl shadow-lg p-6 text-gray-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sample items - Replace with dynamic data from API */}
            {[
              {
                id: "1",
                name: "Wizard Hat",
                type: "Avatar Items",
                level: "Epic",
                price: 650,
                img: "http://static.photos/education/200x200/11",
                description: "+15 Wisdom",
              },
              {
                id: "2",
                name: "Math Shield",
                type: "Avatar Items",
                level: "Rare",
                price: 200,
                img: "http://static.photos/education/200x200/12",
                description: "+10 Knowledge",
              },
              {
                id: "3",
                name: "Health Potion",
                type: "Power-ups",
                level: "Common",
                price: 100,
                img: "http://static.photos/education/200x200/13",
                description: "Restores 25 HP",
              },
              {
                id: "4",
                name: "Time Extender",
                type: "Power-ups",
                level: "Rare",
                price: 320,
                img: "http://static.photos/education/200x200/14",
                description: "+30 seconds on timer",
              },
              {
                id: "5",
                name: "5mins Phone Time",
                type: "Cosmetics",
                level: "Special",
                price: 180,
                img: "http://static.photos/education/200x200/15",
                description: "Unlock 5 minutes of free time",
              },
              {
                id: "6",
                name: "Extra Break",
                type: "Cosmetics",
                level: "Legendary",
                price: 990,
                img: "http://static.photos/education/200x200/16",
                description: "Enjoy an extra break period",
              },
            ].map((item) => {
              const rarity = getRarityTier(item.price);
              return (
                <div
                  key={item.id}
                  className={`shop-item bg-gradient-to-br ${rarity.gradient} border-2 ${rarity.border} rounded-lg transition transform hover:-translate-y-2 ${rarity.glow} hover:shadow-lg overflow-hidden`}
                >
                  <div className="bg-gradient-to-b from-gray-800 to-gray-900 h-40 flex items-center justify-center overflow-hidden mb-3 border-b border-gray-700/50">
                    <img src={item.img} className="h-28 w-full object-contain drop-shadow-lg" alt={item.name} />
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-bold text-sm flex-1">{item.name}</h3>
                      <span className={`text-xs font-bold px-2 py-1 ${rarity.badge} rounded-full`}>
                        {rarity.tier}
                      </span>
                    </div>

                    <p className="text-gray-200 text-xs mb-3 line-clamp-2">{item.description}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-400/30">
                      <div className="flex items-center gap-1">
                        <img
                          src="/assets/icons/gold-bar.png"
                          alt="Gold"
                          className="h-4 w-4"
                        />
                        <span className="text-white font-bold text-sm">{item.price}</span>
                      </div>

                      <button 
                        disabled={profile.gold < item.price}
                        className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-gray-900 px-3 py-1 rounded-full text-xs font-bold transition transform hover:scale-105"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          <div className="text-center py-12">
            <i data-feather="inbox" className="w-12 h-12 mx-auto text-gray-900 mb-3"></i>
            <p className="text-gray-500">Loading items...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentShop;
