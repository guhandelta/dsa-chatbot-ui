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
