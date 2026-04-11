import { useState, useEffect } from 'react';
import { fetchPerformanceSummary } from '../api/historyApi';

export default function PerformanceSummary({ clientId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPerformanceSummary(clientId);
        setSummary(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  if (loading) return <p>Loading summary...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!summary) return null;

  return (
    <div>
      <h3>Performance Summary</h3>
      <p>Total workouts: {summary.total_workouts}</p>
      <p>Total sets logged: {summary.total_sets}</p>
      <p>Distinct exercises: {summary.distinct_exercises}</p>
      <p>Most recent workout: {summary.most_recent_date ?? 'None'}</p>
    </div>
  );
}
