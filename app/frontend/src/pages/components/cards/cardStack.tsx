import React from 'react';
import { Card } from './card';
import { cards } from './assets';

export const CardStack = () => {
  return (
    <div className="w-full flex justify-center mt-5 mb-0">
      <div className="relative group h-[200px] w-[600px]">
        {/** Cards ordering and animation */}
        {cards.map((card, index) => {
          const totalCards = cards.length; // Num of cards
          const centerIndex = (totalCards - 1) / 2; // Center card index
          const baseOffset = index * 180;      // Stack spacing
          const distanceFromCenter = index - centerIndex; // Distance from center
          const hoverOffset = distanceFromCenter * 80;    // spread outward from center
          const z = 10 - index;

          return (
            <div
              key={index}
              className="absolute top-0 left-0 transition-all duration-500 ease-out"
              style={{
                zIndex: z,
                transform: `translateX(${baseOffset}px)`,
              }}
            >
              <div
                className="transition-all duration-500 ease-out group-hover:translate-x-[var(--hover-x)]"
                style={{
                  ["--hover-x" as any]: `${hoverOffset}px`,
                }}
              >
                <Card {...card} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
