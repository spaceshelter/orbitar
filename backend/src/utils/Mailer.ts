import fetch from 'node-fetch';
import {SiteConfig} from '../config';

export async function sendResetPasswordEmail(username: string, email: string, code: string, siteConfig: SiteConfig): Promise<boolean> {
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
                    <p>Если ничего не получается, можете написать в <a href="https://t.me/orbitar_bot">телеграм боту</a></p>
                    </body></html>`
            })
        });
        const result = await response.json();
        return !!result.messageId;
    } catch (e) {
        console.trace(e);
        return false;
    }
}
