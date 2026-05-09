import apiClient from './client'
import type { Question, QuestionTier, QuestionStatus, QuestionCounts } from '@/types'

export interface UploadResult {
  created: number
  questions: Question[]
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
}

export default questionsApi
