const BASE_URL = 'http://localhost:3001/api/history';

export const fetchWorkoutHistory = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}`);
  if (!res.ok) throw new Error('Failed to fetch workout history');
  return res.json();
};

export const fetchWorkoutDetail = async (clientId, date, programDayId) => {
  const res = await fetch(
    `${BASE_URL}/${clientId}/detail?date=${encodeURIComponent(date)}&program_day_id=${programDayId}`
  );
  if (!res.ok) throw new Error('Failed to fetch workout detail');
  return res.json();
};

export const fetchExerciseList = async (clientId) => {
  const res = await fetch(`${BASE_URL}/${clientId}/exercises`);
  if (!res.ok) throw new Error('Failed to fetch exercise list');
  return res.json();
};

export const fetchExercisePerformance = async (clientId, exerciseInstanceId) => {
  const res = await fetch(`${BASE_URL}/${clientId}/exercises/${exerciseInstanceId}`);
  if (!res.ok) throw new Error('Failed to fetch exercise performance');
  return res.json();
};
