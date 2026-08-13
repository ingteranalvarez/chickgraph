"use client";

import {
  ArrowRight,
  Check,
  Crosshair,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GameBoard } from "@/components/game/game-board";
import { traceShot } from "@/lib/game/engine";
import {
  createTutorialState,
  tutorialChapterLevels,
  tutorialChapterStart,
  tutorialChapters,
  tutorialExpressionMeetsRequirement,
  tutorialInitialValues,
  tutorialLevels,
  tutorialTargetId,
  type TutorialLevel,
  type TutorialParameterId,
  type TutorialValues,
} from "@/lib/game/tutorial";
import type { Point, ShotResult } from "@/lib/game/types";
import type { PublicProfile } from "@/lib/profiles/types";

const expressionInserts = [
  { label: "sin", value: "sin(x)" },
  { label: "cos", value: "cos(x)" },
  { label: "tan", value: "tan(x)" },
  { label: "sqrt", value: "sqrt(abs(x))" },
  { label: "abs", value: "abs(x)" },
  { label: "exp", value: "exp(x)" },
  { label: "ln", value: "ln(abs(x)+1)" },
  { label: "log", value: "log(abs(x)+1)" },
  { label: "x²", value: "x^2" },
];

type FeedbackTone = "neutral" | "error" | "success";

function decimal(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function nearestPointAtTarget(shot: ShotResult, target: Point): Point | null {
  return shot.points.reduce<Point | null>((nearest, point) => {
    if (!nearest) return point;
    return Math.abs(point.x - target.x) < Math.abs(nearest.x - target.x)
      ? point
      : nearest;
  }, null);
}

function missFeedback(shot: ShotResult, userId: string, target: Point): string {
  if (shot.hitChickId?.startsWith("tutorial-shooter-") || shot.shooterId !== userId) {
    return "The curve returned to your own chicken. Reduce the bend near launch.";
  }
  if (shot.endReason === "obstacle") {
    return "Blocked. Watch where the curve meets the obstacle, then change its shape or timing.";
  }
  if (shot.endReason === "invalid-number") {
    return "The function became undefined before the target. Check roots, division, logs, or asymptotes.";
  }

  const point = nearestPointAtTarget(shot, target);
  if (point && Math.abs(point.x - target.x) <= 0.12) {
    const difference = point.y - target.y;
    const direction = difference > 0 ? "above" : "below";
    return `At x = ${decimal(target.x)}, the curve passed ${decimal(Math.abs(difference))} units ${direction} the target.`;
  }
  if (shot.endReason === "bounds") {
    const last = shot.points.at(-1);
    return last
      ? `The curve left the grid near (${decimal(last.x)}, ${decimal(last.y)}). Reduce its growth or steepness.`
      : "The curve left the grid before reaching the target.";
  }
  return "The curve stopped before the target. Adjust its domain or horizontal reach.";
}

function requirementMessage(level: TutorialLevel): string {
  const names = level.requiredAny?.map((token) => token.replace("(", "")) ?? [];
  return names.length === 1
    ? `Good hit, but use ${names[0]}(...) to complete this challenge.`
    : `Good hit, but use one wave function: ${names.join(", ")}.`;
}

export function Tutorial({
  profile,
  onExit,
}: {
  profile: PublicProfile;
  onExit: () => void;
}) {
  const storageKey = `chickgraph:tutorial:v2:${profile.id}`;
  const expressionRef = useRef<HTMLInputElement>(null);
  const [levelIndex, setLevelIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [values, setValues] = useState<TutorialValues>(() =>
    tutorialInitialValues(tutorialLevels[0]),
  );
  const [draftExpression, setDraftExpression] = useState(
    tutorialLevels[0].starterExpression ?? "",
  );
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("neutral");
  const level = tutorialLevels[levelIndex];
  const chapter = tutorialChapters.find((candidate) => candidate.id === level.chapterId)!;
  const chapterLevels = tutorialChapterLevels(level.chapterId);
  const chapterStart = tutorialChapterStart(level.chapterId);
  const inputMode = level.inputMode ?? "parameters";
  const state = useMemo(
    () =>
      createTutorialState(level, {
        id: profile.id,
        username: profile.username,
        countryCode: profile.country_code,
      }),
    [level, profile.country_code, profile.id, profile.username],
  );
  const expression =
    inputMode === "expression" ? draftExpression : level.formula(values);
  const preview = useMemo(() => {
    try {
      return { shot: traceShot(state, profile.id, expression), error: "" };
    } catch (caught) {
      return {
        shot: null,
        error: caught instanceof Error ? caught.message : "This expression is not valid.",
      };
    }
  }, [expression, profile.id, state]);
  const targetId = tutorialTargetId(level);
  const levelComplete = levelIndex < completedCount;
  const unlockedHints = Math.min(level.hints.length, 1 + Math.floor(attempts / 2));
  const nextHintIn = unlockedHints < level.hints.length ? unlockedHints * 2 - attempts : 0;
  const progress = (completedCount / tutorialLevels.length) * 100;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (Number.isInteger(stored) && stored >= 0) {
        const savedProgress = Math.min(stored, tutorialLevels.length);
        const resumeIndex = Math.min(savedProgress, tutorialLevels.length - 1);
        const resumeLevel = tutorialLevels[resumeIndex];
        setCompletedCount(savedProgress);
        setLevelIndex(resumeIndex);
        setValues(tutorialInitialValues(resumeLevel));
        setDraftExpression(resumeLevel.starterExpression ?? "");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  function resetInteraction(nextLevel: TutorialLevel) {
    setValues(tutorialInitialValues(nextLevel));
    setDraftExpression(nextLevel.starterExpression ?? "");
    setAttempts(0);
    setFeedback("");
    setFeedbackTone("neutral");
  }

  function selectLevel(nextIndex: number) {
    if (nextIndex > completedCount || nextIndex >= tutorialLevels.length) return;
    const nextLevel = tutorialLevels[nextIndex];
    setLevelIndex(nextIndex);
    resetInteraction(nextLevel);
  }

  function selectChapter(startIndex: number) {
    if (startIndex > completedCount) return;
    selectLevel(startIndex);
  }

  function updateParameter(id: TutorialParameterId, value: number) {
    setValues((current) => ({ ...current, [id]: value }));
    setFeedback("");
    setFeedbackTone("neutral");
  }

  function updateExpression(value: string) {
    setDraftExpression(value);
    setFeedback("");
    setFeedbackTone("neutral");
  }

  function insertExpression(value: string) {
    const input = expressionRef.current;
    const start = input?.selectionStart ?? draftExpression.length;
    const end = input?.selectionEnd ?? draftExpression.length;
    const next = `${draftExpression.slice(0, start)}${value}${draftExpression.slice(end)}`;
    updateExpression(next);
    const innerX = value.indexOf("x");
    window.setTimeout(() => {
      input?.focus();
      if (innerX >= 0) input?.setSelectionRange(start + innerX, start + innerX + 1);
      else input?.setSelectionRange(start + value.length, start + value.length);
    }, 0);
  }

  function resetLevel() {
    resetInteraction(level);
  }

  function testShot() {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (!preview.shot) {
      setFeedback(preview.error || "Enter a valid function before testing the shot.");
      setFeedbackTone("error");
      return;
    }
    if (preview.shot.hitChickId === targetId) {
      if (!tutorialExpressionMeetsRequirement(level, expression)) {
        setFeedback(requirementMessage(level));
        setFeedbackTone("error");
        return;
      }
      const nextCompleted = Math.max(completedCount, levelIndex + 1);
      setCompletedCount(nextCompleted);
      window.localStorage.setItem(storageKey, String(nextCompleted));
      setFeedback("Direct hit. Challenge complete.");
      setFeedbackTone("success");
      return;
    }
    setFeedback(missFeedback(preview.shot, profile.id, level.target));
    setFeedbackTone("error");
  }

  function continueTutorial() {
    if (levelIndex === tutorialLevels.length - 1) {
      onExit();
      return;
    }
    selectLevel(levelIndex + 1);
  }

  return (
    <main className="tutorial-page">
      <header className="tutorial-heading">
        <div className="tutorial-title">
          <span className="eyebrow">
            CHAPTER {tutorialChapters.indexOf(chapter) + 1} · CHALLENGE {levelIndex + 1} OF {tutorialLevels.length}
          </span>
          <h1>{level.title}</h1>
          <p>{level.concept}</p>
        </div>
        <div className="tutorial-course-nav">
          <div className="tutorial-chapter-tabs" aria-label="Tutorial chapters">
            {tutorialChapters.map((candidate) => {
              const start = tutorialChapterStart(candidate.id);
              const levels = tutorialChapterLevels(candidate.id);
              const complete = start + levels.length <= completedCount;
              return (
                <button
                  key={candidate.id}
                  className={`${candidate.id === chapter.id ? "active" : ""} ${complete ? "complete" : ""}`}
                  disabled={start > completedCount}
                  onClick={() => selectChapter(start)}
                  title={candidate.description}
                >
                  {complete && <Check size={13} />} {candidate.shortTitle}
                </button>
              );
            })}
          </div>
          <div className="tutorial-progress">
            <span>{completedCount} / {tutorialLevels.length} complete</span>
            <div><i style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </header>

      <div className="tutorial-workspace">
        <section className="tutorial-arena">
          <GameBoard
            state={state}
            shot={preview.shot}
            userId={profile.id}
            targetChickId={targetId}
            preview
          />
        </section>

        <aside className="tutorial-controls">
          <div className="tutorial-control-scroll">
          <div className="tutorial-level-switcher">
            <span className="panel-label">{chapter.title}</span>
            <div className="tutorial-level-tabs" aria-label={`${chapter.title} challenges`}>
              {chapterLevels.map((candidate, index) => {
                const globalIndex = chapterStart + index;
                return (
                  <button
                    key={candidate.id}
                    className={globalIndex === levelIndex ? "active" : ""}
                    disabled={globalIndex > completedCount}
                    onClick={() => selectLevel(globalIndex)}
                    title={candidate.title}
                    aria-label={`Challenge ${globalIndex + 1}: ${candidate.title}`}
                  >
                    {globalIndex < completedCount ? <Check size={14} /> : index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tutorial-lesson-copy">
            <span className="panel-label">CONCEPT</span>
            <p>{level.explanation}</p>
          </div>

          {inputMode === "expression" ? (
            <div className="tutorial-expression-builder">
              <label className="tutorial-expression-input">
                <span>y =</span>
                <input
                  ref={expressionRef}
                  value={draftExpression}
                  onChange={(event) => updateExpression(event.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Tutorial function"
                />
              </label>
              <div className="tutorial-builder-tools" aria-label="Insert function">
                {expressionInserts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => insertExpression(item.value)}
                    title={`Insert ${item.value}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <small className={preview.error ? "invalid" : "valid"}>
                {preview.error || "Valid expression · live preview active"}
              </small>
            </div>
          ) : (
            <div className="tutorial-formula" aria-label={`Function y equals ${expression}`}>
              <span>y =</span>
              <code>{expression}</code>
            </div>
          )}

          {inputMode === "parameters" && (
            <div className="tutorial-parameters">
              {level.parameters.length === 0 ? (
                <div className="tutorial-fixed-value">
                  <span className="panel-label">FIXED FUNCTION</span>
                  <strong>Horizontal at 0</strong>
                </div>
              ) : (
                level.parameters.map((parameter) => (
                  <label key={parameter.id} className="tutorial-slider">
                    <span>
                      <strong>{parameter.label}</strong>
                      <code>{parameter.symbol} = {values[parameter.id]}</code>
                    </span>
                    <input
                      type="range"
                      aria-label={parameter.label}
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={values[parameter.id]}
                      onChange={(event) =>
                        updateParameter(parameter.id, Number(event.target.value))
                      }
                    />
                    <small><span>{parameter.min}</span><span>{parameter.max}</span></small>
                  </label>
                ))
              )}
            </div>
          )}

          <div className="tutorial-goal">
            <div>
              <span className="panel-label">GOAL</span>
              <code>({decimal(level.target.x)}, {decimal(level.target.y)})</code>
            </div>
            <p>{level.goal}</p>
          </div>

          <div className="tutorial-hint">
            <div>
              <span className="panel-label"><Lightbulb size={13} /> CLUE {unlockedHints} OF {level.hints.length}</span>
              <span>{attempts} {attempts === 1 ? "attempt" : "attempts"}</span>
            </div>
            <p>{level.hints[unlockedHints - 1]}</p>
            {nextHintIn > 0 && <small>Next clue after {nextHintIn} more {nextHintIn === 1 ? "attempt" : "attempts"}.</small>}
          </div>

          <div className={`tutorial-feedback ${feedbackTone}`} role="status">
            {feedback || (levelComplete
              ? "Challenge complete. Keep experimenting or continue."
              : "Change the function, inspect the preview, then test the shot.")}
          </div>
          </div>

          <div className="tutorial-actions">
            <button className="icon-button" onClick={resetLevel} title="Reset challenge">
              <RotateCcw size={17} />
            </button>
            {levelComplete ? (
              <button className="button button-primary" onClick={continueTutorial}>
                {levelIndex === tutorialLevels.length - 1 ? "Finish course" : "Next challenge"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button className="button button-primary" onClick={testShot}>
                <Crosshair size={17} /> Test shot
              </button>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
