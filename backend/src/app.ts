import 'dotenv-flow/config';
import express from 'express';
import DB from './db/DB';
import InviteController from './api/InviteController';
import InviteManager from './managers/InviteManager';
import AuthController from './api/AuthController';
import UserManager from './managers/UserManager';
import helmet from 'helmet';
import cors from 'cors';
import {session} from './session/Session';
import PostController from './api/PostController';
import PostManager from './managers/PostManager';
import StatusController from './api/StatusController';
import SiteManager from './managers/SiteManager';
import {apiMiddleware} from './api/ApiMiddleware';
import VoteController from './api/VoteController';
import {config} from './config';
import expressWinston from 'express-winston';
import winston from 'winston';
import VoteManager from './managers/VoteManager';
import TheParser from './parser/TheParser';
import colors from '@colors/colors/safe';
import jsonStringify from 'safe-stable-stringify';
import UserController from './api/UserController';
import Redis from './db/Redis';
import FeedManager from './managers/FeedManager';
import FeedController from './api/FeedController';
import InviteRepository from './db/repositories/InviteRepository';
import VoteRepository from './db/repositories/VoteRepository';
import UserRepository from './db/repositories/UserRepository';
import BookmarkRepository from './db/repositories/BookmarkRepository';
import CommentRepository from './db/repositories/CommentRepository';
import PostRepository from './db/repositories/PostRepository';
import SiteRepository from './db/repositories/SiteRepository';
import SiteController from './api/SiteController';
import NotificationsRepository from './db/repositories/NotificationsRepository';
import NotificationManager from './managers/NotificationManager';
import NotificationsController from './api/NotificationsController';
import UserCredentials from './db/repositories/UserCredentials';
import WebPushRepository from './db/repositories/WebPushRepository';
import {Enricher} from './api/utils/Enricher';

const app = express();

const loggerColors = {
    'DB': 'blue',
    'HTTP': 'yellow',
    'REDIS': 'magenta'
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
            const color = info.service && loggerColors[info.service] ? loggerColors[info.service] : 'cyan';
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

const redis = new Redis(config.redis, logger.child({ service: 'REDIS' }));

const db = new DB(config.mysql, logger.child({ service: 'DB' }));

const theParser = new TheParser();

const bookmarkRepository = new BookmarkRepository(db);
const commentRepository = new CommentRepository(db);
const credentialsRepository = new UserCredentials(db);
const inviteRepository = new InviteRepository(db);
const notificationsRepository = new NotificationsRepository(db);
const postRepository = new PostRepository(db);
const siteRepository = new SiteRepository(db);
const voteRepository = new VoteRepository(db);
const userRepository = new UserRepository(db);
const webPushRepository = new WebPushRepository(db);

const inviteManager = new InviteManager(inviteRepository);
const notificationManager = new NotificationManager(commentRepository, notificationsRepository, postRepository, siteRepository, userRepository, webPushRepository, config.vapid, config.site);
const userManager = new UserManager(credentialsRepository, userRepository, voteRepository, commentRepository, postRepository, webPushRepository, notificationManager, redis.client);
const siteManager = new SiteManager(siteRepository, userManager);
const feedManager = new FeedManager(bookmarkRepository, postRepository, userRepository, siteManager, redis.client);
const postManager = new PostManager(bookmarkRepository, commentRepository, postRepository, feedManager, notificationManager, siteManager, userManager, theParser);
const voteManager = new VoteManager(voteRepository, postManager, redis.client);

const apiEnricher = new Enricher(siteManager, userManager);

const requests = [
    new AuthController(userManager, logger.child({ service: 'AUTH' })),
    new InviteController(inviteManager, userManager, logger.child({ service: 'INVITE' })),
    new PostController(apiEnricher, postManager, feedManager, siteManager, userManager, logger.child({ service: 'POST' })),
    new StatusController(apiEnricher, siteManager, userManager, logger.child({ service: 'STATUS' })),
    new VoteController(voteManager, userManager, logger.child({ service: 'VOTE' })),
    new UserController(apiEnricher, userManager, postManager, voteManager, logger.child({ service: 'USER' })),
    new FeedController(apiEnricher, feedManager, siteManager, userManager, postManager, logger.child({ service: 'FEED' })),
    new SiteController(apiEnricher, feedManager, siteManager, logger.child( { service: 'SITE' })),
    new NotificationsController(notificationManager, userManager, logger.child({ service: 'NOTIFY' })),
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
    meta: true, // optional: control whether you want to log the metadata about the request (default to true)
    msg: '{{res.statusCode}} {{req.method}} {{req.ip}} {{req.url}}', // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
    expressFormat: false, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
    colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
}));

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

for (const request of requests) {
    app.use('/api/v1/', request.router);
}

app.all('*', (req, res) => {
    res.status(404).json({ result: 'error', code: '404', message: 'Unknown endpoint' });
});

(async () => {
    await db.ping();
    await redis.connect();

    await (new Promise<void>((resolve, reject) => {
        app.listen(config.port, () => {
            logger.info(`HTTP server is listening on ${config.port}`);
            resolve();
        }).on('error', (error) => {
            logger.error('Could not start http server', {error: error});
            reject(error);
        });
    }));
})()
    .then(() => {
        logger.info('Backend ready');
    })
    .catch(error => {
        logger.error(`Failed to start: ${error.message}`, { error: error });
        process.exit(1);
    });
