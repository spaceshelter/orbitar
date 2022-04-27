require('dotenv-flow').config();
const dbMigrate = require('db-migrate');
const dbMigrateLog = require('db-migrate-shared').log;

const config = {
    config: {
        driver: "mysql",
        host: process.env.MYSQL_HOST || "localhost",
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        user: "root",
        password: process.env.MYSQL_ROOT_PASSWORD || "orbitar",
        database: process.env.MYSQL_DATABASE || "orbitar_db",
        "multipleStatements": true
    }
};

const action = process.argv[2];

if (action !== 'wait-and-up') {
    const migrate = dbMigrate.getInstance(false, { env: 'config', config: config });
    if (migrate.registerAPIHook) {
        migrate.registerAPIHook()
            .then(function () {
                migrate.run();
            });
    }
    else {
        migrate.run();
    }
}
else {
    const migrate = dbMigrate.getInstance(true, {env: 'config', config: config});

    console.log(`Run migrations on ${config.config.host}:${config.config.port}, ${config.config.database}`);

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function waitConnection(retries = 50, retryDelay = 5) {
        let lastError;

        for (let i = 1; i <= retries; i++) {
            if (i > 1) {
                console.log(`Retry ${i}/${retries}`);
            }
            dbMigrateLog.silence(true);
            const result = await migrate.check().catch(error => {
                lastError = error;
            });
            dbMigrateLog.silence(false);

            if (result) {
                return result;
            }

            console.log(`Could not connect to database, retry in ${retryDelay} seconds\n  ${lastError.message}`);
            await delay(retryDelay * 1000);
        }

        if (!lastError) {
            throw new Error('Retries');
        }

        throw lastError;
    }

    (async () => {
        const migrationsToRun = await waitConnection();

        if (!migrationsToRun.length) {
            return false;
        }
        console.log('Migrations to run:', migrationsToRun.map(m => m.name).join(', '));

        await migrate.up();
        return true;
    })()
        .then(result => {
            if (!result) {
                console.log('No migrations to run');
            }
            else {
                console.log('Migrations complete');
            }
            process.exit(0);
        })
        .catch(err => {
            console.error('Migration failed\n  ' + err.message);
            process.exit(1);
        });

}