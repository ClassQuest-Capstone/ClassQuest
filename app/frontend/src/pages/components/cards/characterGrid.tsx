import React from "react";
import { CharacterCard } from "./characterCard";
import { characters } from "./characters";

export function CharacterGrid() {
  return (
    <div className="w-full flex justify-center">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-6 pb-16 max-w-6xl mx-auto ">
        {characters.map((hero) => (
          <CharacterCard key={hero.name} {...hero} />
        ))}
      </div>
    </div>
  );
}

