import DB from '../DB';
import {TranslationRaw} from '../types/TranslationRaw';
import {TranslationMode} from "../../managers/TranslationManager";

export default class TranslationRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getTranslation(content_source_id: number, mode: TranslationMode): Promise<TranslationRaw | undefined> {
        return await this.db.fetchOne<TranslationRaw>('select * from translations where content_source_id=:content_source_id and language=:language', {
            content_source_id,
            // TODO rename field
            language: mode.substr(0, 2)
        });
    }

    async saveTranslation(content_source_id: number, mode: TranslationMode, title: string, html: string): Promise<void> {
        await this.db.query('insert into translations (content_source_id, language, title, html) values (:content_source_id, :language, :title, :html) on duplicate key update title=:title, html=:html', {
            content_source_id,
            language: mode.substr(0, 2),
            title,
            html
        });
    }
}
