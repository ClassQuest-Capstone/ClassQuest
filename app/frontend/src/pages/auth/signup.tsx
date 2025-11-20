import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import feather from "feather-icons";
import { Amplify } from "aws-amplify";
import { signIn, fetchAuthSession } from "aws-amplify/auth";

export default function Signup() {
    return (
        <div className="font-poppins min-h-screen bg-gray-100">
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
                </div>
    );
}

