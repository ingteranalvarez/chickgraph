"use client";

import {
  ArrowRight,
  Check,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GameBoard } from "@/components/game/game-board";
import { traceShot } from "@/lib/game/engine";
import {
  createTutorialState,
  tutorialInitialValues,
  tutorialLevels,
  tutorialTargetId,
  type TutorialParameterId,
  type TutorialValues,
} from "@/lib/game/tutorial";
import type { ShotResult } from "@/lib/game/types";
import type { PublicProfile } from "@/lib/profiles/types";

function missFeedback(shot: ShotResult, userId: string): string {
  if (shot.hitChickId?.startsWith("tutorial-shooter-") || shot.shooterId !== userId) {
    return "The curve returned to your own chicken. Reduce the bend.";
  }
  if (shot.endReason === "obstacle") {
    return "The curve hit an obstacle. Change its slope or bend.";
  }
  if (shot.endReason === "bounds") {
    return "The curve left the grid before reaching the target.";
  }
  if (shot.endReason === "invalid-number") {
    return "This parameter combination makes the function undefined.";
  }
  return "The curve missed. Compare its height with the target and adjust again.";
}

export function Tutorial({
  profile,
  onExit,
}: {
  profile: PublicProfile;
  onExit: () => void;
}) {
  const storageKey = `chickgraph:tutorial:${profile.id}`;
  const [levelIndex, setLevelIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [values, setValues] = useState<TutorialValues>(() =>
    tutorialInitialValues(tutorialLevels[0]),
  );
  const [feedback, setFeedback] = useState("");
  const level = tutorialLevels[levelIndex];
  const state = useMemo(
    () =>
      createTutorialState(level, {
        id: profile.id,
        username: profile.username,
        countryCode: profile.country_code,
      }),
    [level, profile.country_code, profile.id, profile.username],
  );
  const expression = level.formula(values);
  const previewShot = useMemo(
    () => traceShot(state, profile.id, expression),
    [expression, profile.id, state],
  );
  const targetId = tutorialTargetId(level);
  const levelComplete = levelIndex < completedCount;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (Number.isInteger(stored) && stored >= 0) {
        const progress = Math.min(stored, tutorialLevels.length);
        const resumeIndex = Math.min(progress, tutorialLevels.length - 1);
        setCompletedCount(progress);
        setLevelIndex(resumeIndex);
        setValues(tutorialInitialValues(tutorialLevels[resumeIndex]));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  function selectLevel(nextIndex: number) {
    if (nextIndex > completedCount || nextIndex >= tutorialLevels.length) return;
    const nextLevel = tutorialLevels[nextIndex];
    setLevelIndex(nextIndex);
    setValues(tutorialInitialValues(nextLevel));
    setFeedback("");
  }

  function updateParameter(id: TutorialParameterId, value: number) {
    setValues((current) => ({ ...current, [id]: value }));
    setFeedback("");
  }

  function resetLevel() {
    setValues(tutorialInitialValues(level));
    setFeedback("");
  }

  function testShot() {
    if (previewShot.hitChickId === targetId) {
      const nextCompleted = Math.max(completedCount, levelIndex + 1);
      setCompletedCount(nextCompleted);
      window.localStorage.setItem(storageKey, String(nextCompleted));
      setFeedback("Direct hit. Level complete.");
      return;
    }
    setFeedback(missFeedback(previewShot, profile.id));
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
        <div>
          <span className="eyebrow">GUIDED TUTORIAL · LEVEL {levelIndex + 1} OF {tutorialLevels.length}</span>
          <h1>{level.title}</h1>
          <p>{level.concept}</p>
        </div>
        <div className="tutorial-level-tabs" aria-label="Tutorial levels">
          {tutorialLevels.map((candidate, index) => (
            <button
              key={candidate.id}
              className={index === levelIndex ? "active" : ""}
              disabled={index > completedCount}
              onClick={() => selectLevel(index)}
              title={candidate.title}
              aria-label={`Level ${index + 1}: ${candidate.title}`}
            >
              {index < completedCount ? <Check size={14} /> : index + 1}
            </button>
          ))}
        </div>
      </header>

      <div className="tutorial-workspace">
        <section className="tutorial-arena">
          <GameBoard
            state={state}
            shot={previewShot}
            userId={profile.id}
            targetChickId={targetId}
            preview
          />
        </section>

        <aside className="tutorial-controls">
          <div className="tutorial-lesson-copy">
            <span className="panel-label">CONCEPT</span>
            <p>{level.explanation}</p>
          </div>

          <div className="tutorial-formula" aria-label={`Function y equals ${expression}`}>
            <span>y =</span>
            <code>{expression}</code>
          </div>

          <div className="tutorial-parameters">
            {level.parameters.length === 0 ? (
              <div className="tutorial-fixed-value">
                <span className="panel-label">FIXED VALUE</span>
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

          <div className="tutorial-hint">
            <span className="panel-label">TARGET</span>
            <p>{level.hint}</p>
          </div>

          <div className={`tutorial-feedback ${levelComplete ? "success" : ""}`} role="status">
            {feedback || (levelComplete ? "Level complete. You can keep experimenting or continue." : "Adjust the function, then test the shot.")}
          </div>

          <div className="tutorial-actions">
            <button className="icon-button" onClick={resetLevel} title="Reset parameters">
              <RotateCcw size={17} />
            </button>
            {levelComplete ? (
              <button className="button button-primary" onClick={continueTutorial}>
                {levelIndex === tutorialLevels.length - 1 ? "Finish tutorial" : "Next level"}
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
