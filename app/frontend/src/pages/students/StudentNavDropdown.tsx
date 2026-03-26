import React, { useEffect, useRef, useState } from "react";
import { handleLogout } from "../features/utils/logout.js";

type Props = {
  displayName: string;
  avatarSrc?: string;
};

/**
 * Profile dropdown used in the student navbar.
 * Clicking the avatar/name toggles a dropdown with "Sign out".
 */
export const StudentNavDropdown: React.FC<Props> = ({
  displayName,
  avatarSrc = "/assets/mage-head.png",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isOpen &&
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative ml-3" ref={menuRef}>
      <div>
        <button
          ref={buttonRef}
          type="button"
          className="flex items-center text-sm rounded-full focus:outline-none"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <img
            className="h-8 w-8 rounded-full border border-white/30"
            src={avatarSrc}
            alt="User avatar"
          />
          <span className="ml-2 text-sm font-medium">{displayName}</span>
        </button>
      </div>

      <div
        className={`origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 ${
          isOpen ? "" : "hidden"
        }`}
      >
        <button
          onClick={handleLogout}
          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};
