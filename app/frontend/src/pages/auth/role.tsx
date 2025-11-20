'use client';
import React, { useEffect } from 'react';
import feather from 'feather-icons';
import { Link } from 'react-router-dom';

export default function Role() {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center">
                    <div className="shrink-0 flex items-center">
                      <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                      <span className="text-xl font-bold">ClassQuest</span>
                    </div>
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
      {/* Role Selection */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full space-y-8 p-6">
          <div className="text-center">
            <i data-feather="book-open" className="mx-auto h-12 w-12 text-black"></i>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Welcome to ClassQuest
            </h2>
            <p className="mt-2 text-sm text-gray-600">Please select your login type</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-lg login-card">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Select your role</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Student Login Card */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full mr-4">
                    <i data-feather="user" className="h-6 w-6 text-blue-600"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Student</h4>
                    <p className="text-sm text-gray-500">Access your quests and rewards</p>
                  </div>
                  <div>
                    <a href="/student-login" className="text-blue-600 hover:text-blue-800">
                      <i data-feather="arrow-right" className="h-5 w-5"></i>
                    </a>
                  </div>
                </div>
              </div>

              {/* Teacher Login Card */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 transition-colors">
                <div className="flex items-center">
                  <div className="bg-purple-100 p-3 rounded-full mr-4">
                    <i data-feather="users" className="h-6 w-6 text-purple-600"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Teacher</h4>
                    <p className="text-sm text-gray-500">Manage classes and content</p>
                  </div>
                  <div>
                    <a href="/teacher-login" className="text-purple-600 hover:text-purple-800">
                      <i data-feather="arrow-right" className="h-5 w-5"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account? Contact your teacher or administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
