// Phase 6 regression coverage: set-by-set progression must not run when
// periodization controls the load.
//
// `suppressProgression` is passed by ClientWorkoutView as
//   suppressProgression={!!ex.periodization?.controls_load}
// so these tests feed ExerciseCard exercises shaped exactly as the merge layer
// emits them and derive the prop the same way.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseCard from './ExerciseCard';
import * as setApi from '../api/loggedSetApi';

jest.mock('../api/loggedSetApi');
jest.mock('../api/exerciseInstanceApi');
jest.mock('./LastPerformanceSnapshot', () => () => null);
jest.mock('../utils/localWorkoutLogs', () => ({
  generateId: () => 'local-1',
  saveLog: jest.fn(),
  removeLog: jest.fn()
}));

const baseExercise = {
  id: 'ex1',
  name: 'Back Squat',
  type: 'compound',
  equipment_type: 'barbell',
  target_sets: 4,
  target_reps: '5-8',
  target_weight: 220,
  rest_seconds: 60,
  increase_percent: 0.05,
  decrease_percent: 0.05,
  backoff_enabled: false
};

// Shaped as layer 3 of the merge emits them.
const periodized = {
  ...baseExercise,
  periodization: {
    week_number: 1, role: 'primary', controls_load: true,
    intensity_pct: 70, training_1rm: 315, rounded_weight: 220
  }
};
const accessory = {
  ...baseExercise,
  periodization: { week_number: 1, role: 'accessory', controls_load: false, reps: '10-12' }
};
const plain = { ...baseExercise };

function renderCard(exercise, onSessionOverrideChange) {
  return render(
    <ExerciseCard
      exercise={exercise}
      clientId="c1"
      programDayId="d1"
      sessionId="s1"
      initialSets={[]}
      onSetLogged={jest.fn()}
      onLoggedSetsChange={jest.fn()}
      onSessionSetsChange={jest.fn()}
      onSessionOverrideChange={onSessionOverrideChange}
      // exactly the expression ClientWorkoutView passes
      suppressProgression={!!exercise.periodization?.controls_load}
    />
  );
}

async function logTopOfRangeSet() {
  const reps = await screen.findByPlaceholderText('reps');
  userEvent.type(reps, '8'); // top of 5-8 -> would normally bump the weight
  userEvent.click(screen.getByRole('button', { name: /^Log Set$/i }));
  await waitFor(() => expect(setApi.logSet).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  setApi.logSet.mockResolvedValue({ id: 'server-1' });
  setApi.fetchNote.mockResolvedValue({ note: null });
  setApi.fetchLastNote.mockResolvedValue({ note: null });
});

test('periodized lift does NOT progress on a top-of-range set', async () => {
  const onOverride = jest.fn();
  renderCard(periodized, onOverride);
  await logTopOfRangeSet();
  expect(onOverride).not.toHaveBeenCalled();
});

test('accessory under periodization DOES still progress', async () => {
  const onOverride = jest.fn();
  renderCard(accessory, onOverride);
  await logTopOfRangeSet();
  await waitFor(() => expect(onOverride).toHaveBeenCalled());
  expect(onOverride.mock.calls[0][0].weight).toBeGreaterThan(220);
});

test('non-periodized lift is unaffected', async () => {
  const onOverride = jest.fn();
  renderCard(plain, onOverride);
  await logTopOfRangeSet();
  await waitFor(() => expect(onOverride).toHaveBeenCalled());
  expect(onOverride.mock.calls[0][0].weight).toBeGreaterThan(220);
});

test('the set itself is still logged for a periodized lift', async () => {
  renderCard(periodized, jest.fn());
  await logTopOfRangeSet();
  // Suppression affects the NEXT prescription only — logging is untouched.
  expect(setApi.logSet).toHaveBeenCalledWith(
    expect.objectContaining({ completed_reps: 8, completed_weight: 220 })
  );
});
