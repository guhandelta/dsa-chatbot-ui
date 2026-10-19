import { api } from './api'

export interface CourseSource { id: string; title: string; kind: string }
export interface CourseModule {
  id: string
  title: string
  objectives: string[]
  practice_brief: string
  prerequisites: string[]
  sources: CourseSource[]
  source_status?: string
}
export interface Course {
  language: string
  title: string
  status: string
  description: string
  prerequisites: string[]
  modules: CourseModule[]
  capstone: { title: string; brief: string; deliverables: string[]; assessment_status: string }
  limitations: string[]
}
export interface CourseReading { title: string; document: string }
export async function fetchCourse(language: string): Promise<Course> {
  return (await api.get(`/courses/${encodeURIComponent(language)}`)).data
}
export async function fetchCourseReading(language: string, moduleId: string, sourceId: string): Promise<CourseReading> {
  return (await api.get(`/courses/${encodeURIComponent(language)}/modules/${encodeURIComponent(moduleId)}/sources/${encodeURIComponent(sourceId)}`)).data
}
