import { TranslationMode } from '../../managers/TranslationManager'
import DB from '../DB'
import { TranslationRaw } from '../types/TranslationRaw'

function getKey(mode: TranslationMode, language?: string): string {
  if (mode === 'translate' && language) {
    return `tr_${language}`
  }
  return mode.substr(0, 2)
}

export default class TranslationRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async getTranslation(
    content_source_id: number,
    mode: TranslationMode,
    language?: string,
  ): Promise<TranslationRaw | undefined> {
    const modeKey = getKey(mode, language)

    return await this.db.fetchOne<TranslationRaw>(
      'select * from translations where content_source_id=:content_source_id and mode=:mode',
      {
        content_source_id,
        mode: modeKey,
      },
    )
  }

  async saveTranslation(
    content_source_id: number,
    mode: TranslationMode,
    title: string,
    html: string,
    language?: string,
  ): Promise<void> {
    const modeKey = getKey(mode, language)

    await this.db.query(
      'insert into translations (content_source_id, mode, title, html) values (:content_source_id, :mode, :title, :html) on duplicate key update title=:title, html=:html',
      {
        content_source_id,
        mode: modeKey,
        title,
        html,
      },
    )
  }
}
