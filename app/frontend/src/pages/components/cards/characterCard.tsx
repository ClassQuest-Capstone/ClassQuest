import React from "react";

export type CharacterCardProps = {
// Values for character card
  name: string;
  role: string;
  image: string;
  accent: string; 
};

export function CharacterCard({ name, role, image, accent }: CharacterCardProps) {
  return (
    <div
      className="rounded-2xl p-4 bg-[#efe6bc] shadow-lg transform transition hover:-translate-y-1 hover:shadow-2xl cursor-pointer"
      style={{ border: `3px solid ${accent}` }}
    >
    {/** Character card */}
      <div className="w-full flex justify-center">
        <img
          src={image}
          alt={name}
          className="h-60 w-25 "
        />
      </div>
      {/** Character name and role */}
      <h3 className="mt-4 text-xl font-bold text-[#5A4632] text-center">
        {name}
      </h3>

      <p className="text-[#2A2A2A] text-center text-sm">{role}</p>
    </div>
  );
}
