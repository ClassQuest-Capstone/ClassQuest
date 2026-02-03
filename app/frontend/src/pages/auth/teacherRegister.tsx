import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function TeacherRegister() {
  const navigate = useNavigate();

  // Redirect to unified signup with teacher mode
  useEffect(() => {
    navigate("/signup?role=teacher", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Redirecting to registration...</p>
    </div>
  );
}
