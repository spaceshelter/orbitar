import { TranslationLanguage, TranslationMode } from '../../../managers/TranslationManager'

export type TranslateRequest = {
  id: number
  type: 'post' | 'comment'
  mode: TranslationMode
  language?: TranslationLanguage
}

export type TranslateResponse = string
