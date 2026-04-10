// src/pages/teacher/wiki/classesWiki.tsx
import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import feather from "feather-icons";
import DropDownProfile from "../../features/teacher/dropDownProfile.tsx";

// Teacher interface
type TeacherUser = {
  id: string;
  role: "teacher";
  school_id: string;
  displayName?: string;
  email?: string;
};

const questsWikiContent = `
# Quests Management Wiki

Welcome to the **Quests Management** wiki! This guide will walk you through everything you need to know about creating and managing quests in ClassQuest.

---

## Table of Contents

1. Overview
2. Creating a New Quest
3. Quest Types
4. Understanding the Quest Card
5. Managing Quest Questions
6. Assigning Quests to Classes
7. Managing Assigned Quests
8. Understanding the Boss Battle System
9. Best Practices
10. FAQ

---

## Overview

The **Quests** page (also known as Subjects page) is your central hub for creating and managing assignments for your students. Quests are organized by **subject** and displayed as cards showing key information.

### Key Features

- **Quest Templates** - Reusable quest definitions you can assign to multiple classes
- **Boss Battles** - Special challenging quests for collaborative gameplay
- **Question Management** - Add multiple choice, true/false, or matching questions
- **Class Assignment** - Assign quests to specific classes with custom start/due dates
- **Public Sharing** - Optionally share quests with other teachers

---

## Creating a New Quest

### Step 1: Click "Create Quest"

Located in the top-right corner of the Quests page, this blue gradient button opens the quest creation modal.

### Step 2: Fill in Quest Details

| Field | Description |
|-------|-------------|
| **Quest Name** | A descriptive title (e.g., "Fractions Quiz Chapter 5") |
| **Type** | Quest, Daily Quest, or Boss Fight |
| **Subject** | Subject area (e.g., Mathematics, Science) |
| **Grade** | Target grade level (5-8) |
| **Description** | Detailed description of the quest |
| **Difficulty** | Easy, Medium, or Hard |
| **XP Reward** | Experience points earned on completion |
| **Gold Reward** | Gold currency earned on completion |

### Step 3: Add Questions

After creating the quest template, you'll be taken to the **Questions Editor** where you can add questions.

---

## Quest Types

| Type | Description |
|------|-------------|
| **Quest** | Standard assignment with questions |
| **Daily Quest** | Time-limited recurring challenges |
| **Boss Fight** | Collaborative real-time battles (see Boss Battle section) |

---

## Understanding the Quest Card

Each quest template is displayed as a card with the following sections:

### Card Header (Green-Orange Gradient)
- **Quest Icon** - Visual indicator of quest type
- **Quest Title** - The name you assigned
- **Subject** - Subject area of the quest

### Card Body

#### Quest Details
- **Difficulty** - Easy, Medium, or Hard
- **Grade Level** - Target grade
- **Description** - Quest description text
- **Type** - Quest type badge
- **Duration** - Estimated completion time in minutes
- **Rewards** - XP and Gold values
- **Visibility** - Public or Private badge

#### Assignment Status
Shows either:
- **DRAFT** - Yellow badge indicating "Not assigned to any class"
- **Classes Assigned** - Blue panel showing all class assignments

### Action Buttons

| Button | Icon | Action |
|--------|------|--------|
| **Assign** | 👥 Users | Assign quest to a class |
| **Questions** | ❓ Help Circle | Open question editor |
| **Edit** | ✏️ Edit | Modify quest template details |
| **Delete** | 🗑️ Trash | Soft-delete the quest template |

---

## Managing Quest Questions

### Accessing the Questions Editor

Click the **Questions** button on any quest card to open the questions editor.

### Question Types Supported

| Type | Description |
|------|-------------|
| **Multiple Choice** | Single correct answer from multiple options |
| **True/False** | Binary true or false answer |
| **Matching** | Match pairs of items together |

### Creating a Question

1. Click **Create Question** or the **+** button
2. Select the question type tab
3. Fill in the question details:
   - **Question Text** - The prompt shown to students
   - **Answer Options** - For multiple choice questions
   - **Correct Answer** - Mark the correct option(s)
   - **Difficulty** - Question difficulty level
   - **XP Value** - Points for this question
   - **Explanation** - Shown after answering (optional)
   - **Hint** - Help text for students (optional)
   - **Time Limit** - Optional time limit in seconds

### Saving Questions

- **Save & Exit** - Save all questions and return to quests page
- Questions are saved to the quest template and used when assigned to classes

---

## Assigning Quests to Classes

### Opening the Assignment Modal

Click the **Assign** button on any quest card to open the assignment modal.

### Assignment Options

| Field | Description |
|-------|-------------|
| **Class** | Select which class receives the quest |
| **Start Date** | When the quest becomes available (optional) |
| **Due Date** | Deadline for completion (optional) |
| **Title Override** | Custom title for this assignment (optional) |
| **Description Override** | Custom description for this assignment (optional) |
| **Requires Manual Approval** | Teacher must approve submissions |

### How Assignments Work

1. Each assignment creates a **Quest Instance** linked to one class
2. The same template can be assigned to multiple classes
3. Each instance tracks its own status independently
4. Students see the quest in their class quest list

---

## Managing Assigned Quests

When a quest is assigned to classes, the card shows an assignment panel with:

### Instance Information
- **Class Name** - Which class this is assigned to
- **Status Badge** - ACTIVE, DRAFT, or ARCHIVED
- **Start Date** - When the quest starts
- **Due Date** - When the quest is due
- **Title Override** - If a custom title was set

### Instance Actions

| Button | Action |
|--------|--------|
| **Extend** | Modify the due date |
| **Archive** | Mark as archived (hides from students) |
| **Remove** | Delete the assignment from the class |

> **Note:** Removing an assignment archives it but doesn't affect the template.

### Auto-Archive Feature

Quests are automatically archived when their due date passes.

---

## Understanding the Boss Battle System

Boss Battles are collaborative, real-time quiz experiences where students work together to "defeat" a boss.

### Creating a Boss Battle

1. Click **Create Quest**
2. Select **Type: Boss Fight**
3. Fill in the details and create
4. You'll be redirected to the **Boss Questions** editor

### Boss Battle Template Card

Boss templates appear in a separate **Boss Battles** section with:
- **Red-Purple gradient header** with shield icon
- **HP (Health Points)** - Boss's total health
- **XP and Gold rewards**
- **BOSS badge** - Red indicator

### Boss Battle Questions

Boss questions support:
- **Multiple Choice (MCQ_SINGLE)** - Single correct answer
- **True/False** - Binary answer
- **Image Attachments** - Add images to questions

### Assigning Boss Battles to Classes

Boss battles have additional configuration options:

| Setting | Description |
|---------|-------------|
| **Mode Type** | SIMULTANEOUS_ALL, TURN_BASED_GUILD, or RANDOMIZED_PER_GUILD |
| **Question Selection** | ORDERED or RANDOM_NO_REPEAT |
| **Late Join Policy** | DISALLOW_AFTER_COUNTDOWN or ALLOW_SPECTATE |
| **Countdown Seconds** | Time before battle starts |
| **Question Time Limit** | Seconds per question (optional) |
| **Speed Bonus** | Enable bonus for fast answers |
| **Passing Score** | Percentage required to pass |

### Boss Battle Modes

| Mode | Description |
|------|-------------|
| **SIMULTANEOUS_ALL** | All students answer each question together |
| **TURN_BASED_GUILD** | Guilds take turns answering |
| **RANDOMIZED_PER_GUILD** | Random guild selection for each question |

### Boss Battle Instance Statuses

| Status | Description |
|--------|-------------|
| **DRAFT** | Not yet started |
| **ACTIVE** | Ready to be played |
| **LOBBY** | Students are joining |
| **COUNTDOWN** | Battle starting soon |
| **QUESTION_ACTIVE** | Question in progress |
| **INTERMISSION** | Between questions |
| **COMPLETED** | Battle finished |
| **ABORTED** | Cancelled by teacher |

---

## Best Practices

### Quest Creation Tips

| ✅ Do | ❌ Don't |
|-------|----------|
| Use descriptive titles | Use vague names like "Quiz 1" |
| Set appropriate difficulty | Mix difficulties within one quest |
| Add explanations to questions | Leave explanations empty |
| Set reasonable time limits | Set time limits too short |

### Organizing Quests

1. **Use subjects consistently** - Keep subject names standardized
2. **Set grade levels accurately** - Helps with filtering
3. **Add descriptions** - Students know what to expect
4. **Review before assigning** - Check questions for errors

### Boss Battle Tips

1. **Start with small groups** - Test with a few students first
2. **Use SIMULTANEOUS_ALL for beginners** - Easier to manage
3. **Set countdown time** - Give students time to gather
4. **Enable speed bonus carefully** - Can be frustrating for slower students

---

## FAQ

### Q: Can I edit a quest after assigning it?
**A:** Yes! Edits to the template apply to future assignments. Existing instances keep their current state.

### Q: What happens when a quest is archived?
**A:** Students can no longer see or complete it. You can't un-archive quests currently.

### Q: Can students retake quests?
**A:** Depends on your quest instance settings. Check the status of their attempt.

### Q: How do I share quests with other teachers?
**A:** Set \`is_shared_publicly: true\` when creating or editing. Public quests appear in the public templates list.

### Q: What's the difference between deleting and archiving?
**A:** 
- **Deleting** removes the template (soft delete - can't be recovered easily)
- **Archiving** removes a class assignment but keeps the template

### Q: How many questions can a quest have?
**A:** No hard limit, but keep it reasonable for the estimated duration.

### Q: Can I import questions from another quest?
**A:** Not currently. You'll need to recreate questions for each template.

---

## Need More Help?

- Visit the [Teacher Dashboard](/teacherDashboard) for an overview
- Check the [Classes Wiki](/wiki/classes) for managing classes

---

*Last updated: ${new Date().toLocaleDateString()}*
`;

const QuestsWiki = () => {
  const navigate = useNavigate();

  // Teacher guard
  const teacher = React.useMemo<TeacherUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role === "teacher") return parsed as TeacherUser;
    } catch {}
    return null;
  }, []);

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;

  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
      {/* Nav bar */}
      <nav className="bg-blue-700 text-white shadow-lg">
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
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Classes</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
              <DropDownProfile
                username={teacher?.displayName || "user"}
                onLogout={() => {
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
                onProfileClick={() => {}}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Link
          to="/subjects"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back to Quests</span>
        </Link>
      </div>

      {/* Wiki Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Wiki Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <i data-feather="award" className="w-8 h-8"></i>
              <div>
                <h1 className="text-2xl font-bold">Quests Wiki</h1>
                <p className="text-blue-100 text-sm">Documentation & Help</p>
              </div>
            </div>
          </div>

          {/* Markdown Content */}
          <div className="p-8 prose prose-lg max-w-none prose-headings: text-gray-900 prose-p:text-gray-700 prose-a:text-indigo-600 prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-table:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold text-gray-900 border-b-2 border-indigo-200 pb-2 mb-6">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-l-4 border-indigo-500 pl-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">{children}</h3>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-50 ">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-3 text-sm text-gray-700 border-t border-gray-100">{children}</td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-yellow-400 bg-yellow-50 p-4 my-4 rounded-r-lg text-gray-700">{children}</blockquote>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                  ) : (
                    <code className={`${className} block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto`}>{children}</code>
                  );
                },
                hr: () => (
                  <hr className="my-8 border-t-2 border-gray-200" />
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 my-4 text-gray-700">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-2 my-4 text-gray-700">{children}</ol>
                ),
                a: ({ href, children }) => (
                  <Link to={href || "#"} className="text-indigo-600 hover:text-indigo-800 underline font-medium">
                    {children}
                  </Link>
                ),
              }}
            >
              {questsWikiContent}
            </ReactMarkdown>
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuestsWiki;
