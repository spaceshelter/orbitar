import 'dotenv-flow/config';
import express from 'express';
import DB from './db/DB';
import InviteController from './api/InviteController';
import InviteManager from './db/managers/InviteManager';
import AuthController from './api/AuthController';
import UserManager from './db/managers/UserManager';
import helmet from 'helmet';
import cors from 'cors';
import {session} from './session/Session';
import PostController from './api/PostController';
import PostManager from './db/managers/PostManager';
import MeController from './api/MeController';
import SiteManager from './db/managers/SiteManager';
import {apiMiddleware} from './api/ApiMiddleware';
import VoteController from './api/VoteController';
import {config} from './config';
import expressWinston from 'express-winston';
import winston from 'winston';
import VoteManager from './db/managers/VoteManager';
import TheParser from './parser/TheParser';
import colors from '@colors/colors/safe';
import jsonStringify from 'safe-stable-stringify';

const app = express();

const loggerColors = {
    'DB': 'blue',
    'HTTP': 'yellow'
};

const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format((info) => {
            info.level = `[${info.level.padEnd(7)}]`;
            return info;
        })(),
        winston.format.colorize(),
        winston.format.printf((info) => {
            let rest = jsonStringify(Object.assign({}, info, {
                level: undefined,
                message: undefined,
                splat: undefined,
                service: undefined
            }));
            if (rest === '{}') {
                rest = '';
            }

            let service = (info.service || '').padEnd(8);
            let color = info.service && loggerColors[info.service] ? loggerColors[info.service] : 'cyan';
            service = colors[color](service);
            return `${info.level} ${service} ${info.message} ${colors.gray(rest)}`;
        }),
    )
});

const logger = winston.createLogger({
    level: config.logLevel,
    transports: [
        consoleTransport
    ]
});
const db = new DB(config.mysql, logger.child({ service: 'DB' }));
const inviteManager = new InviteManager(db);
const userManager = new UserManager(db);
const postManager = new PostManager(db);
const siteManager = new SiteManager(db, userManager);
const voteManager = new VoteManager(db, postManager);

const theParser = new TheParser();

const requests = [
    new AuthController(userManager, logger.child({ service: 'AUTH' })),
    new InviteController(inviteManager, logger.child({ service: 'INVITE' })),
    new PostController(postManager, siteManager, userManager, theParser, logger.child({ service: 'POST' })),
    new MeController(userManager),
    new VoteController(voteManager, logger.child({ service: 'VOTE' }))
];

const filterLog = winston.format((info) => {
    if (info.meta.req?.body?.password) {
        info.meta.req.body.password = '***';
    }
    return info;
});

app.use(expressWinston.logger({
    transports: [
        consoleTransport
    ],
    baseMeta: { service: 'HTTP' },
    format: winston.format.combine(
        filterLog(),
    ),
    requestWhitelist: ['body'],
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "{{res.statusCode}} {{req.method}} {{req.ip}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: false, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
}))

app.set('trust proxy', 'loopback, uniquelocal');

app.use(helmet.hidePoweredBy());
app.use(cors({
    origin: '*',
    exposedHeaders: ['X-Session-Id'],
    maxAge: 60 * 60
}));

app.use(session(db, logger));
app.use(apiMiddleware());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

for (let request of requests) {
    app.use('/api/v1/', request.router);
}

app.all('*', (req, res) => {
    res.status(404).json({ result: 'error', code: '404', message: 'Unknown endpoint' });
});

db.ping()
    .then(() => {
        app.listen(config.port, () => {
            logger.info(`Server is listening on ${config.port}`);
        }).on('error', (error) => {
            logger.error('Could not start server', {error: error});
            process.exit(1);
        })
    })
    .catch(error => {
        logger.error('Could not connect to database', {error: error});
        process.exit(1);
    });
