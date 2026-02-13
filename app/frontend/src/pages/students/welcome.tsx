// src/pages/students/welcome.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

type CharacterClass = "Guardian" | "Mage" | "Healer";
type Gender = "M" | "F";
type Skin = "white" | "brown" | "black";

type Option = {
  id: CharacterClass;
  title: string;
  tagline: string;
  description: string;
};

// Build a list of filename suffixes that match YOUR existing naming
function getCandidates(cls: CharacterClass, gender: Gender, skin: Skin) {
  let suffixes: string[] = [];

  if (skin === "white") {
    // you have GuardianMW + GuardianWF, and you said you also have WM versions
    suffixes = gender === "M" ? ["MW", "WM"] : ["WF"];
  }

  if (skin === "black") {
    // you have MageBW + GuardianBW (black woman), and also HealerBF (black female)
    suffixes = gender === "M" ? ["BM"] : ["BF", "BW"];
  }

  if (skin === "brown") {
    // you have MageBrW + HealerBrW, and GuardianBrF (so include both)
    suffixes = gender === "M" ? ["BrM"] : ["BrW", "BrF"];
  }

  // Turn suffixes into full paths
  return suffixes.map((s) => `/assets/classes/${cls}${s}.png`);
}

// Image component that auto-falls-back to the next filename if one fails
function SpriteImg({
  cls,
  gender,
  skin,
  alt,
  className,
}: {
  cls: CharacterClass;
  gender: Gender;
  skin: Skin;
  alt: string;
  className?: string;
}) {
  const candidates = useMemo(() => getCandidates(cls, gender, skin), [cls, gender, skin]);
  const [idx, setIdx] = useState(0);

  // reset fallback index whenever selection changes
  useEffect(() => setIdx(0), [cls, gender, skin]);

  const src = candidates[idx] ?? "/assets/classes/placeholder.png";

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        // try next candidate, else fallback placeholder
        setIdx((i) => (i + 1 < candidates.length ? i + 1 : i));
      }}
    />
  );
}

export default function Welcome() {
  const navigate = useNavigate();

  const [selected, setSelected] = useState<CharacterClass>("Guardian");
  const [gender, setGender] = useState<Gender>("M");
  const [skin, setSkin] = useState<Skin>("white");

  const options: Option[] = useMemo(
    () => [
      {
        id: "Guardian",
        title: "Guardian",
        tagline: "Shield of the classroom",
        description: "Protect allies and stand your ground.",
      },
      {
        id: "Mage",
        title: "Mage",
        tagline: "Arcane problem-solver",
        description: "Blast enemies with powerful spells.",
      },
      {
        id: "Healer",
        title: "Healer",
        tagline: "Support of the squad",
        description: "Keep the team alive and boosted.",
      },
    ],
    []
  );

  const active = options.find((o) => o.id === selected)!;

  const choose = () => {
    localStorage.setItem("selectedClass", selected);
    localStorage.setItem("selectedGender", gender);
    localStorage.setItem("selectedSkin", skin);
    navigate("/character");
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center text-white"
      style={{ backgroundImage: "url('/assets/background/selection.png')" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="mb-6">
          <p className="text-xs tracking-[0.25em] text-gray-300/80">
            CLASSQUEST • CHARACTER SELECT
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2">
            Choose Your Character
          </h1>
          <p className="text-gray-300 mt-2">
            Pick a class, then choose gender + skin tone.
          </p>
        </div>

        {/* Customization controls */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4 md:p-5 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            {/* Gender */}
            <div>
              <p className="text-[10px] tracking-[0.25em] text-gray-300/80 mb-2">
                APPEARANCE • GENDER
              </p>
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => setGender("M")}
                  className={[
                    "px-4 py-2 rounded-xl text-sm font-bold transition",
                    gender === "M" ? "bg-yellow-500 text-black" : "text-gray-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender("F")}
                  className={[
                    "px-4 py-2 rounded-xl text-sm font-bold transition",
                    gender === "F" ? "bg-yellow-500 text-black" : "text-gray-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  Female
                </button>
              </div>
            </div>

            {/* Skin tone */}
            <div>
              <p className="text-[10px] tracking-[0.25em] text-gray-300/80 mb-2">
                APPEARANCE • SKIN TONE
              </p>
              <div className="inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setSkin("white")}
                  className={[
                    "px-4 py-2 rounded-xl border text-sm font-extrabold transition",
                    skin === "white"
                      ? "bg-yellow-500 text-black border-yellow-400/60"
                      : "bg-black/30 text-gray-200 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setSkin("brown")}
                  className={[
                    "px-4 py-2 rounded-xl border text-sm font-extrabold transition",
                    skin === "brown"
                      ? "bg-yellow-500 text-black border-yellow-400/60"
                      : "bg-black/30 text-gray-200 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Brown
                </button>
                <button
                  type="button"
                  onClick={() => setSkin("black")}
                  className={[
                    "px-4 py-2 rounded-xl border text-sm font-extrabold transition",
                    skin === "black"
                      ? "bg-yellow-500 text-black border-yellow-400/60"
                      : "bg-black/30 text-gray-200 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Preview chip */}
            <div className="md:text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10">
                <span className="text-[10px] tracking-widest text-gray-200">PREVIEW</span>
                <span className="text-sm font-bold text-yellow-300">{active.title}</span>
                <span className="text-xs text-gray-200/80">
                  • {gender === "M" ? "male" : "female"} • {skin}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Character cards */}
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
                <div className="relative h-[300px] md:h-[340px] bg-black/35 flex items-center justify-center">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-tr from-indigo-500/10 via-transparent to-amber-500/10" />

                  <SpriteImg
                    cls={opt.id}
                    gender={gender}
                    skin={skin}
                    alt={`${opt.title} ${gender} ${skin}`}
                    className="h-full w-full object-contain p-6 drop-shadow-[0_25px_25px_rgba(0,0,0,0.35)]"
                  />

                  {isSelected && (
                    <div className="absolute top-4 right-4 text-xs font-extrabold px-3 py-1 rounded-full bg-yellow-500 text-black">
                      SELECTED
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h2 className="text-2xl font-extrabold">{opt.title}</h2>
                  <p className="text-sm text-gray-300 mt-1">{opt.tagline}</p>
                  <p className="text-base text-gray-200/90 mt-3">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Begin */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-6 md:p-8 shadow-2xl">
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
