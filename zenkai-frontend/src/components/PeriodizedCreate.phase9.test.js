// Phase 9 regression coverage: the periodized option on program creation,
// driven through the stepped create flow. Asserts the exact request body,
// because the guarantee is that a non-periodized create sends what it sent
// before the option existed.

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

const startBtn = () => screen.getByRole('button', { name: /\+ New Program/i });
const nameInput = () => screen.getByPlaceholderText('Program name');
const weeksInput = () => screen.getByPlaceholderText('Weeks');
const continueBtn = () => screen.getByRole('button', { name: /^Continue$/i });
// The option buttons carry a sub-label, so match on the leading word only.
const periodizedOption = () => screen.getByRole('button', { name: /^Periodized/i });
const standardOption = () => screen.getByRole('button', { name: /^Standard/i });
const createBtn = () => screen.getByRole('button', { name: /^Create Program$/i });

// Steps 1 and 2 are mechanical; every test below needs them and almost none of
// them is about them.
function reachTypeStep(programName) {
  userEvent.click(startBtn());
  userEvent.type(nameInput(), programName);
  userEvent.click(continueBtn());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'admin';
  programApi.createProgram.mockResolvedValue({ id: 'p1', name: 'X', weeks: 16 });
  cpApi.fetchActiveProgram.mockResolvedValue(null);
});

test('non-periodized create sends NO periodized key', async () => {
  setup();
  reachTypeStep('Plain Program');
  userEvent.click(standardOption());
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
  reachTypeStep('Periodized Program');
  userEvent.click(periodizedOption());
  userEvent.click(createBtn());

  await waitFor(() => expect(programApi.createProgram).toHaveBeenCalled());
  expect(programApi.createProgram.mock.calls[0][0]).toEqual({
    name: 'Periodized Program',
    weeks: 16,
    deload_weeks: [],
    periodized: true
  });
});

test('the form does not exist until the user starts it', () => {
  setup();
  expect(screen.queryByPlaceholderText('Program name')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Weeks')).not.toBeInTheDocument();

  userEvent.click(startBtn());
  expect(nameInput()).toBeInTheDocument();
});

test('no length is offered or implied before the type is chosen', () => {
  setup();
  userEvent.click(startBtn());
  // Step 1 is the name and nothing else. This is the bug being fixed: 16 used
  // to be visible before any decision had been made.
  expect(screen.queryByPlaceholderText('Weeks')).not.toBeInTheDocument();
  expect(screen.queryByText(/16/)).not.toBeInTheDocument();

  userEvent.type(nameInput(), 'Anything');
  userEvent.click(continueBtn());
  // Step 2 is the choice itself, still with no length field.
  expect(screen.queryByPlaceholderText('Weeks')).not.toBeInTheDocument();
});

test('continue is blocked until a name is entered', () => {
  setup();
  userEvent.click(startBtn());
  expect(continueBtn()).toBeDisabled();

  userEvent.type(nameInput(), 'Named');
  expect(continueBtn()).not.toBeDisabled();
});

test('the periodized branch locks 16 weeks with no editable field', () => {
  setup();
  reachTypeStep('Periodized Program');
  userEvent.click(periodizedOption());

  expect(screen.queryByPlaceholderText('Weeks')).not.toBeInTheDocument();
  expect(screen.getByText(/16 weeks/i)).toBeInTheDocument();
  expect(
    screen.getByText(/cannot be changed after the program is created/i)
  ).toBeInTheDocument();
});

test('the standard branch keeps weeks editable and empty', () => {
  setup();
  reachTypeStep('Plain Program');
  userEvent.click(standardOption());

  expect(weeksInput()).not.toBeDisabled();
  expect(weeksInput()).toHaveValue(null);
  expect(screen.queryByText(/cannot be changed after/i)).not.toBeInTheDocument();
});

test('going back re-opens the choice and switches the branch cleanly', () => {
  setup();
  reachTypeStep('Switcher');
  userEvent.click(periodizedOption());
  expect(screen.queryByPlaceholderText('Weeks')).not.toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: /^Back$/i }));
  userEvent.click(standardOption());

  // 16 was never held in state, so it cannot leak into the standard branch.
  expect(weeksInput()).toHaveValue(null);
});

test('create is blocked on the standard branch until weeks is valid', () => {
  setup();
  reachTypeStep('Plain Program');
  userEvent.click(standardOption());
  expect(createBtn()).toBeDisabled();

  userEvent.type(weeksInput(), '8');
  expect(createBtn()).not.toBeDisabled();
});

test('the flow collapses and resets after a successful create', async () => {
  setup();
  reachTypeStep('Periodized Program');
  userEvent.click(periodizedOption());
  userEvent.click(createBtn());

  await waitFor(() => expect(programApi.createProgram).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByPlaceholderText('Program name')).not.toBeInTheDocument()
  );

  // Re-opening starts clean. Periodization is irreversible, so inheriting it on
  // the next program is the worst available failure.
  userEvent.click(startBtn());
  expect(nameInput()).toHaveValue('');
  userEvent.type(nameInput(), 'Next');
  userEvent.click(continueBtn());
  expect(periodizedOption()).toBeInTheDocument();
  expect(standardOption()).toBeInTheDocument();
});

test('cancel abandons the flow', () => {
  setup();
  userEvent.click(startBtn());
  userEvent.type(nameInput(), 'Abandoned');
  userEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

  expect(screen.queryByPlaceholderText('Program name')).not.toBeInTheDocument();
  userEvent.click(startBtn());
  expect(nameInput()).toHaveValue('');
});

test('the builder still opens after create', async () => {
  setup();
  reachTypeStep('Periodized Program');
  userEvent.click(periodizedOption());
  userEvent.click(createBtn());

  await waitFor(() => expect(onOpenBuilder).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'p1' })
  ));
});

test('the flow is visible to self-serve users (no gate)', () => {
  mockRole = 'self-serve';
  setup();
  reachTypeStep('Self Serve Program');
  expect(periodizedOption()).not.toBeDisabled();
});
