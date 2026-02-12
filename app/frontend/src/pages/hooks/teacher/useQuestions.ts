import { useState, useCallback } from "react";
import { type QuestQuestion } from "../../../api/questQuestions.js";
import {
  listQuestQuestions,
  updateQuestQuestion,
  deleteQuestQuestion,
} from "../../../api/questQuestions.js";

interface QuestionEditState {
  prompt: string;
  format: string;
  hint: string;
  explanation: string;
  maxPoints: number;
  difficulty: string;
  timeLimitSeconds: number;
  optionsJson: string;
  correctAnswerJson: string;
  autoGradable: boolean;
}

interface UseQuestionsReturn {
  // Modal states
  questionsModalOpen: boolean;
  questionEditModalOpen: boolean;
  
  // Data states
  questionsList: QuestQuestion[];
  editingQuestion: QuestQuestion | null;
  questionEditLoading: boolean;
  questionEditError: string | null;
  
  // Edit form state
  editFormState: QuestionEditState;
  
  // Functions
  openQuestionsEditor: (templateId: string) => Promise<void>;
  closeQuestionsEditor: () => void;
  openQuestionEditModal: (question: QuestQuestion) => void;
  closeQuestionEditModal: () => void;
  saveQuestionEdit: () => Promise<void>;
  deleteQuestion: (question: QuestQuestion) => Promise<void>;
  
  // State setters for form fields
  setEditFormField: <K extends keyof QuestionEditState>(key: K, value: QuestionEditState[K]) => void;
  addOption: (option: string) => void;
  removeOption: (index: number) => void;
}

export const useQuestions = (): UseQuestionsReturn => {
  // Modal states
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const [questionEditModalOpen, setQuestionEditModalOpen] = useState(false);
  
  // Data states
  const [questionsList, setQuestionsList] = useState<QuestQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuestQuestion | null>(null);
  const [questionEditLoading, setQuestionEditLoading] = useState(false);
  const [questionEditError, setQuestionEditError] = useState<string | null>(null);
  
  // Edit form state
  const [editFormState, setEditFormState] = useState<QuestionEditState>({
    prompt: "",
    format: "SHORT_ANSWER",
    hint: "",
    explanation: "",
    maxPoints: 0,
    difficulty: "EASY",
    timeLimitSeconds: 0,
    optionsJson: "",
    correctAnswerJson: "",
    autoGradable: false,
  });

  const setEditFormField = useCallback(<K extends keyof QuestionEditState>(
    key: K,
    value: QuestionEditState[K]
  ) => {
    setEditFormState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addOption = useCallback((option: string) => {
    if (option.trim()) {
      setEditFormState((prev) => {
        const currentOptions = prev.optionsJson.trim() ? JSON.parse(prev.optionsJson) : [];
        return {
          ...prev,
          optionsJson: JSON.stringify([...currentOptions, option.trim()], null, 2),
        };
      });
    }
  }, []);

  const removeOption = useCallback((index: number) => {
    setEditFormState((prev) => {
      const currentOptions = prev.optionsJson.trim() ? JSON.parse(prev.optionsJson) : [];
      return {
        ...prev,
        optionsJson: JSON.stringify(currentOptions.filter((_: any, i: number) => i !== index), null, 2),
      };
    });
  }, []);

  const openQuestionsEditor = useCallback(async (templateId: string) => {
    try {
      const res = await listQuestQuestions(templateId);
      setQuestionsList((res as any).items ?? []);
      setQuestionsModalOpen(true);
    } catch (e: any) {
      console.error("Failed to load questions:", e);
      setQuestionsList([]);
    }
  }, []);

  const closeQuestionsEditor = useCallback(() => {
    setQuestionsModalOpen(false);
    setQuestionsList([]);
  }, []);

  const openQuestionEditModal = useCallback((question: QuestQuestion) => {
    setEditingQuestion(question);
    setEditFormState({
      prompt: question.prompt,
      format: question.question_format,
      hint: question.hint || "",
      explanation: question.explanation || "",
      maxPoints: question.max_points,
      difficulty: question.difficulty || "EASY",
      timeLimitSeconds: question.time_limit_seconds || 0,
      optionsJson: question.options ? JSON.stringify(question.options) : "",
      correctAnswerJson: question.correct_answer ? JSON.stringify(question.correct_answer) : "",
      autoGradable: question.auto_gradable || false,
    });
    setQuestionEditError(null);
    setQuestionEditModalOpen(true);
  }, []);

  const closeQuestionEditModal = useCallback(() => {
    setQuestionEditModalOpen(false);
    setEditingQuestion(null);
    setEditFormState({
      prompt: "",
      format: "SHORT_ANSWER",
      hint: "",
      explanation: "",
      maxPoints: 0,
      difficulty: "EASY",
      timeLimitSeconds: 0,
      optionsJson: "",
      correctAnswerJson: "",
      autoGradable: false,
    });
  }, []);

  const saveQuestionEdit = useCallback(async () => {
    if (!editingQuestion || !editFormState.prompt.trim()) {
      setQuestionEditError("Question prompt is required");
      return;
    }

    setQuestionEditLoading(true);
    setQuestionEditError(null);

    try {
      let correctData: any = null;
      let optionsData: any = undefined;

      // TODO: fix change these fields to be proper form inputs instead of JSON
      // Parse options JSON if provided
      if (editFormState.optionsJson.trim()) {
        try {
          optionsData = JSON.parse(editFormState.optionsJson);
        } catch (e) {
          throw new Error("Invalid JSON format for options");
        }
      }

      // Parse correct answer JSON
      if (editFormState.correctAnswerJson.trim()) {
        try {
          correctData = JSON.parse(editFormState.correctAnswerJson);
        } catch (e) {
          throw new Error("Invalid JSON format for correct answer");
        }
      }

      const updateData: any = {
        prompt: editFormState.prompt,
        question_format: editFormState.format,
        hint: editFormState.hint || undefined,
        explanation: editFormState.explanation || undefined,
        max_points: Number(editFormState.maxPoints),
        difficulty: editFormState.difficulty,
        time_limit_seconds: Number(editFormState.timeLimitSeconds),
        correct_answer: correctData,
        auto_gradable: Boolean(editFormState.autoGradable),
      };

      if (optionsData) {
        updateData.options = optionsData;
      }

      await updateQuestQuestion(editingQuestion.question_id, updateData);

      // Update local list
      setQuestionsList((prev) =>
        prev.map((q) =>
          q.question_id === editingQuestion.question_id
            ? { ...q, ...updateData }
            : q
        )
      );

      closeQuestionEditModal();
    } catch (e: any) {
      setQuestionEditError(e?.message || "Failed to save question");
    } finally {
      setQuestionEditLoading(false);
    }
  }, [editingQuestion, editFormState, closeQuestionEditModal]);

  const deleteQuestion = useCallback(async (question: QuestQuestion) => {
    if (!window.confirm(`Delete question: "${question.prompt.substring(0, 50)}..."?`)) {
      return;
    }

    try {
      await deleteQuestQuestion(question.question_id);
      setQuestionsList((prev) => prev.filter((q) => q.question_id !== question.question_id));
    } catch (e: any) {
      console.error("Failed to delete question:", e);
      alert("Failed to delete question: " + (e?.message || "Unknown error"));
    }
  }, []);

  return {
    questionsModalOpen,
    questionEditModalOpen,
    questionsList,
    editingQuestion,
    questionEditLoading,
    questionEditError,
    editFormState,
    openQuestionsEditor,
    closeQuestionsEditor,
    openQuestionEditModal,
    closeQuestionEditModal,
    saveQuestionEdit,
    deleteQuestion,
    setEditFormField,
    addOption,
    removeOption,
  };
};
