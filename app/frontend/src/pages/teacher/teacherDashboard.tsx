import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";



const TeacherDashboard =() => {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins min-h-screen bg-gray-100">
               {/* search bar */}
               <div className="bg-white shadow p-4 flex items-center">
                <i data-feather="search" className="w-6 h-6 mr-5"></i>
                  <input  type="text" placeholder="search.." className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" >
                  
                  </input>
                  </div>
        </div>
  );
};