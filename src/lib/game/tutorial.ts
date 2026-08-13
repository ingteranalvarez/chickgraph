import { createInitialState } from "./engine";
import type { CircleObstacle, GamePlayer, GameState, Point } from "./types";

export const TUTORIAL_BOT_ID = "40000000-0000-4000-8000-000000000004";

export type TutorialChapterId =
  | "foundations"
  | "curves"
  | "waves"
  | "growth"
  | "combinations";

export type TutorialParameterId =
  | "constant"
  | "slope"
  | "curvature"
  | "cubic"
  | "sharpness"
  | "scale"
  | "amplitude"
  | "frequency"
  | "growth"
  | "shift";

export type TutorialValues = Record<TutorialParameterId, number>;

export interface TutorialChapter {
  id: TutorialChapterId;
  title: string;
  shortTitle: string;
  description: string;
}

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
  chapterId: TutorialChapterId;
  title: string;
  concept: string;
  explanation: string;
  goal: string;
  hints: string[];
  shooter: Point;
  target: Point;
  obstacles: CircleObstacle[];
  parameters: TutorialParameter[];
  formula: (values: TutorialValues) => string;
  shooterSide?: "left" | "right";
  inputMode?: "parameters" | "expression";
  starterExpression?: string;
  solutionExpression?: string;
  requiredAny?: string[];
}

const number = (value: number) => String(Number(value.toFixed(4)));
const signedNumber = (value: number) =>
  value >= 0 ? `+${number(value)}` : number(value);
const localX = "(x+21)";

const defaultValues: TutorialValues = {
  constant: 0,
  slope: 0,
  curvature: 0,
  cubic: 0,
  sharpness: 0,
  scale: 0,
  amplitude: 0,
  frequency: 0,
  growth: 0,
  shift: 0,
};

export const tutorialChapters: TutorialChapter[] = [
  {
    id: "foundations",
    title: "Launch basics",
    shortTitle: "Basics",
    description: "Learn the launch anchor, signs, slope, and constants.",
  },
  {
    id: "curves",
    title: "Curves and powers",
    shortTitle: "Curves",
    description: "Bend trajectories with powers, absolute value, and square roots.",
  },
  {
    id: "waves",
    title: "Wave functions",
    shortTitle: "Waves",
    description: "Control amplitude and frequency with sine, cosine, and tangent.",
  },
  {
    id: "growth",
    title: "Growth and division",
    shortTitle: "Growth",
    description: "Use exponential, logarithmic, and reciprocal curves.",
  },
  {
    id: "combinations",
    title: "Build your own",
    shortTitle: "Build",
    description: "Combine functions, then type complete shots as you will in a match.",
  },
];

export const tutorialLevels: TutorialLevel[] = [
  {
    id: "straight-line",
    chapterId: "foundations",
    title: "Start level",
    concept: "The launch anchor",
    explanation:
      "Every graph is translated through the active chicken. A constant function therefore fires horizontally.",
    goal: "Hit the target at the same height.",
    hints: [
      "The target and launcher share the same y coordinate.",
      "A function with no x never rises or falls.",
    ],
    shooter: { x: -21, y: -8 },
    target: { x: -7, y: -8 },
    obstacles: [],
    parameters: [],
    formula: () => "0",
  },
  {
    id: "positive-slope",
    chapterId: "foundations",
    title: "Climb with slope",
    concept: "Positive linear slope",
    explanation: "In y = m*x, a positive m makes the trajectory rise as x increases.",
    goal: "Raise the line until it crosses the target.",
    hints: [
      "The target is 12 units higher over a horizontal distance of 16.",
      "Increase m when the preview passes below the target.",
      "Slope is vertical change divided by horizontal change.",
    ],
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
    chapterId: "foundations",
    title: "Descend with slope",
    concept: "Negative linear slope",
    explanation: "The same y = m*x line falls when m is negative.",
    goal: "Reverse the sign and descend onto the target.",
    hints: [
      "A negative multiplier sends the shot downward.",
      "Make m more negative when the preview is too high.",
      "The vertical change is -12 over a horizontal distance of 16.",
    ],
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
    id: "constant-offset",
    chapterId: "foundations",
    title: "Mirror the arena",
    concept: "Direction and the constant trap",
    explanation:
      "From the right side, x decreases as the shot travels, so slope signs reverse. Changing + c still cancels at launch.",
    goal: "Fire right-to-left through the gap. Experiment with c and the sign of m.",
    hints: [
      "Move c first and compare the preview before changing m.",
      "The shot travels toward smaller x, so a negative slope rises.",
      "The rise is about 14 while the x change is -26.",
    ],
    shooter: { x: 21, y: -10 },
    target: { x: -5, y: 4.3 },
    obstacles: [
      { id: "constant-gap-top", x: 7, y: 1, radius: 2 },
      { id: "constant-gap-bottom", x: 7, y: -5.6, radius: 2 },
    ],
    parameters: [
      {
        id: "slope",
        label: "Slope",
        symbol: "m",
        min: -0.9,
        max: -0.2,
        step: 0.05,
        initial: -0.3,
        solution: -0.55,
      },
      {
        id: "constant",
        label: "Constant",
        symbol: "c",
        min: -8,
        max: 8,
        step: 1,
        initial: 6,
        solution: -4,
      },
    ],
    formula: (values) => `${number(values.slope)}*x${signedNumber(values.constant)}`,
    shooterSide: "right",
  },
  {
    id: "quadratic-arc",
    chapterId: "curves",
    title: "Arc over the wall",
    concept: "Quadratic function",
    explanation: "Here x + 21 starts at zero because the launcher is at x = -21. m aims the start; x^2 bends the path later.",
    goal: "Rise over the obstacle, then curve back to the target.",
    hints: [
      "In a match, adapt x + 21 so the inner expression is zero at your launcher.",
      "Begin with enough positive slope to clear the wall.",
      "A negative x^2 coefficient eventually pulls the arc downward.",
      "Tune m first, then make a slightly negative.",
    ],
    shooter: { x: -21, y: -8 },
    target: { x: 8, y: -5.4 },
    obstacles: [{ id: "quadratic-wall", x: -4, y: -3, radius: 2.8 }],
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
      `${number(values.curvature)}*${localX}^2${signedNumber(values.slope)}*${localX}`,
  },
  {
    id: "cubic-turn",
    chapterId: "curves",
    title: "Late cubic turn",
    concept: "Third powers",
    explanation: "A small x^3 coefficient starts gently but grows quickly farther from the launcher.",
    goal: "Dip below the obstacle and let the cubic term lift the shot late.",
    hints: [
      "The negative linear term creates the initial dip.",
      "Increase the x^3 coefficient to make the late rise stronger.",
      "Cubic coefficients are small because distance is multiplied three times.",
    ],
    shooter: { x: -21, y: -8 },
    target: { x: -1, y: 4 },
    obstacles: [{ id: "cubic-wall", x: -11, y: -2, radius: 1.8 }],
    parameters: [
      {
        id: "cubic",
        label: "Cubic coefficient",
        symbol: "a",
        min: 0.0005,
        max: 0.003,
        step: 0.00025,
        initial: 0.0005,
        solution: 0.002,
      },
      {
        id: "slope",
        label: "Initial slope",
        symbol: "m",
        min: -0.5,
        max: 0,
        step: 0.05,
        initial: -0.1,
        solution: -0.2,
      },
    ],
    formula: (values) =>
      `${number(values.cubic)}*${localX}^3${signedNumber(values.slope)}*${localX}`,
  },
  {
    id: "absolute-value",
    chapterId: "curves",
    title: "Find the V",
    concept: "Absolute value",
    explanation: "abs(...) reflects negative values upward, creating a sharp V at the point where its input is zero.",
    goal: "Adjust the sharpness so the vertex reaches the target.",
    hints: [
      "The vertex is fixed at x = -5 in this formula.",
      "A larger multiplier makes both sides of the V steeper.",
      "The launch point is 16 horizontal units from the vertex.",
    ],
    shooter: { x: -21, y: 10 },
    target: { x: -5, y: -2.8 },
    obstacles: [],
    parameters: [
      {
        id: "sharpness",
        label: "Sharpness",
        symbol: "a",
        min: 0.2,
        max: 1.2,
        step: 0.05,
        initial: 0.3,
        solution: 0.8,
      },
    ],
    formula: (values) => `${number(values.sharpness)}*abs(x+5)`,
  },
  {
    id: "square-root",
    chapterId: "curves",
    title: "Fast rise, soft landing",
    concept: "Square-root function",
    explanation: "sqrt(...) rises quickly near zero and then flattens. Its input must never be negative.",
    goal: "Scale the root to pass above the obstacle and settle onto the target.",
    hints: [
      "x + 21 is zero exactly at the launcher, so the root is defined.",
      "Increase the multiplier when the curve stays below the target.",
      "At the target, the root input is 25.",
    ],
    shooter: { x: -21, y: -10 },
    target: { x: 4, y: 0 },
    obstacles: [{ id: "root-obstacle", x: -10, y: -5.8, radius: 1.5 }],
    parameters: [
      {
        id: "scale",
        label: "Root scale",
        symbol: "a",
        min: 0.5,
        max: 3,
        step: 0.25,
        initial: 0.75,
        solution: 2,
      },
    ],
    formula: (values) => `${number(values.scale)}*sqrt(${localX})`,
  },
  {
    id: "sine-amplitude",
    chapterId: "waves",
    title: "Deepen the wave",
    concept: "Sine amplitude",
    explanation: "The multiplier outside sin(...) controls wave height without changing where peaks and valleys occur.",
    goal: "Increase amplitude until the valley reaches the target.",
    hints: [
      "The target already sits near a valley; keep the frequency fixed.",
      "Amplitude changes vertical reach, not horizontal timing.",
      "Increase A when the valley is too shallow.",
    ],
    shooter: { x: -21, y: 0 },
    target: { x: 3, y: -6 },
    obstacles: [
      { id: "sine-amplitude-a", x: -8, y: -1, radius: 1.8 },
      { id: "sine-amplitude-b", x: -1, y: 0, radius: 2 },
    ],
    parameters: [
      {
        id: "amplitude",
        label: "Amplitude",
        symbol: "A",
        min: 1,
        max: 8,
        step: 0.5,
        initial: 2,
        solution: 6,
      },
    ],
    formula: (values) => `${number(values.amplitude)}*sin(0.2*${localX})`,
  },
  {
    id: "sine-frequency",
    chapterId: "waves",
    title: "Move the valley",
    concept: "Sine frequency",
    explanation: "The multiplier inside sin(...) controls how quickly the wave repeats across x.",
    goal: "Move a valley horizontally until it meets the target.",
    hints: [
      "Amplitude is already deep enough; change only the timing.",
      "Higher frequency fits more of the wave into the same distance.",
      "Watch the valley slide left as f increases.",
    ],
    shooter: { x: -21, y: 0 },
    target: { x: -5, y: -6 },
    obstacles: [],
    parameters: [
      {
        id: "frequency",
        label: "Frequency",
        symbol: "f",
        min: 0.1,
        max: 0.45,
        step: 0.05,
        initial: 0.1,
        solution: 0.3,
      },
    ],
    formula: (values) => `6*sin(${number(values.frequency)}*${localX})`,
  },
  {
    id: "cosine-wave",
    chapterId: "waves",
    title: "Launch from a peak",
    concept: "Cosine function",
    explanation: "Cosine starts at a peak. Because the shot is anchored, it initially curves down from the launcher.",
    goal: "Tune height and timing so the first trough reaches the target.",
    hints: [
      "A controls how deep the trough becomes.",
      "f controls where the trough appears horizontally.",
      "Try placing roughly half a cosine cycle before the target.",
    ],
    shooter: { x: -21, y: 8 },
    target: { x: -5, y: -2 },
    obstacles: [],
    parameters: [
      {
        id: "amplitude",
        label: "Amplitude",
        symbol: "A",
        min: 2,
        max: 7,
        step: 0.5,
        initial: 3,
        solution: 5,
      },
      {
        id: "frequency",
        label: "Frequency",
        symbol: "f",
        min: 0.1,
        max: 0.3,
        step: 0.05,
        initial: 0.1,
        solution: 0.2,
      },
    ],
    formula: (values) =>
      `${number(values.amplitude)}*cos(${number(values.frequency)}*${localX})`,
  },
  {
    id: "tangent-rise",
    chapterId: "waves",
    title: "Control the steep turn",
    concept: "Tangent function",
    explanation: "tan(...) can stay gentle and then turn almost vertical near an asymptote.",
    goal: "Curve under the obstacle and rise sharply into the target.",
    hints: [
      "Keep f low enough that the asymptote stays beyond the target.",
      "Increase f to make the late turn happen sooner.",
      "Use A to fine-tune the final height after timing the turn.",
    ],
    shooter: { x: -21, y: -9 },
    target: { x: -1, y: 1.3 },
    obstacles: [{ id: "tangent-obstacle", x: -10, y: -4, radius: 1.4 }],
    parameters: [
      {
        id: "amplitude",
        label: "Scale",
        symbol: "A",
        min: 1,
        max: 6,
        step: 0.5,
        initial: 2,
        solution: 4,
      },
      {
        id: "frequency",
        label: "Turn rate",
        symbol: "f",
        min: 0.02,
        max: 0.07,
        step: 0.005,
        initial: 0.03,
        solution: 0.06,
      },
    ],
    formula: (values) =>
      `${number(values.amplitude)}*tan(${number(values.frequency)}*${localX})`,
  },
  {
    id: "exponential-growth",
    chapterId: "growth",
    title: "Accelerate upward",
    concept: "Exponential function",
    explanation: "exp(...) changes slowly at first and then grows rapidly. Small changes to its growth rate matter late.",
    goal: "Stay under the obstacle, then accelerate into the target.",
    hints: [
      "Use growth rate k to decide when the rise accelerates.",
      "Use scale A to adjust the overall height.",
      "If the shot exits the board, reduce k before A.",
    ],
    shooter: { x: -21, y: -9 },
    target: { x: 1, y: -2.5 },
    obstacles: [{ id: "exponential-obstacle", x: -5, y: -4.3, radius: 1.2 }],
    parameters: [
      {
        id: "scale",
        label: "Scale",
        symbol: "A",
        min: 0.1,
        max: 1,
        step: 0.1,
        initial: 0.2,
        solution: 0.5,
      },
      {
        id: "growth",
        label: "Growth rate",
        symbol: "k",
        min: 0.04,
        max: 0.16,
        step: 0.01,
        initial: 0.06,
        solution: 0.12,
      },
    ],
    formula: (values) =>
      `${number(values.scale)}*exp(${number(values.growth)}*${localX})`,
  },
  {
    id: "logarithmic-rise",
    chapterId: "growth",
    title: "Rise early, flatten late",
    concept: "Logarithmic function",
    explanation: "ln(...) rises quickly and then flattens. log(...) is accepted as an alias with the same behavior.",
    goal: "Clear the low obstacle early and flatten onto the distant target.",
    hints: [
      "The +1 keeps the logarithm defined at launch.",
      "A larger scale raises the whole relative curve.",
      "ln grows much more slowly as x gets farther away.",
    ],
    shooter: { x: -21, y: -10 },
    target: { x: 3, y: -0.35 },
    obstacles: [{ id: "log-obstacle", x: -11, y: -6, radius: 1.7 }],
    parameters: [
      {
        id: "scale",
        label: "Log scale",
        symbol: "A",
        min: 1,
        max: 5,
        step: 0.25,
        initial: 1,
        solution: 3,
      },
    ],
    formula: (values) => `${number(values.scale)}*ln(${localX}+1)`,
  },
  {
    id: "reciprocal-drop",
    chapterId: "growth",
    title: "Shape with division",
    concept: "Reciprocal function",
    explanation: "Dividing by an x expression creates a curve that changes quickly, then approaches a flat line.",
    goal: "Drop beneath the obstacle and level out at the target.",
    hints: [
      "Parentheses keep the complete x expression in the denominator.",
      "A larger shift c makes the early drop gentler.",
      "Increase A to deepen the drop without moving the denominator.",
    ],
    shooter: { x: -21, y: 8 },
    target: { x: -1, y: -0.33 },
    obstacles: [{ id: "reciprocal-obstacle", x: -11, y: 3.8, radius: 1.5 }],
    parameters: [
      {
        id: "scale",
        label: "Numerator",
        symbol: "A",
        min: 10,
        max: 60,
        step: 5,
        initial: 20,
        solution: 40,
      },
      {
        id: "shift",
        label: "Denominator shift",
        symbol: "c",
        min: 2,
        max: 8,
        step: 0.5,
        initial: 8,
        solution: 4,
      },
    ],
    formula: (values) =>
      `${number(values.scale)}/(${localX}+${number(values.shift)})`,
  },
  {
    id: "line-plus-wave",
    chapterId: "combinations",
    title: "Layer line and sine",
    concept: "Adding functions",
    explanation: "Adding a wave to a line preserves overall direction while creating peaks and valleys around it.",
    goal: "Thread both obstacles by balancing slope, amplitude, and frequency.",
    hints: [
      "First set m for the overall rise toward the target.",
      "Then use A to create enough clearance around the straight path.",
      "Finally use f to place a peak at the first obstacle and a valley at the second.",
    ],
    shooter: { x: -21, y: -10 },
    target: { x: 7, y: 2.43 },
    obstacles: [
      { id: "combo-obstacle-a", x: -15, y: -7.34, radius: 1.8 },
      { id: "combo-obstacle-b", x: -3, y: -2.01, radius: 1.8 },
    ],
    parameters: [
      {
        id: "slope",
        label: "Base slope",
        symbol: "m",
        min: 0.1,
        max: 0.6,
        step: 0.05,
        initial: 0.2,
        solution: 0.35,
      },
      {
        id: "amplitude",
        label: "Wave amplitude",
        symbol: "A",
        min: 0,
        max: 6,
        step: 0.5,
        initial: 1,
        solution: 4,
      },
      {
        id: "frequency",
        label: "Wave frequency",
        symbol: "f",
        min: 0.1,
        max: 0.4,
        step: 0.05,
        initial: 0.1,
        solution: 0.25,
      },
    ],
    formula: (values) =>
      `${number(values.slope)}*${localX}+${number(values.amplitude)}*sin(${number(values.frequency)}*${localX})`,
  },
  {
    id: "write-absolute",
    chapterId: "combinations",
    title: "Write a V yourself",
    concept: "Expression builder",
    explanation: "Now edit the same expression field used in a match. Any valid shot works, but this challenge requires abs(...).",
    goal: "Move the vertex under the target, then rise back into it.",
    hints: [
      "abs(x) has its vertex where its input equals zero.",
      "Use x + 3 inside abs to move that zero to x = -3.",
      "Multiply the complete abs expression to change its steepness.",
    ],
    shooter: { x: -21, y: 10 },
    target: { x: 7, y: 4.4 },
    obstacles: [],
    parameters: [],
    formula: () => "0.7*abs(x+3)",
    inputMode: "expression",
    starterExpression: "abs(x)",
    solutionExpression: "0.7*abs(x+3)",
    requiredAny: ["abs("],
  },
  {
    id: "final-course",
    chapterId: "combinations",
    title: "Final obstacle course",
    concept: "Free function construction",
    explanation: "Build a complete expression. Use a wave plus any operators or functions you need to escape the straight path.",
    goal: "Curve around both blockers and hit the final target.",
    hints: [
      "The starter line aims at the target but collides with both obstacles.",
      "Add sin(...), cos(...), or tan(...) to bend away from the line.",
      "A cosine term can pull the middle downward and return near its start height later.",
    ],
    shooter: { x: -21, y: -8 },
    target: { x: 9, y: 3.75 },
    obstacles: [
      { id: "final-obstacle-a", x: -13, y: -4.87, radius: 1.6 },
      { id: "final-obstacle-b", x: -3, y: -0.95, radius: 1.6 },
    ],
    parameters: [],
    formula: () => "0.4*(x+21)+5*cos(0.22*(x+21))",
    inputMode: "expression",
    starterExpression: "0.4*(x+21)",
    solutionExpression: "0.4*(x+21)+5*cos(0.22*(x+21))",
    requiredAny: ["sin(", "cos(", "tan("],
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

export function tutorialSolutionExpression(level: TutorialLevel): string {
  return level.solutionExpression ?? level.formula(tutorialSolutionValues(level));
}

export function tutorialExpressionMeetsRequirement(
  level: TutorialLevel,
  expression: string,
): boolean {
  if (!level.requiredAny?.length) return true;
  const normalized = expression.toLowerCase().replaceAll(" ", "");
  return level.requiredAny.some((token) => normalized.includes(token));
}

export function tutorialTargetId(level: TutorialLevel): string {
  return `tutorial-target-${level.id}`;
}

export function tutorialChapterLevels(chapterId: TutorialChapterId): TutorialLevel[] {
  return tutorialLevels.filter((level) => level.chapterId === chapterId);
}

export function tutorialChapterStart(chapterId: TutorialChapterId): number {
  return tutorialLevels.findIndex((level) => level.chapterId === chapterId);
}

export function createTutorialState(
  level: TutorialLevel,
  profile: { id: string; username: string; countryCode: string },
): GameState {
  const shooterSeat = level.shooterSide === "right" ? 1 : 0;
  const targetSeat = shooterSeat === 0 ? 1 : 0;
  const players: GamePlayer[] = [
    {
      id: profile.id,
      username: profile.username,
      countryCode: profile.countryCode,
      color: "cyan",
      seat: shooterSeat,
    },
    {
      id: TUTORIAL_BOT_ID,
      username: "Target",
      countryCode: "AI",
      color: "coral",
      seat: targetSeat,
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
    currentPlayerId: profile.id,
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
