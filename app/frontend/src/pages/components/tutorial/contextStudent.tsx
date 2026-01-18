import React, { createContext, useContext, useState, ReactNode } from "react";

type TutorialStepId =
  | "Nav-Tabs"
  | "Guilds"
  | "Equipment"
  | "Appearance"
  | "Inventory"
  | "Stats"
  | "Skills"
  | "Footer"
  | "done";

interface ContextValue {
  currentStep: TutorialStepId | null;
  startTutorial: () => void;
  nextStep: () => void;
  endTutorial: () => void;
}

const Context = createContext<ContextValue | undefined>(
  undefined
);

const steps: TutorialStepId[] = [
  "Nav-Tabs",
  "Guilds",
  "Equipment",
  "Appearance",
  "Inventory",
  "Stats",
  "Skills",
  "Footer",
  "done",
];

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const [currentStep, setCurrentStep] = useState<TutorialStepId | null>(null);

  const startTutorial = () => setCurrentStep("Nav-Tabs");

/**
 * Advances to the next step in the tutorial. If the current step is undefined,
 * it simply returns. If the current step is not "done", it advances to the next
 * step in the tutorial. If the next step is "done", it sets the current step to null.
 */
  const nextStep = () => {
    if (!currentStep) return;
    const idx = steps.indexOf(currentStep);
    const next = steps[idx + 1];
    if (!next || next === "done") {
      setCurrentStep(null);
    } else {
      setCurrentStep(next);
    }
  };

  const endTutorial = () => setCurrentStep(null);

  return (
    <Context.Provider
      value={{ currentStep, startTutorial, nextStep, endTutorial }}
    >
      {children}
    </Context.Provider>
  );
};

export const useTutorial = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
};
