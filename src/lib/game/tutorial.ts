import { createInitialState } from "./engine";
import type { CircleObstacle, GamePlayer, GameState, Point } from "./types";

export const TUTORIAL_BOT_ID = "40000000-0000-4000-8000-000000000004";

export type TutorialParameterId = "slope" | "curvature" | "amplitude" | "frequency";
export type TutorialValues = Record<TutorialParameterId, number>;

export interface TutorialParameter {
  id: TutorialParameterId;
  label: string;
  symbol: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  solution: number;
}

export interface TutorialLevel {
  id: string;
  title: string;
  concept: string;
  explanation: string;
  hint: string;
  shooter: Point;
  target: Point;
  obstacles: CircleObstacle[];
  parameters: TutorialParameter[];
  formula: (values: TutorialValues) => string;
}

const number = (value: number) => String(Number(value.toFixed(3)));

const defaultValues: TutorialValues = {
  slope: 0,
  curvature: 0,
  amplitude: 0,
  frequency: 0,
};

export const tutorialLevels: TutorialLevel[] = [
  {
    id: "straight-line",
    title: "Straight line",
    concept: "Constant function",
    explanation: "A zero function keeps the shot at the launcher's height.",
    hint: "The target is level with your chicken. No adjustment is needed.",
    shooter: { x: -21, y: -8 },
    target: { x: -7, y: -8 },
    obstacles: [],
    parameters: [],
    formula: () => "0",
  },
  {
    id: "positive-slope",
    title: "Climb with slope",
    concept: "Linear function",
    explanation: "In y = m*x, a positive m makes the line rise as x increases.",
    hint: "Move m upward until the preview crosses the target.",
    shooter: { x: -21, y: -8 },
    target: { x: -5, y: 4 },
    obstacles: [],
    parameters: [
      {
        id: "slope",
        label: "Slope",
        symbol: "m",
        min: 0,
        max: 1.2,
        step: 0.05,
        initial: 0.25,
        solution: 0.75,
      },
    ],
    formula: (values) => `${number(values.slope)}*x`,
  },
  {
    id: "negative-slope",
    title: "Descend with slope",
    concept: "Linear variation",
    explanation: "The same y = m*x line falls when m is negative.",
    hint: "Move m below zero. A steeper negative value falls faster.",
    shooter: { x: -21, y: 7 },
    target: { x: -5, y: -5 },
    obstacles: [],
    parameters: [
      {
        id: "slope",
        label: "Slope",
        symbol: "m",
        min: -1.2,
        max: 0,
        step: 0.05,
        initial: -0.25,
        solution: -0.75,
      },
    ],
    formula: (values) => `${number(values.slope)}*x`,
  },
  {
    id: "quadratic-arc",
    title: "Bend around an obstacle",
    concept: "Quadratic function",
    explanation: "m sets the initial direction; a bends the path as distance grows.",
    hint: "Raise m, then make a negative to bring the arc back down onto the target.",
    shooter: { x: -21, y: -8 },
    target: { x: 8, y: -5 },
    obstacles: [
      { id: "tutorial-arc-obstacle", x: -4, y: -3, radius: 2.8 },
    ],
    parameters: [
      {
        id: "slope",
        label: "Initial slope",
        symbol: "m",
        min: 0.6,
        max: 1.8,
        step: 0.05,
        initial: 0.8,
        solution: 1.25,
      },
      {
        id: "curvature",
        label: "Curvature",
        symbol: "a",
        min: -0.08,
        max: 0,
        step: 0.005,
        initial: 0,
        solution: -0.04,
      },
    ],
    formula: (values) =>
      `${number(values.curvature)}*(x+21)^2+${number(values.slope)}*(x+21)`,
  },
  {
    id: "sine-wave",
    title: "Shape a wave",
    concept: "Sine function",
    explanation: "A controls wave height; f controls how quickly the wave repeats.",
    hint: "Increase the amplitude, then tune the frequency until a valley reaches the target.",
    shooter: { x: -21, y: 0 },
    target: { x: 3, y: -6 },
    obstacles: [
      { id: "tutorial-wave-obstacle-a", x: -8, y: -1, radius: 1.8 },
      { id: "tutorial-wave-obstacle-b", x: -1, y: 0, radius: 2 },
    ],
    parameters: [
      {
        id: "amplitude",
        label: "Amplitude",
        symbol: "A",
        min: 0,
        max: 8,
        step: 0.5,
        initial: 2,
        solution: 6,
      },
      {
        id: "frequency",
        label: "Frequency",
        symbol: "f",
        min: 0.1,
        max: 0.5,
        step: 0.05,
        initial: 0.1,
        solution: 0.2,
      },
    ],
    formula: (values) =>
      `${number(values.amplitude)}*sin(${number(values.frequency)}*(x+21))`,
  },
];

export function tutorialInitialValues(level: TutorialLevel): TutorialValues {
  const values = { ...defaultValues };
  for (const parameter of level.parameters) values[parameter.id] = parameter.initial;
  return values;
}

export function tutorialSolutionValues(level: TutorialLevel): TutorialValues {
  const values = { ...defaultValues };
  for (const parameter of level.parameters) values[parameter.id] = parameter.solution;
  return values;
}

export function tutorialTargetId(level: TutorialLevel): string {
  return `tutorial-target-${level.id}`;
}

export function createTutorialState(
  level: TutorialLevel,
  profile: { id: string; username: string; countryCode: string },
): GameState {
  const players: GamePlayer[] = [
    {
      id: profile.id,
      username: profile.username,
      countryCode: profile.countryCode,
      color: "cyan",
      seat: 0,
    },
    {
      id: TUTORIAL_BOT_ID,
      username: "Target",
      countryCode: "AI",
      color: "coral",
      seat: 1,
    },
  ];
  const levelIndex = tutorialLevels.findIndex((candidate) => candidate.id === level.id);
  const state = createInitialState({
    matchId: `50000000-0000-4000-8000-${String(levelIndex + 1).padStart(12, "0")}`,
    players,
    seed: 10_000 + levelIndex,
  });

  return {
    ...state,
    turnDeadline: null,
    obstacles: level.obstacles,
    chickens: [
      {
        id: `tutorial-shooter-${level.id}`,
        ownerId: profile.id,
        slot: 0,
        alive: true,
        ...level.shooter,
      },
      {
        id: `tutorial-spare-${level.id}`,
        ownerId: profile.id,
        slot: 1,
        alive: false,
        ...level.shooter,
      },
      {
        id: tutorialTargetId(level),
        ownerId: TUTORIAL_BOT_ID,
        slot: 0,
        alive: true,
        ...level.target,
      },
      {
        id: `tutorial-target-spare-${level.id}`,
        ownerId: TUTORIAL_BOT_ID,
        slot: 1,
        alive: false,
        ...level.target,
      },
    ],
  };
}
