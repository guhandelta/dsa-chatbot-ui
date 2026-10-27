import curriculum from '../content/curricula/web-fundamentals.json'

export type ChallengeKind = 'learn' | 'build' | 'debug' | 'review'

export interface WebCurriculumChallenge {
  id: string
  title: string
  task: string
  kind: ChallengeKind
}

export interface WebCurriculumSection {
  id: string
  title: string
  outcome: string
  lessons: { title: string; focus: string }[]
  battery: WebCurriculumChallenge[]
}

export interface WebCurriculumElective {
  title: string
  items: string
  prerequisite: string
}

/** Curriculum content is maintained in src/content/curricula/web-fundamentals.json. */
export const WEB_FUNDAMENTALS = curriculum.fundamentals as WebCurriculumSection[]
export const UI_ELECTIVES = curriculum.electives as WebCurriculumElective[]

/** Give every curriculum challenge its own persistent playground project. */
export function webChallengeProjectSlug(sectionId: string, challengeId: string): string {
  const challengePart = challengeId.startsWith(`${sectionId}-`)
    ? challengeId.slice(sectionId.length + 1)
    : challengeId
  let hash = 2166136261
  for (const character of `${sectionId}:${challengeId}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const readable = challengePart.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18).replace(/-+$/g, '')
  const section = sectionId.replace(/[^a-z0-9]+/g, '').slice(0, 7)
  const shortHash = (hash >>> 0).toString(36).padStart(7, '0')
  return `web-${section}-${readable}-${shortHash}`
}
