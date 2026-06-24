import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ChevronDownIcon, LogOutIcon } from './icons.jsx'

export default function UserMenu({ user }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/')
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full border border-border-subtle/70 bg-surface/60 p-1 pr-2.5 text-sm font-medium text-cream transition-colors hover:border-ember/40"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ember/15 text-xs font-bold text-ember-light">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.initials}
        </span>
        <span className="hidden max-w-[7rem] truncate sm:inline">{user.displayName}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] w-48 overflow-hidden rounded-2xl border border-border-subtle/70 bg-card py-1.5 shadow-xl shadow-ink/5">
          <div className="border-b border-border-subtle/60 px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-cream">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link
            to="/setup-profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-cream hover:bg-surface"
          >
            Edit profile
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <LogOutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
