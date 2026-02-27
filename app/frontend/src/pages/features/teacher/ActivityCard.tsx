import React, { useEffect } from "react";
import feather from "feather-icons";
import type { ActivityItem, ActivityCategory } from "../../hooks/teacher/useTeacherActivity.js";

// Icon and color config for each activity category
const CATEGORY_CONFIG: Record<
  ActivityCategory,
  {
    label: string;
    tagBg: string;
    tagText: string;
    icon: string;
    iconColour: string;  
  }
> = {
  QUEST_COMPLETED: {
    label: "Quest",
    tagBg: "bg-green-100",
    tagText: "text-green-800",
    icon: "check-circle",
    iconColour: "text-green-500",
  },
  BOSS_BATTLE: {
    label: "Boss Battle",
    tagBg: "bg-red-100",
    tagText: "text-red-800",
    icon: "zap",
    iconColour: "text-red-500",
  },
  TEACHER_ADJUSTMENT: {
    label: "Adjustment",
    tagBg: "bg-blue-100",
    tagText: "text-blue-800",
    icon: "edit-3",
    iconColour: "text-blue-500",
  },
};

/// Helper to build a "+150 XP / +20 Gold" badge string, or null if no rewards
function rewardBadge(item: ActivityItem): string | null {
  const parts: string[] = [];
  if (item.xpDelta !== 0) parts.push(`${item.xpDelta > 0 ? "+" : ""}${item.xpDelta} XP`);
  if (item.goldDelta !== 0) parts.push(`${item.goldDelta > 0 ? "+" : ""}${item.goldDelta} Gold`);
  if (item.heartsDelta !== 0) parts.push(`${item.heartsDelta > 0 ? "+" : ""}${item.heartsDelta} ♥`);
  return parts.length ? parts.join(" / ") : null;
}

// Human redable time
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Component
interface ActivityCardProps {
  item: ActivityItem;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ item }) => {
  const cfg = CATEGORY_CONFIG[item.category];
  const badge = rewardBadge(item);

  useEffect(() => {
    feather.replace();
  });

  return (
    <li>
      <div className="block hover:bg-gray-300">
        <div className="px-4 py-4 sm:px-6">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate text-gray-900 flex items-center gap-2">
              <i data-feather={cfg.icon} className={`flex-shrink-0 h-5 w-5 ${cfg.iconColour}`}></i>
              {item.title}
            </p>
            <div className="ml-2 flex-shrink-0 flex gap-2">
              {/* Category tag */}
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cfg.tagBg} ${cfg.tagText}`}>
                {cfg.label}
              </span>
              {/* Reward badge */}
              {badge && (
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  {badge}
                </span>
              )}
            </div>
          </div>

          {/* Details row */}
          <div className="mt-2 sm:flex sm:justify-between">
            <div className="sm:flex">
              <p className="flex items-center text-sm text-gray-500">
                <i data-feather="user" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                {item.studentName}
              </p>
              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                <i data-feather="book-open" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                {item.className}
              </p>
              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                <i data-feather="calendar" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
                <span>{formatDate(item.createdAt)}</span>
              </p>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
              <i data-feather="clock" className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"></i>
              <span>{timeAgo(item.createdAt)}</span>
            </div>
          </div>

          {/* Optional reason 
          {item.reason && (
            <p className="mt-1 text-xs text-gray-400 italic">Reason: {item.reason}</p>
          )}*/}
        </div>
      </div>
    </li>
  );
};

export default ActivityCard;
