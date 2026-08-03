// Phase 9 regression coverage: the periodized option on program creation.
// Asserts the exact request body, because the guarantee is that a
// non-periodized create sends what it sent before the option existed.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgramList from './ProgramList';
import * as programApi from '../api/programApi';
import * as cpApi from '../api/clientProgramApi';

jest.mock('../api/programApi');
jest.mock('../api/clientProgramApi');
jest.mock('../utils/videoCompressor', () => ({ compressVideo: jest.fn() }));
jest.mock('./ProgramDayList', () => () => <div data-testid="day-list" />);
jest.mock('./ClientTargetEditor', () => () => null);
jest.mock('./ClientMaxEditor', () => () => null);

// Mutable so a single test can flip the role without resetting modules, which
// would load a second copy of React.
let mockRole = 'admin';
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: mockRole } })
}));

const onOpenBuilder = jest.fn();
const onProgramsChanged = jest.fn();

function setup() {
  return render(
    <ProgramList
      programs={[]}
      clients={[]}
      onProgramsChanged={onProgramsChanged}
      onOpenBuilder={onOpenBuilder}
    />
  );
}

const checkbox = () => screen.getByRole('checkbox', { name: /16-week periodized program/i });
const weeksInput = () => screen.getByPlaceholderText('Weeks');
const nameInput = () => screen.getByPlaceholderText('Program name');
const createBtn = () => screen.getByRole('button', { name: /\+ New Program/i });

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'admin';
  programApi.createProgram.mockResolvedValue({ id: 'p1', name: 'X', weeks: 16 });
  cpApi.fetchActiveProgram.mockResolvedValue(null);
});

test('non-periodized create sends NO periodized key', async () => {
  setup();
  userEvent.type(nameInput(), 'Plain Program');
  userEvent.type(weeksInput(), '8');
  userEvent.click(createBtn());

  await waitFor(() => expect(programApi.createProgram).toHaveBeenCalled());
  const body = programApi.createProgram.mock.calls[0][0];
  expect(body).toEqual({
    name: 'Plain Program',
    weeks: 8,
    deload_weeks: []
  });
  expect('periodized' in body).toBe(false);
});

test('periodized create sends periodized:true with weeks 16', async () => {
  setup();
  userEvent.type(nameInput(), 'BBLS Master');
  userEvent.click(checkbox());
  userEvent.click(createBtn());

  await waitFor(() => expect(programApi.createProgram).toHaveBeenCalled());
  expect(programApi.createProgram.mock.calls[0][0]).toEqual({
    name: 'BBLS Master',
    weeks: 16,
    deload_weeks: [],
    periodized: true
  });
});

test('ticking locks the weeks field to 16; unticking re-enables it', async () => {
  setup();
  expect(weeksInput()).not.toBeDisabled();

  userEvent.click(checkbox());
  await waitFor(() => expect(weeksInput()).toHaveValue(16));
  expect(weeksInput()).toBeDisabled();
  expect(screen.getByText(/cannot be changed after the program is created/i)).toBeInTheDocument();

  userEvent.click(checkbox());
  await waitFor(() => expect(weeksInput()).not.toBeDisabled());
  expect(weeksInput()).toHaveValue(16);
  expect(screen.queryByText(/cannot be changed after/i)).not.toBeInTheDocument();
});

test('the checkbox resets after a successful create', async () => {
  setup();
  userEvent.type(nameInput(), 'BBLS Master');
  userEvent.click(checkbox());
  userEvent.click(createBtn());

  await waitFor(() => expect(programApi.createProgram).toHaveBeenCalled());
  await waitFor(() => expect(checkbox()).not.toBeChecked());
  expect(weeksInput()).not.toBeDisabled();
});

test('the builder still opens after create', async () => {
  setup();
  userEvent.type(nameInput(), 'BBLS Master');
  userEvent.click(checkbox());
  userEvent.click(createBtn());

  await waitFor(() => expect(onOpenBuilder).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'p1' })
  ));
});

test('the control is visible to self-serve users (no gate)', async () => {
  mockRole = 'self-serve';
  setup();
  expect(checkbox()).toBeInTheDocument();
  expect(checkbox()).not.toBeDisabled();
});
