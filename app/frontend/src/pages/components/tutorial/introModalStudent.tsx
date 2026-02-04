import React, { useState, useEffect } from "react";
import { useTutorial } from "./contextStudent.js";
import { HealerSprite } from "./tutorialSpriteStudent.js";
import "./styles/intro.css";

/**
 * TutorialIntroModal component.
 * This component renders a modal that introduces the user to the tutorial.
 * It displays a welcome message and two buttons: "Maybe later" and "Begin Tour". If the user clicks "Maybe later", the modal closes.
 * If the user clicks "Begin Tour", the modal closes and the tutorial starts.
 * The modal only shows on first signup.
 */
export const TutorialIntroModal: React.FC = () => {
  const { startTutorial } = useTutorial();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if this is the user's first time
    const hasSeenIntroModal = localStorage.getItem("cq_hasSeenIntroModal");
    if (!hasSeenIntroModal) {
      setOpen(true);
      localStorage.setItem("cq_hasSeenIntroModal", "true");
    }
  }, []);

  if (!open) return null;

/**
 * Handles the start of the tutorial. When called, it sets open to false and starts the tutorial.
 */
  const handleStart = () => {
    setOpen(false);
    startTutorial();
  };

  const handleClose = () => setOpen(false);

  return (
    <div className="intro-backdrop">
      <div className="intro-modal">
        <div className="intro-header">
          <HealerSprite />
          <div>
            {/** Intro content */}
            <h2 className="intro-title">Welcome!</h2>
            <p className="intro-subtitle">
              I am your ClassQuest Mentor. Let me help you navigate the world of ClassQuest 
            </p>
          </div>
        </div>
        <div className="intro-actions">
          <button className="intro-secondary" onClick={handleClose}>
            Maybe later
          </button>
          <button className="intro-primary" onClick={handleStart}>
            Begin Tour
          </button>
        </div>
      </div>
    </div>
  );
};
