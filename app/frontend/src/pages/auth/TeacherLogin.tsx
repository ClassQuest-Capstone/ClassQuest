import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { Amplify } from "aws-amplify"; // Todo: aws exports not configured yet
import { signIn } from "aws-amplify/auth"; 

export default function TeacherLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    feather.replace();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await signIn({ username, password });
      console.log("Signed in:", user);
      navigate("/TeacherDashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Invalid username or password");
    }
  };

  return (
    <div>
      Login
    </div>
  );
}