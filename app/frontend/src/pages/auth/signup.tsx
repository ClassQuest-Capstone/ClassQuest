import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { Amplify } from "aws-amplify";
import { signUp, confirmSignUp } from "aws-amplify/auth";

type UserType = "teacher" | "student";

export default function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [studentCode, setStudentCode] = useState("");

  useEffect(() => {
    feather.replace();
  }, []);

  // Generating unique student code
  const generateStudentCode = (): string => {
    const prefix = "ST";
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${randomNum}`;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      // Generate student code if user is a student
      let code = "";
      if (userType === "student") {
        code = generateStudentCode();
        setStudentCode(code);
      }
      
      // Sign up with AWS Amplify (Todo: Replace with API endpoint when backend is configured)
      const { userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            "custom:userType": userType,
            "custom:studentCode": code || "",
          },
        },
      });

      console.log("Sign up successful:", userId);

      // Store user data in backend (Not working)
      try {
        const userData = {
          username,
          userType,
          studentCode: code || null,
          userId,
        }; 

        /* Todo: Replace with API endpoint when backend is configured
         const apiUrl = process.env.REACT_APP_API_URL || "";
         await fetch(`${apiUrl}/users/signup`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
           },
           body: JSON.stringify(userData),
         });*/

         //Log the user data 
        console.log("User data:", userData);

        // If student, also send code to teacher dashboard endpoint
        if (userType === "student" && code) {
          /* Todo: Replace with API endpoint
           await fetch(`${apiUrl}/teachers/student-codes`, {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
             },
             body: JSON.stringify({
               studentCode: code,
              username,
               userId,
             }),
           });*/
          console.log("Student code sent to teacher dashboard:", code);
        }
      } catch (backendError) {
        console.error("Backend storage error:", backendError);
        // Continue even if backend storage fails
      }

      if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setShowConfirmation(true);
        setSuccess(
          `Account created! Please check your email for the confirmation code.${
            userType === "student" ? ` Your student code is: ${code}` : ""
          }`
        );
      } else {
        setSuccess("Account created successfully!");
        if (userType === "student") {
          navigate("/StudentLogin");
        } else {
          navigate("/TeacherLogin");
        }
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.name === "UsernameExistsException") {
        setError("Username already exists. Please choose a different one.");
      } else if (err.name === "InvalidPasswordException") {
        setError("Password does not meet requirements.");
      } else {
        setError(err.message || "An error occurred during signup");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { isSignUpComplete } = await confirmSignUp({
        username,
        confirmationCode,
      });

      if (isSignUpComplete) {
        setSuccess("Account confirmed successfully!");
        setTimeout(() => {
          if (userType === "student") {
            navigate("/StudentLogin");
          } else {
            navigate("/TeacherLogin");
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setError(err.message || "Invalid confirmation code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-poppins min-h-screen bg-gray-100">
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
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/role"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Login
              </Link>
              <Link
                to="/Signup"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
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
        <Link
          to="/"
          className="inline-flex items-center text-gray-700 hover:text-indigo-600 transition-colors"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>
      </div>

      {/* Signup form */}
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="max-w-lg w-full space-y-8 p-5 pt-2">
          <div className="bg-white p-7 rounded-xl shadow-lg login-card">
            <div className="text-center mb-6">
              <i
                data-feather="user-plus"
                className="mx-auto h-12 w-12 text-secondary-600"
              ></i>
              <h3 className="text-2xl font-bold text-gray-900">
                Create Account
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Join ClassQuest and start your learning journey
              </p>
            </div>

            {!showConfirmation ? (
              <form onSubmit={handleSignup} className="mt-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      User Type
                    </label>
                    <select
                      id="userType"
                      name="userType"
                      value={userType}
                      onChange={(e) => setUserType(e.target.value as UserType)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                      required
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Username
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your username"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your password (min. 8 characters)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Creating Account..." : "Sign Up"}
                  </button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link
                      to="/role"
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            ) : (
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
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter confirmation code from email"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Please check your email for the confirmation code.
                  </p>
                </div>

                {userType === "student" && studentCode && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md text-sm">
                    <p className="font-medium">Your Student Code:</p>
                    <p className="text-lg font-bold mt-1">{studentCode}</p>
                    <p className="mt-2 text-xs">
                      Share this code with your teacher to Join thier class
                    </p>
                  </div>
                )}

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

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Confirming..." : "Confirm Account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
