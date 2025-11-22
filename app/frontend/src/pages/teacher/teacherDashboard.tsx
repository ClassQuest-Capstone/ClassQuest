import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";

{/** Todo: seprate dash board components into different files */}

const TeacherDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    feather.replace();
  }, [sidebarOpen]);

  function reloadelements() {
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  }

  const sidebarLinks = [
    { icon: "home", label: "Dashboard", href: "#",},
    { icon: "users", label: "Students", href: "#" },
    { icon: "book", label: "Subjects", href: "#" },
    { icon: "award", label: "Quests", href: "#" },
    { icon: "shopping-bag", label: "Rewards", href: "#" },
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
                    src=""
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
                      src=""
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
       
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white/300 bg-center bg-cover bg-no-repeat">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-white hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <i data-feather="menu" className="h-6 w-6"></i>
          </button>
        </div>

        {/* Search bar */}
        <div className="bg-white/300 p-4 flex items-center">
          <i data-feather="search" className="w-6 h-6 mr-5"></i>
          <input
            type="text"
            placeholder="search.."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4">
          
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
