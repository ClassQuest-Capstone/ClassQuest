import React from "react";
import { useTutorial } from "./contextStudent";
import { HealerSprite } from "./tutorialSpriteStudent";
import "./styles/tutorial.css";

/**
 * TutorialOverlay component.
 * This component renders a tutorial overlay to guide the user through the
 * dashboard features. 
 * If the current step is undefined, it returns null.
 * @returns {JSX.Element | null} - The tutorial overlay component.
 */
export const TutorialOverlay: React.FC = () => {
  const { currentStep, nextStep, endTutorial } = useTutorial();

  if (!currentStep) return null;

  const isFinal = currentStep === "Footer";

/**
 * Returns configuration for the current step in the tutorial.
 * Configuration includes targetId (the DOM element to highlight),
 * title (the title of the step), and text (the explanatory text for the step).
 * If the current step is undefined, it returns null.
 * If the current step is not recognized, it returns null.
 */
  const getConfig = () => {
    switch (currentStep) {
      case "Nav-Tabs":
        return {
          targetId: "nav-tab",
          title: "Navigation tabs",
          text:
            "Use these buttons to cehck out your guild activities, class leaderboards, and shop",
        };
      case "Guilds":
        return {
          targetId: "guilds",
          title: "Gold & Guilds",
          text:
            "These are your current gold amount and guilds you are part of. Join a guild to take on new quests and challenges with your friends",
        };
      case "Equipment":
        return {
          targetId: "equipment",
          title: "Equipment",
          text:
            "View your currently equipped items and change them to customize your avatar",
        };
      case "Appearance":
        return {
          targetId: "appear",
          title: "Character Appearance",
          text:
            "This is where you can see your character's appearance. Customize your look with different outfits",
        };
      case "Inventory":
      return {
        targetId: "inventory",
        title: "Inventory ",
        text:
          "Here is where all your collected items are stored. You can equip them from here",
      };
      case "Stats":
        return {
          targetId: "stats",
          title: "Stats",
          text:
            "Track your character's progress, including strength, HP, intelligence",
        };
      case "Skills":
        return {
          targetId: "skills",
          title: "Skills",
          text:
            "View your current skills and abilities. level up to unlock new skills",
        };
      case "Footer":
        return {
          targetId: "footer",
          title: "Quests and Rewards",
          text:
            "Use these tabs to view Active quests, Quests based on subjects, and claim your rewards as you level up",
        };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!config) return null;

  const targetEl = document.getElementById(config.targetId);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

// Scroll to target + measure rect AFTER scroll
React.useEffect(() => {
  if (!targetEl) return;

  // Scroll into view
  targetEl.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  // Measure after scroll settles
  const timeout = setTimeout(() => {
    const r = targetEl.getBoundingClientRect();
    setRect(r);
  }, 250); 

  return () => clearTimeout(timeout);
}, [currentStep, targetEl]);


  // Bubble position with viewport boundary checks
  const getBubbleStyle = (): React.CSSProperties => {
    if (!rect) {
      return {
        position: "fixed",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 320,
        zIndex: 9999,
      };
    }

    const bubbleWidth = 280;
    const spacing = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Search if target is nav menu
    const isNavMenu = config.targetId === "nav-menu";
    
    // Positioning to the right or left of target
    const rightSpace = viewportWidth - rect.right;
    const leftSpace = rect.left;
    
    // For nav menu or left-side elements, prefer positioning to the right if not enough space on right, position above or below instead
    const shouldPositionRight = !isNavMenu || rightSpace >= bubbleWidth + spacing;
    const shouldPositionLeft = !shouldPositionRight && leftSpace >= bubbleWidth + spacing;
    
    // Vertical position calculation
    let top = rect.top;
    const bubbleHeight = 200;
    
    // Positioning to the right of nav menu, center vertically relative to menu
    if (isNavMenu && shouldPositionRight) {
      top = rect.top + (rect.height / 2) - (bubbleHeight / 2);
    } else {
      top = rect.top - 16;
    }
    
    // Ensuring bubble stays within viewport vertically
    if (top + bubbleHeight > viewportHeight - 16) {
      top = viewportHeight - bubbleHeight - 16;
    }
    if (top < 16) {
      top = 16;
    }

    if (shouldPositionLeft) {
      // Position to the left of the target
      return {
        position: "fixed",
        top: top,
        left: Math.max(16, rect.left - bubbleWidth - spacing),
        maxWidth: bubbleWidth,
        zIndex: 9999,
      };
    } else if (shouldPositionRight) {
      // Position to the right of the target (default)
      return {
        position: "fixed",
        top: top,
        left: Math.min(rect.right + spacing, viewportWidth - bubbleWidth - 16),
        maxWidth: bubbleWidth,
        zIndex: 9999,
      };
    } else {
      // Not enough space on either side, position centered below
      return {
        position: "fixed",
        top: Math.min(rect.bottom + spacing, viewportHeight - bubbleHeight - 16),
        left: Math.max(16, Math.min(rect.left + (rect.width / 2) - (bubbleWidth / 2), viewportWidth - bubbleWidth - 16)),
        maxWidth: bubbleWidth,
        zIndex: 9999,
      };
    }
  };

  const bubbleStyle = getBubbleStyle();

  return (
    <>
      {/* Dim background */}
      <div className="tutorial-backdrop" onClick={endTutorial} />

      {/* Highlight box */}
      {rect && (
        <div
          className="tutorial-highlight"
          style={{
            position: "fixed",
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            zIndex: 9998,
          }}
        />
      )}

      {/* Healer + bubble */}
      <div style={bubbleStyle} className="tutorial-bubble-container">
        <div className="tutorial-bubble">
          <div className="tutorial-header">
            <HealerSprite />
            <div className="tutorial-title">{config.title}</div>
          </div>
          <p className="tutorial-text">{config.text}</p>
          <div className="tutorial-actions">
            <button className="tutorial-secondary" onClick={endTutorial}>
              Skip
            </button>
            <button
              className="tutorial-primary"
              onClick={isFinal ? endTutorial : nextStep}
            >
              {isFinal ? "Explore Dashboard" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
