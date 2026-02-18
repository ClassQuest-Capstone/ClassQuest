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
            <h1 className="text-3xl font-bold text-white">ClassQuest Shop</h1>
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

        {/* CATEGORY BUTTONS */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-full">
            All Items
          </button>
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-gray-300 rounded-full">
            Avatar Items
          </button>
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-gray-300 rounded-full">
            Power-ups
          </button>
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-gray-300 rounded-full">
            Cosmetics
          </button>
          <button className="whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-gray-300 rounded-full">
            Special Offers
          </button>
        </div>

        {/* FEATURED ITEMS */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Featured Items</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ITEM CARD TEMPLATE  */}
            {[
              {
                name: "Legendary Backpack",
                img: "http://static.photos/education/300x300/7",
                rarity: "Legendary",
                rarityColor: "from-purple-500 to-pink-500",
                gold: 750,
              },
              {
                name: "Super XP Boost",
                img: "http://static.photos/education/300x300/8",
                rarity: "Epic",
                rarityColor: "from-blue-400 to-cyan-400",
                gold: 300,
              },
              {
                name: "Answer Reveal",
                img: "http://static.photos/education/300x300/9",
                rarity: "Rare",
                rarityColor: "from-green-400 to-emerald-400",
                gold: 150,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="shop-item bg-white rounded-xl shadow-md overflow-hidden transition transform hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`bg-gradient-to-r ${item.rarityColor} p-6 text-center`}
                >
                  <img
                    src={item.img}
                    className="mx-auto w-32 h-32 object-contain"
                  />
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-gray-600 font-bold text-lg">
                      {item.name}
                    </h3>
                    <div className="flex items-center bg-yellow-100 px-2 py-1 rounded-full">
                      <span className="text-gray-600 text-xs font-bold">
                        {item.rarity}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">
                    {item.name === "Legendary Backpack"
                      ? "+25 to all stats, +10% XP bonus"
                      : item.name === "Super XP Boost"
                      ? "+50% XP for 1 hour"
                      : "Reveal one wrong answer choice"}
                  </p>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <i
                        data-feather="coins"
                        className="text-yellow-500 mr-1"
                      ></i>
                      <span className="text-gray-600 font-bold">
                        {item.gold} Gold
                      </span>
                    </div>
                    <button className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-1 rounded-full text-sm">
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ALL ITEMS LIST */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">All Items</h2>

            <div className="relative">
              <select className="block appearance-none bg-blue-600 border border-gray-300 px-4 py-2 pr-8 rounded-full text-white shadow-sm">
                <option>Sort by: Newest</option>
                <option>Sort by: Price Low to High</option>
                <option>Sort by: Price High to Low</option>
                <option>Sort by: Rarity</option>
              </select>

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-200">
                <i data-feather="chevron-down" className="w-4 h-4"></i>
              </div>
            </div>
          </div>

          {/* Item Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                name: "Wizard Hat",
                stat: "+15 Wisdom",
                price: 250,
                img: "http://static.photos/education/200x200/11",
              },
              {
                name: "Math Shield",
                stat: "+10 Knowledge",
                price: 200,
                img: "http://static.photos/education/200x200/12",
              },
              {
                name: "Health Potion",
                stat: "Restores 25 HP",
                price: 100,
                img: "http://static.photos/education/200x200/13",
              },
              {
                name: "Time Extender",
                stat: "+30 seconds on timer",
                price: 120,
                img: "http://static.photos/education/200x200/14",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="shop-item bg-white rounded-lg shadow p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="bg-gray-100 rounded-lg p-4 mb-3 flex items-center justify-center h-32">
                  <img src={item.img} className="h-20 object-contain" />
                </div>

                <h3 className="text-gray-700 font-bold mb-1">{item.name}</h3>
                <p className="text-gray-600 text-xs mb-2">{item.stat}</p>

                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <i data-feather="coins" className="text-yellow-500 mr-1"></i>
                    <span className="text-gray-700 font-medium">
                      {item.price} Gold
                    </span>
                  </div>

                  <button className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-1 rounded-full text-sm">
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentShop;
