// Phase 2 regression coverage for the Training 1RM editor.
//   - editor is reachable for an ALREADY-ASSIGNED client (not just after launch)
//   - a 1RM can be entered and saved
//   - accessories never appear
//   - a program with no primary/secondary work renders nothing

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientMaxEditor from './ClientMaxEditor';
import ProgramList from './ProgramList';
import * as maxApi from '../api/clientExerciseMaxApi';
import * as cpApi from '../api/clientProgramApi';

jest.mock('../api/clientExerciseMaxApi');
jest.mock('../api/clientProgramApi');
jest.mock('../api/programApi');
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'admin' }, token: 't' })
}));
// mediabunny (via ProgramDayList -> ExerciseInstanceForm) needs TextDecoder,
// which jsdom doesn't provide. Irrelevant here.
jest.mock('../utils/videoCompressor', () => ({ compressVideo: jest.fn() }));
// Keep the day builder out of these assertions; it has its own coverage.
jest.mock('./ProgramDayList', () => () => <div data-testid="day-list" />);
jest.mock('./ClientTargetEditor', () => () => <div data-testid="target-editor" />);

const PERIODIZED = {
  days: [{
    id: 'd1', day_number: 1, name: 'Push',
    exercises: [
      { id: 'p1', name: 'Back Squat', periodization_role: 'primary',
        equipment_type: 'barbell', target_sets: 5, target_reps: '5', training_1rm: null },
      { id: 's1', name: 'Incline Press', periodization_role: 'secondary',
        equipment_type: 'dumbbell', target_sets: 3, target_reps: '8', training_1rm: 120 }
    ]
  }]
};

beforeEach(() => {
  jest.clearAllMocks();
  maxApi.fetchClientMaxes.mockResolvedValue(PERIODIZED);
  maxApi.updateClientMax.mockResolvedValue({ exercise_instance_id: 'p1', training_1rm: 315 });
});

test('renders periodized exercises with their current 1RM', async () => {
  render(<ClientMaxEditor clientProgramId="cp1" />);

  expect(await screen.findByText('Back Squat')).toBeInTheDocument();
  expect(screen.getByText('Incline Press')).toBeInTheDocument();
  expect(screen.getByText(/PRIMARY ·/)).toBeInTheDocument();
  expect(screen.getByText(/SECONDARY ·/)).toBeInTheDocument();

  const inputs = screen.getAllByPlaceholderText('1RM');
  expect(inputs[0]).toHaveValue('');    // not yet entered
  expect(inputs[1]).toHaveValue('120'); // existing value round-trips
});

test('entering a 1RM saves it on blur', async () => {
  render(<ClientMaxEditor clientProgramId="cp1" />);
  await screen.findByText('Back Squat');

  const input = screen.getAllByPlaceholderText('1RM')[0];
  userEvent.type(input, '315');
  await act(async () => { input.blur(); });

  await waitFor(() => expect(maxApi.updateClientMax).toHaveBeenCalledWith('cp1', 'p1', 315));
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

test('accessories never appear', async () => {
  render(<ClientMaxEditor clientProgramId="cp1" />);
  await screen.findByText('Back Squat');

  expect(screen.queryByText(/ACCESSORY/i)).not.toBeInTheDocument();
  expect(screen.getAllByPlaceholderText('1RM')).toHaveLength(2);
});

test('renders nothing when the program has no primary/secondary work', async () => {
  maxApi.fetchClientMaxes.mockResolvedValue({ days: [] });
  const { container } = render(<ClientMaxEditor clientProgramId="cp1" />);

  await waitFor(() => expect(maxApi.fetchClientMaxes).toHaveBeenCalled());
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

test('editor appears for an already-assigned client, with no re-launch', async () => {
  // The client is already on this program — assignProgram is never called.
  cpApi.fetchActiveProgram.mockResolvedValue({ id: 'cp-existing', program_id: 'prog1' });

  render(
    <ProgramList
      programs={[{ id: 'prog1', name: 'Periodized Program', weeks: 16, deload_weeks: [] }]}
      clients={[{ id: 'c1', name: 'Toree' }]}
    />
  );

  userEvent.click(screen.getByText('Periodized Program'));
  userEvent.selectOptions(await screen.findByRole('combobox'), 'c1');

  await waitFor(() => expect(cpApi.fetchActiveProgram).toHaveBeenCalledWith('c1'));
  expect(await screen.findByText('Training 1RM')).toBeInTheDocument();
  expect(maxApi.fetchClientMaxes).toHaveBeenCalledWith('cp-existing');
  expect(cpApi.assignProgram).not.toHaveBeenCalled();
});

test('editor stays hidden when the client is on a different program', async () => {
  cpApi.fetchActiveProgram.mockResolvedValue({ id: 'cp-other', program_id: 'prog-other' });

  render(
    <ProgramList
      programs={[{ id: 'prog1', name: 'Periodized Program', weeks: 16, deload_weeks: [] }]}
      clients={[{ id: 'c1', name: 'Toree' }]}
    />
  );

  userEvent.click(screen.getByText('Periodized Program'));
  userEvent.selectOptions(await screen.findByRole('combobox'), 'c1');

  await waitFor(() => expect(cpApi.fetchActiveProgram).toHaveBeenCalledWith('c1'));
  expect(screen.queryByText('Training 1RM')).not.toBeInTheDocument();
});
