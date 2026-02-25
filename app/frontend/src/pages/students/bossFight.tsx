import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";
import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";
import "../../styles/boss.css";


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



const BossFight: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;
  const [classId, setClassId] = useState<string | null>(null);
  //const characterClass = useMemo(() => getSelectedClass(), []);
  
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

// present student's need to be fetched and stored in state, along with active boss for the fight. For MVP, we can hardcode these values and then implement the dynamic fetching later.

  return (
    <div className="font-poppins bg-[url(public/assets/1.jpg)] bg-cover bg-center bg-no-repeat min-h-screen">
     {/**Nav Bar */}
          <nav className="bg-blue-700 text-white shadow-lg">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center">
                          <Link
                            to="/character"
                            className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                          >
                            <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                            <span className="text-xl font-bold"> ClassQuest</span>
                          </Link>
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
                          className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
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
                            <span className="ml-2 text-sm font-medium">
                              {student?.displayName ?? "Student"}
                            </span>
                          </button>
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
           
            {/** Boss and charcaters */}
            <div className="relative h-[500px] w-[1300px] mx-auto mb-8">
                {/** Background */}
                {/** TODO:Dynamically add present students(left) characters and type of boss (right) here */}
                    <div className="absolute inset-0 bg-black/30 rounded-xl backdrop-blur-sm flex mt-3">
                     {/* Back button */}
                      <div className="justify-left align-left">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                          <button
                            onClick={() => {
                              const confirmLeave = window.confirm("Are you sure you want to flee the battle?");
                              if (confirmLeave) {
                                window.location.href = "/guilds";
                              }
                            }}
                            className="inline-flex items-center bg-lime-600 text-white border-2 border-lime-900 rounded-md px-3 py-2 hover:bg-[#78283E]"
                            >
                            <i data-feather="x" className="mr-2"></i>
                            <span className="text-sm font-medium">Flee Battle</span>
                          </button>
                        </div>
                        </div>
                        {/* Left: Present Students */}
                        {/*<div className="w-1/2 flex flex-col gap-3 p-4">
                          {presentStudents.map((s) => (
                            <div key={s.id} className="flex items-center gap-3">
                              <img
                                src={s.avatarUrl}
                                alt={s.name}
                                className="h-10 w-10 rounded-full border border-white/40"
                              />
                              <span className="text-white font-medium">{s.name}</span>
                              <p className="mt-1 text-sm text-emerald-300">HP: {s.hp}</p>
                            </div>
                          ))}
                        </div>

                        {/* Right: Active Boss */}
                        {/*<div className="w-1/2 flex flex-col items-center justify-center p-4">
                          {activeBoss && (
                            <>
                              <img
                                src={activeBoss.spriteUrl}
                                alt={activeBoss.name}
                                className="h-32 object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.7)]"
                              />
                              <div className="mt-3 text-center">
                                <p className="text-sm uppercase tracking-wide text-white/70">
                                  {activeBoss.type} Boss
                                </p>
                                <p className="text-xl font-semibold text-white">{activeBoss.name}</p>
                                <p className="mt-1 text-sm text-emerald-300">HP: {activeBoss.hp}</p>
                              </div>
                            </>
                          )}
                        </div>*/}
                      </div>
             {/** Battle log TODO: implement players and boss actions here */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 h-32 overflow-y-auto border-t-2 border-yellow-500">
                <div className="text-sm font-mono">
                </div>
            </div>
      </div>
       {/** Action and Questions buttons */}
        <div className="grid grid-cols-1 gap-6 mb-8 px-6 lg:px-0 max-w-7xl mx-auto">

          {/* Problem/Question Section */}
          <div className="battle-box bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500 rounded-xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-yellow-300 flex items-center gap-2">
              <i data-feather="book-open" className="text-yellow-400"></i>
              Problem
            </h2>
            <div className="bg-gray-900 p-6 rounded-lg mb-6 border border-gray-700 min-h-[120px] flex items-center justify-center">
              <p className="text-gray-400 text-center text-sm">Problem statement will appear here...</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 border-blue-400 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">A</span>
                </div>
                Option A
              </button>
              <button className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 border-blue-400 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">B</span>
                </div>
                Option B
              </button>
              <button className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 border-blue-400 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">C</span>
                </div>
                Option C
              </button>
              <button className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 border-blue-400 shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">D</span>
                </div>
                Option D
              </button>
            </div>  
          </div>
        </div>
        </div>
  );
};

export default BossFight;
