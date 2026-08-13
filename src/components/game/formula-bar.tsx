"use client";

import { CircleHelp, LoaderCircle, Send } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

const inserts = [
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

export function FormulaBar({
  disabled,
  busy,
  onFire,
}: {
  disabled: boolean;
  busy: boolean;
  onFire: (expression: string) => Promise<void>;
}) {
  const [expression, setExpression] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!expression.trim() || disabled || busy) return;
    await onFire(expression);
  }

  function insert(value: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    const next = `${expression.slice(0, start)}${value}${expression.slice(end)}`;
    setExpression(next);
    window.setTimeout(() => {
      input?.focus();
      input?.setSelectionRange(start + value.length, start + value.length);
    });
  }

  return (
    <form className="formula-bar" onSubmit={submit}>
      <div className="function-tools" aria-label="Insert function">
        {inserts.map((item) => (
          <button key={item.label} type="button" onClick={() => insert(item.value)} disabled={disabled} title={`Insert ${item.value}`}>{item.label}</button>
        ))}
        <button type="button" className="help-tool" title="Allowed: x, numbers, +, -, *, /, ^, sin, cos, tan, sqrt, abs, log, ln, exp"><CircleHelp size={16} /></button>
      </div>
      <label className="formula-input">
        <span>y =</span>
        <input
          ref={inputRef}
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder="0.4*x + 3*sin(x)"
          maxLength={120}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label="Function"
        />
      </label>
      <button className="button button-fire" disabled={disabled || busy || !expression.trim()}>
        {busy ? <LoaderCircle className="spin" size={19} /> : <Send size={18} />}
        Fire
      </button>
    </form>
  );
}
