export type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

type Config = {
  intervalMs: number;
  dbFile: string;
  lastProcessedIdFile: string;
  batchSize: number;
  mysql: MysqlConfig;
};

export const config: Config = {
  intervalMs: parseInt(process.env.INTERVAL_MS, 10) || 1000,
  dbFile: process.env.DB_FILE || '/app/data/index.csv',
  lastProcessedIdFile: process.env.LAST_PROCESSED_ID_FILE || '/app/data/id.txt',
  batchSize: parseInt(process.env.BATCH_SIZE, 10) || 10,
  mysql: {
    host: process.env.MYSQL_HOST || 'mysql',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'orbitar',
    password: process.env.MYSQL_PASSWORD || 'orbitar',
    database: process.env.MYSQL_DATABASE || 'orbitar_db',
  }
};
