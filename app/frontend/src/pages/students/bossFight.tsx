import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";

const Quests =() => {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
          <nav className="bg-blue-700 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <div className="shrink-0 flex items-center">
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
                  <Link
                    to="/teacherDashboard"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/Subjects"
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    Quests
                  </Link>
                  <a href="#" className="shrink-0 group block">
                    <img
                      className="inline-block h-9 w-9 rounded-full ring-3 ring-purple-500 hover:ring-purple-700"
                      src="/assets/warrior-head.png"
                      alt="Profile"
                    />
                  </a>
                </div>
                <div className="-mr-2 flex items-center md:hidden">
                  <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                    <i data-feather="menu"></i>
                  </button>
                </div>
              </div>
            </div>
          </nav>
      </div>
  )
};

export default Quests
