import React from 'react';

// Values for character card
export type CardProps = {
  title: string;
  subtitle: string;
  backgroundColors: { top: string; bottom: string };
  image: string;
};

export function Card({ title, subtitle, backgroundColors, image }: CardProps) {
  const { top, bottom } = backgroundColors;

  return (
    <div
      className="card flex flex-col justify-between p-5 rounded-xl text-white overflow-hidden w-60 h-75 transition-all duration-300"
      style={{ background: `linear-gradient(to bottom, ${top}, ${bottom})`, }}>
        {/** Card content */}
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm">{subtitle}</p>
      </div>

      <img
        src={image}
        alt={title}
        className="w-full h-48 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
      />
    </div>
  );
}
