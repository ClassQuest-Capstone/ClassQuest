import React from "react";
import "./styles/Mage.css";

interface SpriteProps {
  className?: string;
}

/**
 * A React component that renders a pixel art sprite of a mage.
 *
 * @param {SpriteProps} props - The props for the component.
 * @param {string} [props.className] - The CSS class name to apply to the component.
 *
 * @returns {React.ReactElement} - The rendered component.
 */
export const MageSprite: React.FC<SpriteProps> = ({ className }) => {
  return (
    <div className={`Mage-sprite ${className ?? ""}`}>
      <img
        src="/assets/cards/Mage_1.png"
        alt="ClassQuest"
        className="Mage-img"
      />
    </div>
  );
};
