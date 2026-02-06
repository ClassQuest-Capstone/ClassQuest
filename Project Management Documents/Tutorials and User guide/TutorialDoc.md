## ClassQuest Tutorial

This document provides the instructions for the interactive onboarding tutorial designed for ClassQuest users. It provides
a step-by-step guide on how to navigate key UI areas and explains their purpose to new users.

## Overview 

The tutorial is divided into the following sections:
1. A global context for managing the tutorial state.
2. An intro modal that introduces the tutorial to the user.
3. A step-by-step overlay that highlights important dashboard elements.
4. A healer/Mage sprite that animates in the background.

**The tutorial progresses through predefined UI sections and can be skipped or ended at any time.**

## Tutorial Flow

1. The user is greeted with a welcome message and two buttons: **Maybe later** and **Begin Tour**. If the user clicks **Maybe later**, the modal closes.
2. Clicking **Begin Tour** starts the tutorial.
3. The **TutorialOverlay** appears, highlighting important elements of the dashboard.
4. The user clicks **next** to advance through the tutorial.
5. The tutorial ends when the user clicks **Explore dashboard**.

## Tutorial Steps

The tutorial dynamically adjusts its steps depending on whether the user is a Student or Teacher.

**Students:**
| Step ID       | Target Element ID | Description |
|---------------|-------------------|-------------|
| `Nav-Tabs`    | `nav-tab`         | Navigation tabs |
| `Guilds`      | `guilds`          | Gold and guild information |
| `Equipment`   | `equipment`       | Equipped items |
| `Appearance`  | `appear`          | Character appearance |
| `Inventory`   | `inventory`       | Collected items |
| `Stats`       | `stats`           | Character stats |
| `Skills`      | `skills`          | Skills and abilities |
| `Footer`      | `footer`          | Quests and rewards |
| `done`        | —                 | Tutorial completion |

**Teachers:**
| Step ID       | Target Element ID | Description |
|---------------|-------------------|-------------|
| `Active-Tabs`    | `Active-tab`         | Active students & quests |
| `Recent-Activity`      | `recent-activity`          | Latest student activity |
| `Student`   | `Top-students`       | Top performing students |
| `Nav`  | `nav-menu`          | Navigation links |
| `done`        | —                 | Tutorial completion |

## Architecture Overview

The tutorial system is composed of the following core modules:

1. **Tutorial Context**
  - Manages tutorial state and progression
  - Exposes `startTutorial`, `nextStep`, and `endTutorial`

2. **TutorialIntroModal**
  - Entry point for the tutorial
  - Allows users to start or end the tour

3. **TutorialOverlay**
  - Renders the step-by-step overlay
  - Highlights DOM elements based on the current step

4. **Healer/ Mage Sprite**
  - Visual guide character shown in the intro and overlay

## Styling & Assets

The tutorial depends on the following assets and styles:

1. Tutorial modal and overlay CSS
2. Highlight box and backdrop styles
3. Healer/Mage sprite image asset

All related styles must be loaded for proper rendering.

## Errors and Edge Cases

1. If target element is not found, the step will not be rendered/ highlighted.
2. Users can skip the tutorial at any time.

## Extending the Tutorial

To add a new tutorial step:

1. Add a new Step ID to the step type definition
2. Insert the step into the ordered steps list
3. Define the step configuration:
   - `targetId`
   - `title`
   - `description`
4. Ensure the target element exists in the DOM

**Note:** Each tutorial step requires a DOM element to highlight. If the element is not present in the DOM, the step not be rendered.
