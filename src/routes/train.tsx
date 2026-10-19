import { createFileRoute, redirect } from '@tanstack/react-router'
import { requireTeachingAccess } from '../lib/routeAccess'

export const Route = createFileRoute('/train')({
  beforeLoad: async () => {
    await requireTeachingAccess()
    throw redirect({ to: '/teach', replace: true })
  },
})
