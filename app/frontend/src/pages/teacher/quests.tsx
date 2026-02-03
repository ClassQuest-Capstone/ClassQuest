import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";

type QuestionType = "Multiple Choice" | "True/False" | "Short Answer" | "Matching";

type AnswerOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type MatchingPair = {
  id: string;
  left: string;
  right: string;
};

interface Question {
  id: string;
  type: QuestionType;
  title: string;
  difficulty: string;
  xpValue: number;
  questionText: string;
  answerOptions?: AnswerOption[];
  correctAnswer?: string;
  matchingPairs?: MatchingPair[];
  explanation: string;
  hint: string;
  tags: string;
  timeLimit: number;
}

interface QuestData {
  name: string;
  type: string;
  subject: string;
  grade: string;
  description: string;
  difficulty: string;
  reward: string;
}

const Quests = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const questDataFromModal = location.state?.questData as QuestData | undefined;

  const questionTypes: QuestionType[] = [
    "Multiple Choice",
    "True/False",
    "Short Answer",
    "Matching",
  ];

  // State for managing questions list
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for current question
  const [activeTab, setActiveTab] = useState<QuestionType>("Multiple Choice");
  const [questionTitle, setQuestionTitle] = useState(
    questDataFromModal?.name || "New Question"
  );
  const [difficulty, setDifficulty] = useState(questDataFromModal?.difficulty || "Medium");
  const [xpValue, setXpValue] = useState(25);
  const [questionText, setQuestionText] = useState(
    questDataFromModal?.description || ""
  );
  const [answerOptions, setAnswerOptions] = useState<AnswerOption[]>([
    { id: "1", text: "", isCorrect: true },
    { id: "2", text: "", isCorrect: false },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([
    { id: "1", left: "", right: "" },
  ]);
  const [explanation, setExplanation] = useState("");
  const [hint, setHint] = useState("");
  const [tags, setTags] = useState(questDataFromModal?.subject || "");
  const [timeLimit, setTimeLimit] = useState(120);

  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    feather.replace();
  }, [activeTab, answerOptions, matchingPairs]);

  // Reset form for new question
  const resetForm = () => {
    setQuestionTitle("");
    setDifficulty("Easy");
    setXpValue(25);
    setQuestionText("");
    setAnswerOptions([
      { id: "1", text: "", isCorrect: true },
      { id: "2", text: "", isCorrect: false },
    ]);
    setCorrectAnswer("");
    setMatchingPairs([{ id: "1", left: "", right: "" }]);
    setExplanation("");
    setHint("");
    setTags("");
    setTimeLimit(120);
    setSelectedQuestion(null);
  };

  // Create new question
  const handleCreateNewQuestion = () => {
    setIsCreating(true);
    resetForm();
    setActiveTab("Multiple Choice");
  };

  // Save question (Just adding questions for now since no backend integration)
  const handleSaveQuestion = () => {
    const newQuestion: Question = {
      id: selectedQuestion?.id || Date.now().toString(),
      type: activeTab,
      title: questionTitle,
      difficulty,
      xpValue,
      questionText,
      answerOptions: activeTab === "Multiple Choice" ? answerOptions : undefined,
      correctAnswer: activeTab === "True/False" || activeTab === "Short Answer" ? correctAnswer : undefined,
      matchingPairs: activeTab === "Matching" ? matchingPairs : undefined,
      explanation,
      hint,
      tags,
      timeLimit,
    };

    if (selectedQuestion) {
      // Update existing question
      setQuestions(questions.map((q) => (q.id === selectedQuestion.id ? newQuestion : q)));
    } else {
      // Add new question
      setQuestions([...questions, newQuestion]);
    }

    console.log("Question saved:", newQuestion);
    resetForm();
    setIsCreating(false);
  };

  // Delete question
  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    if (selectedQuestion?.id === id) {
      setSelectedQuestion(null);
      setIsCreating(false);
    }
  };

  // Load question for editing
  const handleEditQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setActiveTab(question.type);
    setQuestionTitle(question.title);
    setDifficulty(question.difficulty);
    setXpValue(question.xpValue);
    setQuestionText(question.questionText);
    setAnswerOptions(question.answerOptions || []);
    setCorrectAnswer(question.correctAnswer || "");
    setMatchingPairs(question.matchingPairs || []);
    setExplanation(question.explanation);
    setHint(question.hint);
    setTags(question.tags);
    setTimeLimit(question.timeLimit);
    setIsCreating(true);
  };

  // Multiple Choice handlers
  const handleAddOption = () => {
    const newOption: AnswerOption = {
      id: Date.now().toString(),
      text: "",
      isCorrect: false,
    };
    setAnswerOptions([...answerOptions, newOption]);
  };

  const handleRemoveOption = (id: string) => {
    setAnswerOptions(answerOptions.filter((option) => option.id !== id));
  };

  const handleOptionChange = (id: string, text: string) => {
    setAnswerOptions(
      answerOptions.map((option) => (option.id === id ? { ...option, text } : option))
    );
  };

  const handleCorrectAnswerChange = (id: string) => {
    setAnswerOptions(
      answerOptions.map((option) => ({
        ...option,
        isCorrect: option.id === id,
      }))
    );
  };

  // Matching handlers
  const handleAddMatchingPair = () => {
    const newPair: MatchingPair = {
      id: Date.now().toString(),
      left: "",
      right: "",
    };
    setMatchingPairs([...matchingPairs, newPair]);
  };

  const handleRemoveMatchingPair = (id: string) => {
    setMatchingPairs(matchingPairs.filter((pair) => pair.id !== id));
  };

  const handleMatchingChange = (id: string, side: "left" | "right", text: string) => {
    setMatchingPairs(
      matchingPairs.map((pair) =>
        pair.id === id ? { ...pair, [side]: text } : pair
      )
    );
  };

  // No backendintegration yet, so manual JSON download
  const handleDownloadJSON = () => {
  const dataStr = JSON.stringify(questions, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "questQuestions.json";
  a.click();

  URL.revokeObjectURL(url);
  navigate("/subjects");
};

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat bg-fixed min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                <Link
                  to="/teacherDashboard"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/teacherDashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/subjects"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Subjects
              </Link>
              <DropDownProfile username="user"onLogout={() => {console.log("Logging out"); /**TODO: Logout logic */}}/>
              
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 pt-24 text-gray-900">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-600">Question Editor</h1>
          </div>
          {isCreating && (
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestion}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                Add Question
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Questions List */}
          <div className="lg:col-span-1">
            <div className="bg-indigo-300 rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">Questions</h2>
                <button
                  onClick={handleCreateNewQuestion}
                  className="text-blue-600 hover:text-blue-800 text-2xl font-bold"
                >
                  +
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {questions.length === 0 ? (
                  <p className="text-gray-700 text-sm">No questions yet</p>
                ) : (
                  questions.map((q) => (
                    <div
                      key={q.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedQuestion?.id === q.id
                          ? "bg-blue-100 border-2 border-blue-600"
                          : "bg-gray-100 hover:bg-gray-200 border-2 border-transparent"
                      }`}
                    >
                      <div
                        onClick={() => handleEditQuestion(q)}
                        className="flex-1"
                      >
                        <p className="font-medium text-sm">{q.title}</p>
                        <p className="text-xs text-gray-600">{q.type}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestion(q.id);
                        }}
                        className="text-red-500 hover:text-red-700 mt-2 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Question Editor */}
          <div className="lg:col-span-3">
            {isCreating ? (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Type Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex">
                    {questionTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={`px-6 py-4 text-center border-b-2 font-medium text-sm transition-all ${
                          activeTab === type
                            ? "text-blue-600 border-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Form */}
                <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Question Title
                      </label>
                      <input
                        type="text"
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={questionTitle}
                        onChange={(e) => setQuestionTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Difficulty
                      </label>
                      <select
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        XP Value
                      </label>
                      <input
                        type="number"
                        className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={xpValue}
                        onChange={(e) => setXpValue(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Text
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Enter your question here..."
                    />
                  </div>

                  {/* Question Type Specific Content */}
                  {activeTab === "Multiple Choice" && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Answer Options</h3>
                        <button
                          onClick={handleAddOption}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-3">
                        {answerOptions.map((option, index) => (
                          <div key={option.id} className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={option.isCorrect}
                              onChange={() => handleCorrectAnswerChange(option.id)}
                              className="h-4 w-4"
                            />
                            <input
                              type="text"
                              className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                              value={option.text}
                              onChange={(e) => handleOptionChange(option.id, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                            />
                            {answerOptions.length > 2 && (
                              <button
                                onClick={() => handleRemoveOption(option.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <i data-feather="x"></i>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeTab === "True/False" || activeTab === "Short Answer") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correct Answer
                      </label>
                      {activeTab === "True/False" ? (
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value)}
                        >
                          <option value="">Select answer</option>
                          <option value="True">True</option>
                          <option value="False">False</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2"
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value)}
                          placeholder="Enter the correct answer"
                        />
                      )}
                    </div>
                  )}

                  {activeTab === "Matching" && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Matching Pairs</h3>
                        <button
                          onClick={handleAddMatchingPair}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          + Add Pair
                        </button>
                      </div>
                      <div className="space-y-3">
                        {matchingPairs.map((pair, index) => (
                          <div key={pair.id} className="grid grid-cols-2 gap-3 items-center">
                            <input
                              type="text"
                              className="border border-gray-300 rounded-lg px-4 py-2"
                              value={pair.left}
                              onChange={(e) =>
                                handleMatchingChange(pair.id, "left", e.target.value)
                              }
                              placeholder="Left side"
                            />
                            <div className="flex gap-3">
                              <input
                                type="text"
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                                value={pair.right}
                                onChange={(e) =>
                                  handleMatchingChange(pair.id, "right", e.target.value)
                                }
                                placeholder="Right side"
                              />
                              {matchingPairs.length > 1 && (
                                <button
                                  onClick={() => handleRemoveMatchingPair(pair.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <i data-feather="x"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation & Hint */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Explanation
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        rows={3}
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        placeholder="Explain the answer..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hint</label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        rows={3}
                        value={hint}
                        onChange={(e) => setHint(e.target.value)}
                        placeholder="Hint for students..."
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="algebra, polynomials"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time Limit (seconds)
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl shadow-lg p-8 text-center">
                <p className="text-gray-900 mb-4">No question selected</p>
                <button
                  onClick={handleCreateNewQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  Create New Question
                </button>
              </div>
            )}
            <div className="justify-center align-middle mt-3">
              <button
                onClick={handleDownloadJSON}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
              >
                Save Questions
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Quests;