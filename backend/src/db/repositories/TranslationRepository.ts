import DB from '../DB';
import {TranslationRaw} from '../types/TranslationRaw';
import {TranslationMode} from '../../managers/TranslationManager';

export default class TranslationRepository {
    private db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    async getTranslation(content_source_id: number, mode: TranslationMode): Promise<TranslationRaw | undefined> {
        return await this.db.fetchOne<TranslationRaw>('select * from translations where content_source_id=:content_source_id and mode=:mode', {
            content_source_id,
            // TODO rename field
            mode: mode.substr(0, 2)
        });
    }

    async saveTranslation(content_source_id: number, mode: TranslationMode, title: string, html: string): Promise<void> {
        await this.db.query('insert into translations (content_source_id, mode, title, html) values (:content_source_id, :mode, :title, :html) on duplicate key update title=:title, html=:html', {
            content_source_id,
            mode: mode.substr(0, 2),
            title,
            html
        });
    }
}
