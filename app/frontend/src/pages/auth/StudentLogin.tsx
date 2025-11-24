import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { Amplify } from "aws-amplify"; // Todo: aws exports not configured yet
import { signIn } from "aws-amplify/auth"; 

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    feather.replace();
  }, []);

//   "const handleLogin = async (e: React.FormEvent) => {
//    e.preventDefault();
//    setError("");
//    setIsLoading(true);
//
//    try {
//      const { isSignedIn } = await signIn({ username, password });
//      
//      if (isSignedIn) {
//        console.log("Signed in successfully");
//        navigate("/StudentDashboard");
//      } else {
//        // MFA, etc. HERE
//        setError("Additional verification required. Please check your email or follow the prompts.");
//      }
//    } catch (err: any) {
//      console.error("Login error:", err);
//      if (err.name === "UserNotConfirmedException") {
//        setError("Account not confirmed. Please check your email for the confirmation code.");
//      } else if (err.name === "NotAuthorizedException") {
//        setError("Invalid username or password.");
//      } else if (err.name === "UserNotFoundException") {
//        setError("User not found. Please check your username or sign up.");
//      } else {
//        setError(err.message || "An error occurred during login. Please try again.");
//      }
//    } finally {
//      setIsLoading(false);
//    }
//  }; 

const handleLogin = (e: React.FormEvent) => {
  e.preventDefault();

  // ignore actual auth for now, just go to character page
  navigate("/character");
};


  return (
     <div className="font-poppins min-h-screen bg-gray-50">
           {/* Navigation */}
           <nav className="bg-blue-700 text-white shadow-lg">
                   <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                     <div className="flex justify-between h-16">
                       <div className="flex items-center">
                           <Link to="/" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                           <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                           <span className="text-xl font-bold"> ClassQuest</span>
                           </Link>
                       </div>
                       <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
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
                      <Link to="/role" className="inline-flex items-center text-gray-700 hover:text-indigo-600 transition-colors">
                        <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                        <span className="text-sm font-medium">Back</span>
                      </Link>
                    </div>
                 {/* Login form */}
                <div className="flex items-center justify-center min-h-screen">
                  <div className="max-w-lg w-full space-y-8 p-5 pt-2">
                    <div className="bg-white p-7 rounded-xl shadow-lg login-card">
                  <div className="text-center mb-6">
                    <i data-feather="users" className="mx-auto h-12 w-12 text-secondary-600"></i>
                    <h3 className="text-2xl font-bold text-gray-900">Student Login</h3>
                    <p className="mt-2 text-sm text-gray-600">Access your quests, rewards and more</p>
                     <form onSubmit={handleLogin} className="mt-8 space-y-6">
                      <div className="space-y-4">
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
                            autoComplete="current-password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                            placeholder="Enter your password"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                          {error}
                        </div>
                      )}

                      <div className="flex items-center">
                        <input 
                          id="remember-me" 
                          name="remember-me" 
                          type="checkbox" 
                          checked={rememberMe} 
                          onChange={e => setRememberMe(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                          Remember me
                        </label>
                        <Link to="/forgot-password" className="text-blue-600 hover:text-blue-500 text-right ml-auto text-sm">
                          Forgot password?
                        </Link>
                      </div>
                      <div>
                        <button 
                          type="submit" 
                          disabled={isLoading}
                          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? "Signing in..." : "Sign In"}
                        </button>
                      </div>
                      </form>
                </div>
                </div>
                  </div>
                  </div>
                </div>
  );
}
