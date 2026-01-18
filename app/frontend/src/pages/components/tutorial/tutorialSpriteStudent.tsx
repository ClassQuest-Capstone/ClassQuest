import React from "react";
import "./styles/Healer.css";

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
export const HealerSprite: React.FC<SpriteProps> = ({ className }) => {
  return (
    <div className={`Healer-sprite ${className ?? ""}`}>
      <img
        src="/assets/cards/Healer_2.png"
        alt="ClassQuest"
        className="Healer-img"
      />
    </div>
  );
};
