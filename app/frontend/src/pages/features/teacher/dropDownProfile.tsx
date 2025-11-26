import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

type DropDownProfileProps = {
  username: string;
  onLogout: () => void;
};

const DropDownProfile = ({ username, onLogout }: DropDownProfileProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Avatar trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 group block focus:outline-none"
      >
        <img
          className="inline-block h-9 w-9 rounded-full ring-3 ring-purple-500 hover:ring-purple-700"
          src="/assets/warrior-head.png"
          alt="Profile"
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          role="menu"
        >
          <div className="py-1">
            <p className="block px-4 py-2 text-sm font-medium text-gray-900">
             Signed in as: {username}
            </p>
            <hr className="my-1 border-gray-200" />
            <Link
              to="/"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Settings
            </Link>
           {/* <button
              onClick={onLogout}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Logout
            </button> */}
             <Link
              to="/role"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              role="menuitem"
            >
              Logout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropDownProfile;
