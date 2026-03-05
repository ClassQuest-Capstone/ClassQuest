import React, { useEffect, useState, useMemo } from "react";
import { getLeaderboard, type PlayerState } from "../../../api/playerStates.js";
import { getStudentProfile, type StudentProfile } from "../../../api/studentProfiles.js";

// Constants for level calculation (from usePlayerProgression)
const BASE_XP_FOR_LEVEL_2 = 500;
const XP_INCREASE_PER_LEVEL = 100;
const MAX_LEVEL = 30;

/**
 * Calculate total XP needed from level 1 to reach target level
 */
const calculateTotalXPForLevel = (targetLevel: number): number => {
  let total = 0;
  for (let i = 2; i <= targetLevel; i++) {
    total += BASE_XP_FOR_LEVEL_2 + (i - 2) * XP_INCREASE_PER_LEVEL;
  }
  return total;
};

/**
 * Determine level from total XP
 */
const getLevelFromXP = (totalXP: number): number => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (totalXP < calculateTotalXPForLevel(level + 1)) {
      return level;
    }
  }
  return MAX_LEVEL;
};

interface LeaderboardEntry {
  studentId: string;
  username: string;
  displayName: string;
  level: number;
  totalXP: number;
  gold: number;
  rank: number;
}

interface ClassLeaderboardProps {
  classId: string;
}

export default function ClassLeaderboard({ classId }: ClassLeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the leaderboard for the class
        const response = await getLeaderboard(classId, 100);
        const playerStates = response?.items ?? [];

        // Fetch student profiles for all players
        const profilesPromise = playerStates.map(async (player: PlayerState) => {
          try {
            const profile = await getStudentProfile(player.student_id);
            return {
              studentId: player.student_id,
              username: profile?.username ?? "Unknown",
              displayName: profile?.display_name ?? "Unknown",
              level: getLevelFromXP(player.total_xp_earned),
              totalXP: player.total_xp_earned,
              gold: player.gold,
            };
          } catch (err) {
            // If profile fetch fails, use defaults
            return {
              studentId: player.student_id,
              username: "Unknown",
              displayName: "Unknown",
              level: getLevelFromXP(player.total_xp_earned),
              totalXP: player.total_xp_earned,
              gold: player.gold,
            };
          }
        });

        const profiles = await Promise.all(profilesPromise);

        // Sort by XP descending and add ranks
        const sorted = profiles.sort((a, b) => b.totalXP - a.totalXP);
        const entriesWithRank = sorted.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

        if (!cancelled) {
          setLeaderboardData(entriesWithRank);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load leaderboard");
          console.error("Error loading leaderboard:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg">
        <p className="text-white text-center">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg">
        <p className="text-red-300 text-center">Error: {error}</p>
      </div>
    );
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg">
        <p className="text-white text-center">No students in this class yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-yellow-500/20 border-b border-yellow-500/30">
              <th className="px-6 py-3 text-left text-sm font-bold text-yellow-300">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-sm font-bold text-yellow-300">
                Username
              </th>
              <th className="px-6 py-3 text-left text-sm font-bold text-yellow-300">
                Display Name
              </th>
              <th className="px-6 py-3 text-center text-sm font-bold text-yellow-300">
                Level
              </th>
              <th className="px-6 py-3 text-right text-sm font-bold text-yellow-300">
                XP
              </th>
              <th className="px-6 py-3 text-right text-sm font-bold text-yellow-300">
                Gold
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaderboardData.map((entry) => (
              <tr
                key={entry.studentId}
                className="bg-white "
              >
                <td className="px-6 py-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-gray-900 font-bold`}>
                                  {entry.rank <= 3 ? (
                                    entry.rank === 1 ? <span className="text-2xl">🥇</span> : entry.rank === 2 ? <span className="text-2xl">🥈</span> : <span className="text-2xl">🥉</span>
                                  ) : (
                                    entry.rank
                                  )}
                                </div>
                </td>
                <td className="px-6 py-4 text-gray-900">{entry.username}</td>
                <td className="px-6 py-4 text-gray-900">{entry.displayName}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-blue-500/30 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
                    Level {entry.level}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-gray-900 font-semibold">
                    {entry.totalXP.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-yellow-600 font-semibold">
                    {entry.gold.toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
