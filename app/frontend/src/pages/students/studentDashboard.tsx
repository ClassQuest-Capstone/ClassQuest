import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";



const StudentDashboard =() => {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div>Student page</div>
  );
};

export default StudentDashboard;


