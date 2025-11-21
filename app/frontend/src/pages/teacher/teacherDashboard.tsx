import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";



const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    feather.replace();
  }, []);


  return (
    <div className="font-poppins min-h-screen bg-gray-100">
               {/* search bar */}
               <div className="bg-white shadow p-4 flex items-center">
                  <input  type="text" placeholder="search.." className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" >
                  
                  </input>
                  </div>
        </div>
  );
};