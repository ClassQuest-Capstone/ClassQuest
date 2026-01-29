import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

type StudentUser = {
  id: string;
  role: "student";
  displayName: string;
  email: string;
  joinedClassCode: string;
};

export default function StudentRegister() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [classCodeInput, setClassCodeInput] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!displayName.trim() || !email.trim()) {
      setError("Please enter a name and email.");
      return;
    }

    const storedTeacherCode = localStorage.getItem("cq_teacherClassCode");

    if (!storedTeacherCode) {
      setError("No class exists yet. Ask your teacher to register and give you a class code.");
      return;
    }

    if (classCodeInput.trim().toUpperCase() !== storedTeacherCode) {
      setError("Invalid class code. Double-check with your teacher.");
      return;
    }

    const studentUser: StudentUser = {
      id: crypto.randomUUID(),
      role: "student",
      displayName: displayName.trim(),
      email: email.trim(),
      joinedClassCode: storedTeacherCode,
    };

    localStorage.setItem("cq_currentUser", JSON.stringify(studentUser));
    navigate("/student/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-extrabold">Student Registration</h1>
        <p className="text-slate-300 mt-1 text-sm">
          Enter your class code to join your teacher’s class.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm text-slate-300">Display Name</label>
            <input
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ainz"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@school.ca"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Class Code</label>
            <input
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 outline-none tracking-[0.25em] uppercase"
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value)}
              placeholder="AB7KQ9"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-200 text-slate-950 font-semibold py-2 hover:bg-white"
          >
            Create Student Account
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-300">
          Teacher?{" "}
          <Link to="/register/teacher" className="underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
