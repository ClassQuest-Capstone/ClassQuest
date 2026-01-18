import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";
import "../../styles/boss.css";

const BossFight =() => {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins bg-[url(https://wallpapercave.com/wp/wp3914096.jpg)] bg-cover bg-center bg-no-repeat min-h-screen">
     {/**Nav Bar */}
          <nav className="bg-blue-700 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <div className="shrink-0 flex items-center">
                    <Link
                      to="/character"
                      className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                    >
                      <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                      <span className="text-xl font-bold">ClassQuest</span>
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
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    Guilds
                  </Link>
                  <a href="#" className="shrink-0 group block">
                    <img
                      className="inline-block h-9 w-9 rounded-full ring-3 ring-purple-500 hover:ring-purple-700"
                      src="http://static.photos/people/200x200/8"
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
            {/* Back button */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <Link to="/guilds" className="inline-flex items-center bg-lime-700 text-white border-2 border-lime-600 rounded-md px-3 py-2 hover:bg-[#78283E]">
                <i data-feather="x" className="mr-2"></i>
                <span className="text-sm font-medium">Flee Battle</span>
                {/* TODO: add alert to confrim that they want to leave battle */}
              </Link>
            </div>
            {/** Boss and charcaters */}
            <div className="relative h-[500px] w-[1300px] mx-auto mb-8">
                {/** Background */}
                <div className="absolute inset-0 bg-black/30 rounded-xl backdrop-blur-sm">
                {/** TODO:Dynamically add present student characters and type of boss here */}
                </div>
             {/** Battle log TODO: implement players and boss actions here */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 h-32 overflow-y-auto border-t-2 border-yellow-500">
                <div className="text-sm font-mono">
                </div>
            </div>
      </div>
       {/** Action and Questions buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 mr-25 ml-25">
                <div className="battle-box">
          <h2 className="text-xl font-bold mb-4 justify-center flex">Battle Actions</h2>
                <div className=" mb-5 justify-center flex">
                        <button className="battle-btn flex flex-col items-center justify-center hover:bg-red-800">
                            <i data-feather="shield" className="h-8 w-8 mb-1 text-blue-400"></i>
                            <span>Defend</span>
                            <span className="text-xs text-blue-300 mt-1">-25 HP</span>
                        </button>
                  </div>
                <h3 className="font-bold mb-2 justify-center flex">Inventory</h3>
                <div className="justify-center flex gap-3">
                        <button className="battle-btn flex flex-col items-center justify-center p-2 hover:bg-green-800">
                            <i data-feather="eye" className="text-yellow-400 mb-1"></i>
                            <span className="text-xs">Clue Token (2)</span>
                        </button>
                </div>
              </div>
                <div className="battle-box border-2 border-yellow-500">
              <h2 className="text-xl font-bold mb-4">Problem</h2>
                <div className="bg-gray-900 p-6 rounded-lg mb-4">
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                        <button className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-left text-black">
                        </button>
                        <button className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-left text-black">
                        </button>
                        <button className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-left text-black">
                        </button>
                        <button className="bg-gray-100 hover:bg-gray-200 p-4 rounded-lg text-left text-black">
                        </button>
                </div>  
              </div>
            </div>
        </div>
  );
};

export default BossFight;
