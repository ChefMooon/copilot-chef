import { useRef } from "react";

interface SegmentedCodeInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
}

export function SegmentedCodeInput({
  length,
  value,
  onChange,
  label,
  id,
}: SegmentedCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  function focusSegment(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  }

  function setDigit(index: number, digit: string) {
    const chars = Array.from({ length }, (_, i) => value[i] ?? "");
    chars[index] = digit;
    onChange(chars.join("").slice(0, length));
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusSegment(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusSegment(index + 1);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        focusSegment(index - 1);
      }
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      setDigit(index, "");
    }
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigit(index, "");
      return;
    }
    // Typing or multi-char input (e.g. mobile autofill): fill forward from index.
    const chars = Array.from({ length }, (_, i) => value[i] ?? "");
    for (let offset = 0; offset < cleaned.length && index + offset < length; offset += 1) {
      chars[index + offset] = cleaned[offset];
    }
    onChange(chars.join("").slice(0, length));
    const next = Math.min(length - 1, index + cleaned.length);
    focusSegment(next);
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    const chars = Array.from({ length }, (_, i) => value[i] ?? "");
    for (let offset = 0; offset < pasted.length && index + offset < length; offset += 1) {
      chars[index + offset] = pasted[offset];
    }
    onChange(chars.join("").slice(0, length));
    focusSegment(Math.min(length - 1, index + pasted.length));
  }

  return (
    <div role="group" aria-label={label} id={id}>
      {digits.map((digit, index) => (
        <input
          aria-label={`Digit ${index + 1} of ${length}`}
          className="mr-2 h-12 w-12 rounded-md border border-cream-dark text-center text-xl font-semibold uppercase tracking-widest outline-none focus:border-green"
          inputMode="numeric"
          key={index}
          maxLength={1}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          pattern="[0-9]"
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          value={digit}
        />
      ))}
    </div>
  );
}
