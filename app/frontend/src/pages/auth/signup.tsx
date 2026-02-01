// signup.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { signUp, confirmSignUp, signIn, fetchAuthSession, signOut } from "aws-amplify/auth";

import { createStudentProfile } from "../../api/studentProfiles.js";
import { createTeacherProfile } from "../../api/teacherProfiles.js";

// ✅ local class “DB”
import { classExists, ensureClassExists, joinClass } from "../../utils/classStore.js";

type UserType = "teacher" | "student";

function generateClassCode(length: number = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid I,O,0,1 confusion
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --------------------
// Local-only student auth (DEV ONLY)
// --------------------
type LocalStudentAccount = {
  id: string;
  username: string; 
  displayName: string;
  joinedClassCode: string;
  password: string; 
  createdAt: number;
};

function loadLocalStudents(): Record<string, LocalStudentAccount> {
  try {
    return JSON.parse(localStorage.getItem("cq_localStudents") || "{}");
  } catch {
    return {};
  }
}

function saveLocalStudents(data: Record<string, LocalStudentAccount>) {
  localStorage.setItem("cq_localStudents", JSON.stringify(data));
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Signup() {
  const navigate = useNavigate();

  // Form fields
  const [userType, setUserType] = useState<UserType>("student");
  const [classCode, setClassCode] = useState(""); // required if student
  const [displayName, setDisplayName] = useState("");

  // teacher only
  const [email, setEmail] = useState(""); // teacher login (cognito username)
  const [teacherGeneratedCode, setTeacherGeneratedCode] = useState("");

  // student only (no email)
  const [studentUsername, setStudentUsername] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Confirm step (teacher only)
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Snapshot values for confirm step (teacher only)
  const [pendingUserType, setPendingUserType] = useState<UserType>("student");
  const [pendingClassCode, setPendingClassCode] = useState("");
  const [pendingDisplayName, setPendingDisplayName] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingTeacherUsername, setPendingTeacherUsername] = useState(""); // Opaque Cognito username

  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    // reset things when switching type
    setError("");
    setSuccess("");
    setShowConfirmation(false);
    setConfirmationCode("");

    if (userType !== "student") {
      setClassCode("");
      setStudentUsername("");
    }
    if (userType !== "teacher") {
      setEmail("");
    }
  }, [userType]);

  // No class code generation for teachers at signup

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Clear any stale auth session before signup
    console.log("[signup] Clearing any existing auth session");
    try {
      await signOut();
    } catch (err) {
      console.log("[signup] No existing session to clear (expected)");
    }

    const cleanedDisplay = displayName.trim();
    const cleanedStudentCode = classCode.trim().toUpperCase();
    const cleanedTeacherEmail = email.trim();
    const cleanedStudentUsername = studentUsername.trim();

    // Common validation
    if (!cleanedDisplay) return setError("Display name is required.");

    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters long.");

    // ----------------------------
    // STUDENT SIGNUP (COGNITO)
    // ----------------------------
    if (userType === "student") {
      if (!cleanedStudentCode) return setError("Class code is required for student accounts.");
      if (!classExists(cleanedStudentCode)) {
        return setError("Invalid class code. Ask your teacher for the correct code.");
      }
      if (!cleanedStudentUsername) return setError("Student username is required.");

      // Students use plain usernames (not emails)
      if (cleanedStudentUsername.includes("@")) {
        return setError("Student username should not be an email. Use a simple username like 'john123'.");
      }

      setIsLoading(true);
      try {
        console.log("[signup] Starting student signup", {
          username: cleanedStudentUsername,
          classCode: cleanedStudentCode,
        });

        // Sign up with Cognito (auto-confirmed by preSignUp trigger)
        const signUpResult = await signUp({
          username: cleanedStudentUsername,
          password,
          options: {
            userAttributes: {
              "custom:role": "STUDENT",
              "custom:studentCode": cleanedStudentCode,
            },
          },
        });

        console.log("[signup] signUp result", {
          isSignUpComplete: signUpResult.isSignUpComplete,
          nextStep: signUpResult.nextStep,
        });

        if (!signUpResult.isSignUpComplete) {
          setError("Student signup failed. Please try again.");
          return;
        }

        // Students are auto-confirmed, sign in to get session
        console.log("[signup] Signing in to obtain Cognito sub");
        const signInResult = await signIn({ username: cleanedStudentUsername, password });

        console.log("[signup] signIn result", {
          isSignedIn: signInResult.isSignedIn,
        });

        const session = await fetchAuthSession();
        const sub = String(session.tokens?.idToken?.payload?.sub || "");

        console.log("[signup] Obtained Cognito sub", { sub });

        if (!sub) {
          setError("Failed to retrieve user identity.");
          return;
        }

        // Create student profile in DynamoDB
        console.log("[signup] Creating student profile in DynamoDB");
        await createStudentProfile({
          student_id: sub,
          school_id: cleanedStudentCode,
          display_name: cleanedDisplay,
          email: "",
        });

        // Join class in local class DB (so teacher can see them)
        joinClass(cleanedStudentCode, sub);

        // Set current user session locally
        localStorage.setItem(
          "cq_currentUser",
          JSON.stringify({
            id: sub,
            role: "student",
            displayName: cleanedDisplay,
            username: cleanedStudentUsername,
            joinedClassCode: cleanedStudentCode,
          })
        );

        console.log("[signup] Student signup complete, navigating to /characterpage");
        setSuccess("Student account created! Joining class...");
        setTimeout(() => navigate("/characterpage", { replace: true }), 300);
      } catch (err: any) {
        console.error("[signup] Student signup error", {
          name: err?.name,
          message: err?.message,
          error: err,
        });

        if (err?.name === "UsernameExistsException") {
          setError("That username is already taken. Please choose a different one.");
        } else if (err?.name === "InvalidPasswordException") {
          setError("Password does not meet requirements.");
        } else if (err?.message?.toLowerCase().includes("already a signed in user")) {
          setError("Auth error detected. Please refresh the page and try again.");
        } else {
          setError(err?.message || "Could not create student account.");
        }
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // ----------------------------
    // TEACHER SIGNUP (COGNITO)
    // ----------------------------
    if (!cleanedTeacherEmail) return setError("Email is required for teacher accounts.");

    setIsLoading(true);
    try {
      // Generate opaque Cognito username (internal only, teachers sign in with email)
      const generatedUsername = `teacher_${crypto.randomUUID()}`;

      // Snapshot for confirm step
      setPendingUserType("teacher");
      setPendingDisplayName(cleanedDisplay);
      setPendingEmail(cleanedTeacherEmail);
      setPendingPassword(password);
      setPendingTeacherUsername(generatedUsername);

      const { nextStep } = await signUp({
        username: generatedUsername,
        password,
        options: {
          userAttributes: {
            email: cleanedTeacherEmail,
            "custom:role": "TEACHER",
          },
        },
      });

      if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setShowConfirmation(true);
        setSuccess(
          "Teacher account created! Check your email for the confirmation code."
        );
      } else {
        setSuccess("Teacher account created successfully!");
        navigate("/TeacherLogin");
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err?.name === "UsernameExistsException") {
        setError("An account with that email already exists. Try logging in instead.");
      } else if (err?.name === "InvalidPasswordException") {
        setError("Password does not meet requirements.");
      } else {
        setError(err?.message || "An error occurred during signup.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: pendingTeacherUsername,
        confirmationCode: confirmationCode.trim(),
      });

      if (!isSignUpComplete) {
        setError("Confirmation not complete. Please try again.");
        return;
      }

      // Clear session before signIn (fix "already signed in user")
      try {
        await signOut();
      } catch {}

      // sign in to read sub
      await signIn({ username: pendingEmail, password: pendingPassword });

      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      const sub = String(payload?.sub || "");
      if (!sub) throw new Error("Could not read Cognito user id (sub).");

      localStorage.setItem(
        "cq_currentUser",
        JSON.stringify({
          id: sub,
          role: "teacher",
          displayName: pendingDisplayName,
          email: pendingEmail,
        })
      );

      // Create DB profile (teacher) - no school_id at signup
      await createTeacherProfile({
        teacher_id: sub,
        display_name: pendingDisplayName,
        email: pendingEmail,
      });

      setSuccess("Teacher account confirmed! Redirecting to login...");
      setTimeout(() => navigate("/TeacherLogin"), 600);
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setError(err?.message || "Invalid confirmation code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-poppins min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                <span className="text-xl font-bold"> ClassQuest</span>
              </Link>
            </div>
            <div className="hidden md:flex md:items-center md:space-x-4">
              <Link to="/role" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Login
              </Link>
              <Link to="/Signup" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Register
              </Link>
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
        <Link to="/" className="inline-flex items-center text-gray-700 hover:text-indigo-600 transition-colors">
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      {/* Signup card */}
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="max-w-lg w-full space-y-8 p-5 pt-2">
          <div className="bg-white p-7 rounded-xl shadow-lg login-card">
            <div className="text-center mb-6">
              <i data-feather="user-plus" className="mx-auto h-12 w-12 text-gray-900"></i>
              <h3 className="text-2xl font-bold text-gray-900">Create Account</h3>
              <p className="mt-2 text-sm text-gray-600">Join ClassQuest and start your learning journey</p>
            </div>

            {/* Student never sees confirmation screen */}
            {!showConfirmation ? (
              <form onSubmit={handleSignup} className="mt-8 space-y-6">
                <div className="space-y-4 text-gray-900">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Account Type</label>
                    <select
                      id="userType"
                      name="userType"
                      value={userType}
                      onChange={(e) => setUserType(e.target.value as UserType)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                      required
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>

                  {userType === "student" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Class Code</label>
                        <input
                          id="classCode"
                          name="classCode"
                          type="text"
                          required
                          value={classCode}
                          onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter the class code from your teacher"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Student Username</label>
                        <input
                          id="studentUsername"
                          name="studentUsername"
                          type="text"
                          required
                          value={studentUsername}
                          onChange={(e) => setStudentUsername(e.target.value)}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Pick a username (no email needed)"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Display Name</label>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your name"
                    />
                  </div>

                  {/* Teacher needs email; students do not */}
                  {userType === "teacher" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Email (used to log in)</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Enter your email"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Confirm Password</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Creating Account..." : "Sign Up"}
                </button>
              </form>
            ) : (
              // Teacher confirmation only
              <form onSubmit={handleConfirmation} className="mt-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                    Confirmation Code
                  </label>
                  <input
                    id="confirmationCode"
                    name="confirmationCode"
                    type="text"
                    required
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter confirmation code from email"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Confirming..." : "Confirm Teacher Account"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
