import { useRef } from 'react'

export default function CodeInput({ length = 6, value, onChange, autoFocus = true }) {
  const inputsRef = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  function focusInput(index) {
    inputsRef.current[index]?.focus()
  }

  function handleChange(index, rawValue) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = digits.slice()
    next[index] = digit
    onChange(next.join(''))
    if (digit && index < length - 1) focusInput(index + 1)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1)
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    focusInput(Math.min(pasted.length, length - 1))
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={autoFocus && index === 0}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className="h-12 w-full max-w-[3rem] rounded-xl border border-border-subtle/70 bg-surface text-center text-lg font-semibold text-cream outline-none focus:border-ember/50 focus:ring-2 focus:ring-ember/20"
        />
      ))}
    </div>
  )
}
