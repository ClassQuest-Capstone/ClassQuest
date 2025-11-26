import React, { useEffect, useMemo, useState } from "react";
import feather from "feather-icons";
import { Link } from "react-router-dom";
import questQuestions from "../features/utils/questQuestions.json";

// Types matching questQuestions.json
interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: string;
  title: string;
  difficulty: string;
  xpValue: number;
  questionText: string;
  answerOptions: AnswerOption[];
  explanation: string;
  hint: string;
  tags: string;
  timeLimit: number;
  goldReward: number;
}

const questions = questQuestions as Question[];

const ProblemSolve: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // store selected answer id per question
  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>(
    () => questions.map(() => null)
  );

  const [showHint, setShowHint] = useState(false);

  // per-question remaining XP (starts at question.xpValue, -1 on each wrong attempt)
  const [remainingXp, setRemainingXp] = useState<number[]>(() =>
    questions.map((q) => q.xpValue)
  );

  // finished quest flag
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentRemainingXp =
    remainingXp[currentIndex] ?? currentQuestion.xpValue;

  // Feather icons refresh
  useEffect(() => {
    feather.replace();
  }, [currentIndex, selectedOptions, showHint, isFinished]);

  const handleSelect = (optionId: string) => {
    setSelectedOptions((prev) => {
      const copy = [...prev];
      copy[currentIndex] = optionId;
      return copy;
    });
  };

  const handlePrevious = () => {
    if (isFinished) return; // no prev nav on results screen
    setShowHint(false);
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  };

  const handleSubmit = () => {
    if (isFinished) return;

    setShowHint(false);

    const selectedId = selectedOptions[currentIndex];

    if (!selectedId) {
      alert("Please choose an answer before continuing.");
      return;
    }

    const selectedOpt = currentQuestion.answerOptions.find(
      (opt) => opt.id === selectedId
    );

    if (!selectedOpt) {
      alert("Something went wrong. Please choose an answer again.");
      return;
    }

    if (!selectedOpt.isCorrect) {
      // Wrong answer: subtract 1 XP (down to 0) and stay on this question
      const currentXp = currentRemainingXp;
      const newXp = Math.max(0, currentXp - 1);

      setRemainingXp((prev) => {
        const copy = [...prev];
        copy[currentIndex] = newXp;
        return copy;
      });

      alert(
        `Incorrect, try again.\nXP reward for this question is now ${newXp}.`
      );
      return;
    }

    // Correct answer: move to next question or finish
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      // last question correct → show rewards screen
      setIsFinished(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Compute totals: only count XP and Gold for questions whose final selected answer is correct
  const { totalXp, totalGold, correctCount } = useMemo(() => {
    let xp = 0;
    let gold = 0;
    let correct = 0;

    questions.forEach((q, index) => {
      const selId = selectedOptions[index];
      if (!selId) return;

      const opt = q.answerOptions.find((o) => o.id === selId);
      if (opt?.isCorrect) {
        correct++;
        xp += remainingXp[index] ?? q.xpValue;
        gold += q.goldReward;
      }
    });

    return { totalXp: xp, totalGold: gold, correctCount: correct };
  }, [remainingXp, selectedOptions]);

  const progressBase =
    questions.length > 0
      ? Math.round((correctCount / questions.length) * 100)
      : 0;
  const progress = isFinished ? 100 : progressBase;

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedOptions(questions.map(() => null));
    setRemainingXp(questions.map((q) => q.xpValue));
    setShowHint(false);
    setIsFinished(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
        className="min-h-screen bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/assets/background/quest-bg.png')"
        }}
      >
      {/* NAVBAR */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <i data-feather="book-open" className="w-8 h-8 mr-2" />
              <span className="text-xl font-bold">ClassQuest</span>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/character"
                className="px-3 py-2 rounded-md text-sm bg-primary-800"
              >
                Character
              </Link>
              <Link to="/guilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                 Guilds
              </Link>
              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm hover:bg-primary-600"
              >
                Leaderboard
              </Link>

              <div className="flex items-center ml-4">
                <div className="flex items-center bg-primary-600 px-3 py-1 rounded-full">
                  <i
                    data-feather="coins"
                    className="h-5 w-5 text-yellow-400"
                  />
                  <span className="ml-1 font-medium">1,245</span>
                </div>
              </div>

              <div className="relative ml-3">
                <button className="flex items-center text-sm rounded-full">
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt="User"
                  />
                  <span className="ml-2">Alex</span>
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button className="p-2 rounded-md hover:bg-primary-600">
                <i data-feather="menu" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* IF FINISHED → REWARD SCREEN */}
        {isFinished ? (
          <>
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <h1 className="text-3xl font-bold text-center text-green-600 mb-2">
                Quest Complete!
              </h1>
              <p className="text-center text-gray-600 mb-6">
                Awesome job! Here’s what you earned for this quest.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-1">
                    Total XP
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    {totalXp}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-yellow-600 font-semibold mb-1">
                    Total Gold
                  </div>
                  <div className="text-2xl font-bold text-yellow-700">
                    {totalGold}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-green-600 font-semibold mb-1">
                    Correct Answers
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    {correctCount}/{questions.length}
                  </div>
                </div>
              </div>

              {/* Per-question summary */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Question Breakdown
                </h2>
                <div className="space-y-2">
                  {questions.map((q, index) => {
                    const selId = selectedOptions[index];
                    const opt = q.answerOptions.find((o) => o.id === selId);
                    const isCorrect = opt?.isCorrect ?? false;
                    const xpEarned = isCorrect
                      ? remainingXp[index] ?? q.xpValue
                      : 0;
                    const goldEarned = isCorrect ? q.goldReward : 0;

                    return (
                      <div
                        key={q.id}
                        className="flex justify-between items-center bg-gray-50 rounded-md px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium text-gray-800">
                            Q{index + 1}: {q.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {isCorrect
                              ? "Correct"
                              : selId
                              ? "Incorrect"
                              : "Not answered"}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="text-blue-600 font-semibold">
                            +{xpEarned} XP
                          </div>
                          <div className="text-yellow-600 font-semibold">
                            +{goldEarned} Gold
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-center sm:space-x-4 space-y-3 sm:space-y-0">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
                >
                  Retry Quest
                </button>
                <Link
                  to="/character"
                  className="px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-medium text-center"
                >
                  Back to Character
                </Link>
              </div>
            </div>

            {/* Progress bar at 100% */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>
                  Quest Progress: {questions.length}/{questions.length} Completed
                </span>
                <span>100%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full"
                  style={{ width: `100%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* NORMAL QUESTION VIEW */}
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {currentQuestion.title}
                </h1>
                <p className="text-gray-600">Tag: {currentQuestion.tags}</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                  +{currentRemainingXp} XP
                </div>
                <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                  +{currentQuestion.goldReward} Gold
                </div>
              </div>
            </div>

            {/* Question Block */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
              {/* Info bar */}
              <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                <div>
                  <span className="font-bold">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-300">
                    Difficulty: {currentQuestion.difficulty}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="bg-gray-700 px-3 py-1 rounded-full text-sm">
                    <i className="inline mr-1" data-feather="clock" />{" "}
                    {currentQuestion.timeLimit}s
                  </div>
                  <button
                    type="button"
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full text-sm"
                    onClick={() => setShowHint((prev) => !prev)}
                  >
                    <i className="inline mr-1" data-feather="help-circle" />
                    Hint
                  </button>
                </div>
              </div>

              {/* Problem */}
              <div className="p-6">
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <p className="text-lg font-medium text-gray-600 mb-4">
                    Choose the correct answer:
                  </p>
                  <p className="text-gray-700 text-xl font-semibold text-center whitespace-pre-line">
                    {currentQuestion.questionText}
                  </p>
                </div>

                {/* Hint */}
                {showHint &&
                  currentQuestion.hint &&
                  currentQuestion.hint !== "N/A" && (
                    <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
                      <span className="font-semibold">Hint: </span>
                      {currentQuestion.hint}
                    </div>
                  )}

                {/* Answer Choices */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {currentQuestion.answerOptions.map((opt, i) => {
                    const isSelected = selectedOptions[currentIndex] === opt.id;
                    const letter = String.fromCharCode(65 + i); // A, B, C, D...

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`bg-white border rounded-lg p-4 text-left flex items-start transition
                        ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200"
                        }`}
                        onClick={() => handleSelect(opt.id)}
                      >
                        <span
                          className={`rounded-full w-8 h-8 flex items-center justify-center mr-4 font-bold
                          ${
                            isSelected
                              ? "bg-indigo-500 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="font-medium text-gray-900">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Tools row with Show Work + Submit */}
                <div className="flex justify-between items-center mb-6">
                  {/* Left: tool icons */}
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
                    >
                      <i data-feather="type" className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
                    >
                      <i data-feather="divide" className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
                    >
                      <i data-feather="square" className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
                    >
                      <i data-feather="edit-3" className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Right: Show Work + Submit */}
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-4 py-2 rounded-lg flex items-center"
                    >
                      <i data-feather="eye" className="mr-2" />
                      Show Work
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
                    >
                      {currentIndex === questions.length - 1
                        ? "Finish Quest"
                        : "Submit"}
                    </button>
                  </div>
                </div>

                {/* Work Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-6 min-h-[150px]">
                  <p className="text-gray-400 italic">
                    Your work area (coming soon)
                  </p>
                </div>

                {/* Bottom navigation: Previous + Save & Exit */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className={`px-6 py-2 rounded-lg flex items-center ${
                      currentIndex === 0
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                    }`}
                  >
                    <i data-feather="arrow-left" className="mr-2" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg flex items-center"
                  >
                    <i data-feather="save" className="mr-2" />
                    Save &amp; Exit
                  </button>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>
                  Quest Progress: {correctCount}/{questions.length} Completed
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProblemSolve;
