import fetch from 'node-fetch';
import {SiteConfig} from '../config';
import {Logger} from 'winston';

// TODO: convert this into a proper service, make siteConfig and logger injectable

export async function sendResetPasswordEmail(username: string, email: string, code: string, siteConfig: SiteConfig, logger: Logger): Promise<boolean> {
    try {
        const response = await fetch('https://api.sendinblue.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'api-key': process.env.SENDING_BLUE_API_KEY
            },
            body: JSON.stringify({
                'sender': {
                    'name': 'Orbitar',
                    'email': 'noreply@orbitar.space'
                },
                'to': [
                    {
                        'email': email
                    }
                ],
                'subject': 'Orbitar: сброс пароля для пользователя ' + username,
                'htmlContent': `<html><head></head><body>
                    <p>Привет, ${username}!</p>
                    <p>Чтобы сбросить пароль, пройдите по этой ссылке: ${(siteConfig.http ? 'http://' : 'https://') + siteConfig.domain}/forgot-password/${code}</p>
                    <p>Ссылка активна только 3 часа</p>
                    <p>Если ничего не получается, можете написать нам на почту <a href="mailto:orbitar.help@gmail.com">orbitar.help@gmail.com</a></p>
                    </body></html>`
            })
        });
        const result = await response.json();
        if (!result.messageId) {
            logger.error('Could not send email', {result});
        }
        return !!result.messageId;
    } catch (e) {
        logger.error(`Failed to send email with password reset code to ` + email);
        logger.error(e);
        return false;
    }
}
