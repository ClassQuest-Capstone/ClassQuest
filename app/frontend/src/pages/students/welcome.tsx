// src/pages/students/welcome.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type CharacterClass = "Guardian" | "Mage" | "Healer";

type Option = {
  id: CharacterClass;
  title: string;
  tagline: string;
  description: string;
  imgSrc: string; // character image in /public
};

export default function Welcome() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<CharacterClass>("Guardian");

  const options: Option[] = useMemo(
    () => [
      {
        id: "Guardian",
        title: "Guardian",
        tagline: "Shield of the classroom",
        description: "Protect allies and stand your ground.",
        imgSrc: "/assets/classes/Guardian.png",
      },
      {
        id: "Mage",
        title: "Mage",
        tagline: "Arcane problem-solver",
        description: "Blast enemies with powerful spells.",
        imgSrc: "/assets/classes/Mage.png",
      },
      {
        id: "Healer",
        title: "Healer",
        tagline: "Support of the squad",
        description: "Keep the team alive and boosted.",
        imgSrc: "/assets/classes/Healer.png",
      },
    ],
    []
  );

  const active = options.find((o) => o.id === selected)!;

  const choose = () => {
    localStorage.setItem("selectedClass", selected);
    navigate("/character");
  };

  return (
    <div
    className="min-h-screen bg-cover bg-center text-white"
     style={{ backgroundImage: "url('/assets/background/selection.png')" }}
    >

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="mb-8">
          <p className="text-xs tracking-[0.25em] text-gray-300/80">
            CLASSQUEST • CHARACTER SELECT
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2">
            Choose Your Character
          </h1>
          <p className="text-gray-300 mt-2">
            Pick a class and enter the world.
          </p>
        </div>

        {/* Bigger character cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((opt) => {
            const isSelected = opt.id === selected;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={[
                  "group text-left rounded-3xl border overflow-hidden transition-all",
                  "bg-white/5 hover:bg-white/10",
                  "hover:-translate-y-1 hover:shadow-2xl",
                  isSelected
                    ? "border-yellow-400/80 ring-2 ring-yellow-400/30 shadow-[0_0_45px_rgba(234,179,8,0.18)]"
                    : "border-white/10",
                ].join(" ")}
              >
                {/* Big image area */}
                <div className="relative h-[300px] md:h-[340px] bg-black/35 flex items-center justify-center">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr from-indigo-500/10 via-transparent to-amber-500/10" />

                  <img
                    src={opt.imgSrc}
                    alt={opt.title}
                    className="h-full w-full object-contain p-6 drop-shadow-[0_25px_25px_rgba(0,0,0,0.35)]"
                  />

                  {/* Selected badge */}
                  {isSelected && (
                    <div className="absolute top-4 right-4 text-xs font-extrabold px-3 py-1 rounded-full bg-yellow-500 text-black">
                      SELECTED
                    </div>
                  )}
                </div>

                {/* Text area */}
                <div className="p-6">
                  <h2 className="text-2xl font-extrabold">{opt.title}</h2>
                  <p className="text-sm text-gray-300 mt-1">{opt.tagline}</p>
                  <p className="text-base text-gray-200/90 mt-3">
                    {opt.description}
                  </p>

                  <div className="mt-5">
                    <span className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-black/40 border border-white/10 text-gray-200">
                      Click to select
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Rookie story / intro */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] text-gray-300/80">
                PROLOGUE • THE FIRST STEP
              </p>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-2">
                A Rookie’s Oath
              </h2>
              <p className="text-gray-300 mt-2 max-w-3xl leading-relaxed">
                The bell has rung… and the realm stirs. In the halls of
                ClassQuest, every lesson becomes a path, every question a gate.
                You’re not a legend—not yet. Your gear is simple, your name
                untested, your courage still warming up like morning sunlight on
                cold stone.
              </p>
            </div>

            <div className="md:text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10">
                <span className="text-[10px] tracking-widest text-gray-200">
                  SELECTED
                </span>
                <span className="text-sm font-bold text-yellow-300">
                  {active.title}
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-2 max-w-md md:ml-auto">
                {active.tagline} — {active.description}
              </p>
            </div>
          </div>

          

            <button
              onClick={choose}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold px-7 py-3 rounded-xl transition w-full sm:w-auto"
            >
              Begin Adventure
            </button>
          
        </div>
      </div>
    </div>
  );
}
