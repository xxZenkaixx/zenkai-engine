// Phase 1 regression coverage for the periodization role selector.
// Proves the two UI acceptance criteria without needing admin credentials:
//   1. Primary / Secondary / Accessory are selectable and reach the API payload
//   2. The role renders in the exercise-list meta only when it isn't 'accessory'

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseInstanceForm from './ExerciseInstanceForm';
import * as api from '../api/exerciseInstanceApi';

jest.mock('../api/exerciseInstanceApi');
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'admin' }, token: 't' })
}));
// mediabunny pulls in TextDecoder at import time, which jsdom doesn't provide.
// Irrelevant to this test — stub the module so the component can load.
jest.mock('../utils/videoCompressor', () => ({ compressVideo: jest.fn() }));

const row = (over = {}) => ({
  id: 'ex1',
  name: 'Barbell Bench Press',
  type: 'compound',
  equipment_type: 'barbell',
  periodization_role: 'accessory',
  target_sets: 3,
  target_reps: '5-8',
  target_weight: 185,
  rest_seconds: 120,
  order_index: 0,
  notes: null,
  backoff_enabled: false,
  superset_group_id: null,
  superset_order: null,
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  api.fetchExerciseInstances.mockResolvedValue([]);
  api.createExerciseInstance.mockResolvedValue(row());
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
});

test.each(['primary', 'secondary', 'accessory'])(
  'role %s is selectable and reaches the API payload',
  async (role) => {
    render(<ExerciseInstanceForm dayId="day1" />);

    const roleSelect = await screen.findByTitle(/Training 1RM/i);
    expect([...roleSelect.options].map((o) => o.value))
      .toEqual(['accessory', 'primary', 'secondary']);
    expect(roleSelect.value).toBe('accessory');

    userEvent.type(screen.getByPlaceholderText(/Exercise name/i), 'Back Squat');
    userEvent.type(screen.getByPlaceholderText('Sets *'), '5');
    userEvent.type(screen.getByPlaceholderText('Reps *'), '5');
    userEvent.type(screen.getByPlaceholderText('Rest (sec) *'), '180');
    userEvent.selectOptions(roleSelect, role);
    expect(roleSelect.value).toBe(role);

    userEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => expect(api.createExerciseInstance).toHaveBeenCalled());
    expect(api.createExerciseInstance.mock.calls[0][0])
      .toEqual(expect.objectContaining({ periodization_role: role }));
  }
);

test('meta shows the role only when it is not accessory', async () => {
  api.fetchExerciseInstances.mockResolvedValue([
    row({ id: 'a', name: 'Back Squat', periodization_role: 'primary' }),
    row({ id: 'b', name: 'Leg Curl', periodization_role: 'accessory', order_index: 1 })
  ]);

  render(<ExerciseInstanceForm dayId="day1" />);

  await screen.findByText('Back Squat');
  expect(screen.getByText(/PRIMARY ·/)).toBeInTheDocument();
  expect(screen.queryByText(/ACCESSORY ·/)).not.toBeInTheDocument();
});
