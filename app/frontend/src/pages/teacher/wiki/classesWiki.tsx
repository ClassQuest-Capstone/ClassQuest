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

const classesWikiContent = `
# Class Management Wiki

Welcome to the **Class Management** wiki! This guide will walk you through everything you need to know about creating and managing classes in ClassQuest.

---

## Table of Contents

1. Overview
2. Creating a New Class
3. Understanding the Class Card
4. Managing Your Classes
5. Best Practices

---

## Overview

The **Classes** page is your central hub for organizing students into different groups. Each class gets a unique **join code** that students use to enroll themselves.

### Why Create Classes?

- **Organize students** by period, subject, or grade level
- **Track progress** for each group separately
- **Customize quests** per class
- **Manage guilds** within each class

---

## Creating a New Class

### Step 1: Click the "Create Class" Button

Located in the top-right corner of the Classes page, this blue gradient button opens the class creation modal.


### Step 2: Fill in Class Details

| Field | Description | Required |
|-------|-------------|----------|
| **Class Name** | A descriptive name (e.g., "Math Period 1", "Science 6A") | ✅ Yes |
| **Grade Level** | Select between grades 5-8 | ✅ Yes |
| **Subject** | Optional subject identifier (e.g., "Mathematics", "English") | ❌ No |

### Step 3: Submit

Click the **Create Class** button in the modal. Your new class will appear immediately in the grid below.

---

## Understanding the Class Card

Each class is displayed as a card with the following information:

### Card Header (Blue/Purple Gradient)
- **Class Name** - The name you assigned
- **Creation Date** - When the class was created

### Card Body

 **Class Name Section (Blue Background)**
- Displays the full class name prominently.

**Grade Level Section (Purple Background)**  
- Shows which grade level this class is for.

**Class Code Section (Gray Background)**
- This is the **most important section**! The **join code** is a unique 6-character code students use to join your class.

### Action Buttons

| Button | Icon | Action |
|--------|------|--------|
| **Copy Code** | 📋 | Copies the join code to clipboard |
| **Edit** | ✏️ | Opens edit modal to modify class details |
| **Delete** | 🗑️ | Deactivates the class (students cannot join) |
| **View Students** | 👥 | Navigate to see all enrolled students |
| **View Guilds** | 🛡️ | Navigate to manage guilds within this class |
| **View Quests** | 📜 | Navigate to quests assigned to this class |
| **Boss Battle** | ⚔️ | Navigate to boss battle management for this class |

---

## Managing Your Classes

### Editing a Class

1. Click the **Edit** (pencil) icon on any class card
2. Modify the class name, grade level, or subject
3. Click **Save Changes**

> **Note:** Editing a class does NOT change its join code. Students already enrolled remain enrolled.

### Deactivating a Class

1. Click the **Delete** (trash) icon
2. Confirm the action in the popup
3. The class becomes inactive

> **Warning:** Deactivating a class prevents new students from joining. Consider this carefully before proceeding.

### Copying the Join Code

1. Click the **Copy** button next to the 6-character code
2. Share the code with students via:
   - Writing it on the board
   - Sending in an email
3. A "Copied!" confirmation appears briefly

---

## Best Practices

### Naming Conventions

Use clear, consistent naming:

| Good Examples | Avoid |
|------------------|----------|
| "Math Period 1" | "Class 1" |
| "Science 7A - Biology" | "My Class" |
| "English 6th Grade" | "Test" |

### Sharing Join Codes

- **Never** post codes publicly online
- Share codes through official school channels

### Organization Tips

1. **Create a class per period** - Easier to track attendance and progress
2. **Use subjects** - Helps when teaching multiple subjects
3. **Review regularly** - Deactivate classes at semester end

---

## Frequently Asked Questions (FAQ's)

### Q: Can students be in multiple classes?
**A:** Yes! Students can join as many classes as you create.

### Q: What happens if I share the wrong code?
**A:** You can deactivate the class and create a new one, or remove unwanted students from the class roster.

### Q: Can I reactivate a deactivated class?
**A:** Currently, deactivated classes cannot be reactivated. Create a new class instead.

### Q: How many classes can I create?
**A:** There is no limit on the number of classes you can create.

---

## Need More Help?

- Visit the [Teacher Dashboard](/teacherDashboard) for an overview
- Check the [Quest Creation Wiki](/wiki/quests) for setting up assignments

---

*Last updated: ${new Date().toLocaleDateString()}*
`;

const ClassesWiki = () => {
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
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Classes</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
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
          to="/Classes"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back to Classes</span>
        </Link>
      </div>

      {/* Wiki Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Wiki Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <i data-feather="book" className="w-8 h-8"></i>
              <div>
                <h1 className="text-2xl font-bold">Classes Wiki</h1>
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
              {classesWikiContent}
            </ReactMarkdown>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClassesWiki;
