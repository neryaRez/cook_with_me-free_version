import { useState } from 'react'
import Field, { inputClass } from './Field.jsx'
import { EyeIcon, EyeOffIcon } from '../icons.jsx'

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  hint,
  helperText,
  error,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <Field label={label} hint={hint} helperText={helperText} error={error}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-colors hover:text-cream"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}
