import React, { useState, useEffect } from "react";
import { useTutorial } from "./contextStudent.js";
import { HealerSprite } from "./tutorialSpriteStudent.js";
import { fetchAuthSession } from "aws-amplify/auth";
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
    const initializeModal = async () => {
      try {
        // Get current user's ID
        const session = await fetchAuthSession();
        const userId = String(session.tokens?.idToken?.payload?.sub || "");
        
        if (!userId) {
          // User not authenticated, don't show modal
          return;
        }

        // Check if THIS user has seen the intro modal
        const userModalKey = `cq_hasSeenIntroModal_${userId}`;
        const hasSeenIntroModal = localStorage.getItem(userModalKey);
        if (!hasSeenIntroModal) {
          setOpen(true);
          localStorage.setItem(userModalKey, "true");
        }
      } catch (err) {
        console.error("Failed to initialize tutorial modal:", err);
      }
    };

    initializeModal();
  }, []);

  if (!open) return null;

/**
 * Handles the start of the tutorial. When called, it sets open to false and starts the tutorial.
 */
  const handleStart = () => {
  setOpen(false);
  startTutorial();
};

 /* const waitForDashboard = () => {
    const el = document.getElementById("Active-tab");
    if (el) {
      startTutorial();
    } else {
      requestAnimationFrame(waitForDashboard);
    }
  };

  waitForDashboard();
};*/


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
