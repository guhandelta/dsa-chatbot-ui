// Shows the user's current peppercorn balance in the header.
import { Coins } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function PeppercornBadge() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)]"
      title={`${user.peppercorns} peppercorns remaining`}
    >
      <Coins size={16} className="text-[var(--lagoon-deep)]" />
      {user.peppercorns}
    </span>
  )
}
