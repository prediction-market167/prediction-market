import apiClient from './client'
import type { Question, QuestionTier, QuestionStatus, QuestionCounts } from '@/types'

export interface UploadResult {
  created: number
  questions: Question[]
}

export interface GenerateRequest {
  category: string
  count: number
}

export interface GeneratedQuestionItem {
  tier: string
  question_mn: string
  question_en: string
  question_ru: string
  question_hi: string
  options_mn: string[]
  options_en: string[]
  options_ru: string[]
  options_hi: string[]
  correct_option_idx: number
}

const questionsApi = {
  list: (params?: { tier?: QuestionTier; status?: QuestionStatus }) =>
    apiClient
      .get<Question[]>('/admin/questions', { params: params ?? {} })
      .then(r => r.data),

  counts: () =>
    apiClient.get<QuestionCounts>('/admin/questions/counts').then(r => r.data),

  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<UploadResult>('/admin/questions/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  triggerTier: (tier: QuestionTier) =>
    apiClient
      .post(`/admin/questions/trigger/${tier}`)
      .then(r => r.data),

  resetStatus: (questionId: number) =>
    apiClient
      .post<Question>(`/admin/questions/${questionId}/reset`)
      .then(r => r.data),

  delete: (questionId: number) =>
    apiClient.delete(`/admin/questions/${questionId}`),

  generate: (req: GenerateRequest) =>
    apiClient
      .post<GeneratedQuestionItem[]>('/admin/questions/generate', req)
      .then(r => r.data),

  saveBatch: (questions: GeneratedQuestionItem[]) =>
    apiClient
      .post<{ created: number }>('/admin/questions/save-batch', { questions })
      .then(r => r.data),
}

export default questionsApi
