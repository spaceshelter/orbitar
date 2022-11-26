import DB from '../DB';
import {TranslationRaw} from '../types/TranslationRaw';

export default class TranslationRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getTranslation(content_source_id: number, language: string): Promise<TranslationRaw | undefined> {
        return await this.db.fetchOne<TranslationRaw>('select * from translations where content_source_id=:content_source_id and language=:language', {
            content_source_id,
            language
        });
    }

    async saveTranslation(content_source_id: number, language: string, title: string, html: string): Promise<void> {
        await this.db.query('insert into translations (content_source_id, language, title, html) values (:content_source_id, :language, :title, :html) on duplicate key update title=:title, html=:html', {
            content_source_id,
            language,
            title,
            html
        });
    }
}
