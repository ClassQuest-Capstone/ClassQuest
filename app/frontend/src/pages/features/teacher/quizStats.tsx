import React, { useEffect, useState } from "react";
import PieChart from "../../components/teacher/chart";

// Stats structure 
interface QuizStats {
  correct: number;
  incorrect: number;
  skipped: number;
}

export default function QuizStatsPieChart() {
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
/**
 * Fetches the quiz stats from the AWSAPI and updates the state accordingly.
 * The state will be updated with the correct, incorrect, and skipped
 * counts from the API, or with default values of 0 if the API call fails.
 * The loading state is also updated during the API call.
 */
    const fetchStats = async () => {
      try {
        setLoading(true);

        const response = await fetch("https://your-api-url.amazonaws.com/activity");
        const data = await response.json();

        setStats({
          correct: data.correct || 0,
          incorrect: data.incorrect || 0,
          skipped: data.skipped || 0
        });
      } catch (err) {
        console.error("Error fetching quiz stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <p className="text-white">Loading stats...</p>;
  if (!stats) return <p className="text-white">No quiz stats available.</p>;

  return (
    <PieChart
      correct={stats.correct}
      incorrect={stats.incorrect}
      skipped={stats.skipped}
    />
  );
}
