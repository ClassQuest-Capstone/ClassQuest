import React, { useState } from "react";
import { useTutorial } from "./context";
import { MageSprite } from "./tutorialSprite";
import "./styles/intro.css";

/**
 * TutorialIntroModal component.
 * This component renders a modal that introduces the user to the tutorial.
 * It displays a welcome message and two buttons: "Maybe later" and "Begin Tour". If the user clicks "Maybe later", the modal closes.
 * If the user clicks "Begin Tour", the modal closes and the tutorial starts.
 */
export const TutorialIntroModal: React.FC = () => {
  const { startTutorial } = useTutorial();
  const [open, setOpen] = useState(true);

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
          <MageSprite />
          <div>
            {/** Intro content */}
            <h2 className="intro-title">Welcome!</h2>
            <p className="intro-subtitle">
              I am your ClassQuest Mentor. Let me guide you through the interface
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
