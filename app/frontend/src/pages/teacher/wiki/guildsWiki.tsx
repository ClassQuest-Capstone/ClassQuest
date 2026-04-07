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
# Guild System Wiki

Welcome to the Guild System Wiki! This guide provides an overview of the guild system in ClassQuest, including how to create and manage guilds, and assign students.

---

## Table of Contents

1. Overview
2. Creating a New Guild
3. Managing Your Guilds
4. Assigning Students to Guilds
5. Best Practices
6. FAQ
---

## Overview

The Guild System is a collaborative team feature that allows teachers to organize students into groups for boss battles and team-based activities. Key features include:

- **Class-Based Guilds**: Each guild belongs to a specific class
- **One Guild Per Student**: Students can only be in one guild at a time within a class
- **Team Collaboration**: Guilds work together in boss battles to defeat bosses
- **Flexible Management**: Teachers can reassign students between guilds at any time

### Navigation

Access the Guild Management page by:
1. Clicking **Guilds** in the navigation bar
2. Or clicking **Manage Guilds** from the Classes page

### Page Layout

The Guild Management page has two main panels:

| Panel | Description |
|-------|-------------|
| **Guilds Panel (Left)** | Shows all guilds for the selected class with member counts and rosters |
| **Assign Students Panel (Right)** | Lists all students in the class with guild assignment dropdowns |

---

## Creating a New Guild

### Prerequisites
- You must have at least one active class
- Select a class from the dropdown before creating guilds

### Step-by-Step

1. **Select a Class**: Use the class dropdown at the top to choose which class the guild belongs to
2. **Click "Create Guild"**: The blue button in the header area
3. **Enter Guild Name**: In the modal, provide a descriptive name (e.g., "Team Phoenix", "Dragon Squad", "The Wizards")
4. **Click "Create Guild"**: Submit to create the guild

### Guild Properties

| Property | Description |
|----------|-------------|
| **Name** | Unique identifier for the guild (required) |
| **Class** | The class this guild belongs to (auto-assigned) |
| **Status** | Active or inactive (guilds are active by default) |

> **Tip**: Choose creative, motivating names that students will enjoy identifying with!

---

## Managing Your Guilds

### Viewing Guild Rosters

Each guild card in the Guilds panel displays:
- **Guild Name**: The name you assigned
- **Member Count**: Badge showing number of assigned students
- **Member List**: Names and roles of all students in the guild
- **Refresh Button**: Click to reload the guild's roster

### Guild Member Roles

| Role | Description |
|------|-------------|
| **MEMBER** | Standard guild membership (default role) |

### Refreshing Data

- Click the **Refresh** button on any guild card to reload its member list
- Click the main **Refresh** button at the page header to reload all guilds and students

---

## Assigning Students to Guilds

### Assignment Methods

**Method 1: Using the Student Dropdown**
1. Find the student in the "Assign Students" panel
2. Use the dropdown next to their name
3. Select the guild to assign them to
4. The assignment happens immediately

**Method 2: Removing from Guild**
1. Find the student in the "Assign Students" panel
2. Click the **Remove** button (red)
3. The student will be unassigned from their current guild

### Sorting Students

Use the sort dropdown in the Assign Students panel header:

| Sort Option | Description |
|-------------|-------------|
| **A → Z** | Alphabetical order by student name |
| **Z → A** | Reverse alphabetical order |
| **By Guild** | Groups students by their assigned guild |

### Visual Indicators

- Students with a guild assigned show the guild name in their dropdown
- Students without a guild show "(No guild)" selected
- The **Remove** button is disabled for students not in a guild

---

## Best Practices

### Creating Balanced Teams
- **Even Distribution**: Try to assign similar numbers of students to each guild
- **Mix Abilities**: Consider mixing students of different skill levels for balanced competition
- **Team Size**: 3-6 students per guild works well for most boss battles

### Naming Conventions
- Use **thematic names** that fit your class (mythical creatures, superheroes, space themes)
- Keep names **positive and inclusive**
- Avoid names that might cause conflicts or favoritism

### Managing Throughout the Year
- **Rotate periodically**: Consider changing guild assignments monthly or quarterly
- **Let students vote**: Occasionally let students suggest guild names
- **Track performance**: Note which guild compositions work best for collaboration

### Before Boss Battles
1. Ensure all participating students are assigned to guilds
2. Verify guild member counts are balanced
3. Check that each guild has active members present in class

---

## FAQ

### How many guilds can I create per class?
There is no hard limit. Create as many guilds as needed for your class size and teaching strategy.

### Can a student be in multiple guilds?
No, a student can only belong to one guild at a time within a class. To change their guild, simply select a different guild from the dropdown.

### What happens to guild assignments if I archive a class?
Guild assignments are preserved but become inactive when the class is archived. If you reactivate the class, the guild structure remains.

### Can students see their guild assignments?
Yes, students can see their guild membership on their student dashboard and during boss battles.

### How do guilds work in boss battles?
During guild-based boss battles:
- Guild members collaborate to answer questions
- Damage dealt to the boss is calculated based on guild performance
- All guild members share in the rewards when the boss is defeated

### Can I delete a guild?
Guilds can be deactivated rather than deleted to preserve historical records. Inactive guilds won't appear in selection dropdowns.

### What if I forget to assign students before a boss battle?
Students without guild assignments cannot participate in guild-based boss battles. Always verify assignments before starting a battle.

---

*Last updated: ${new Date().toLocaleDateString()}*
`;

const GuildsWiki = () => {
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
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Guilds</Link>
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
          to="/teacherGuilds"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back to Guilds</span>
        </Link>
      </div>

      {/* Wiki Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Wiki Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <i data-feather="shield" className="w-8 h-8"></i>
              <div>
                <h1 className="text-2xl font-bold">Guilds Wiki</h1>
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

export default GuildsWiki;
