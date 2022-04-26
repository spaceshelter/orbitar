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

const app = express();
const port = config.port;

const db = new DB(config.mysql);

const inviteManager = new InviteManager(db);
const userManager = new UserManager(db);
const postManager = new PostManager(db);
const siteManager = new SiteManager(db, userManager);
const voteManager = new VoteManager(db, postManager);

const requests = [
    new AuthController(userManager),
    new InviteController(inviteManager),
    new PostController(postManager, siteManager, userManager),
    new MeController(userManager),
    new VoteController(voteManager)
];

const filterLog = winston.format((info, opts) => {
    if (info.meta.req?.body?.password) {
        info.meta.req.body.password = '***';
    }
    return info;
});

app.use(expressWinston.logger({
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        filterLog(),
        winston.format.colorize(),
        winston.format.simple()
    ),
    requestWhitelist: ['body'],
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "HTTP {{res.statusCode}} {{req.method}} {{req.ip}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
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

app.use(session());
app.use(apiMiddleware());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

for (let request of requests) {
    app.use('/api/v1/', request.router);
}

app.all('*', (req, res) => {
    res.status(404).json({ result: 'error', code: '404', message: 'Unknown endpoint' });
});

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});
