# Запуск для отладки

1. Запустить контейнер с базой и веб-роутером (в корне проекта):
    ```
    docker-compose -p orbitar-dev -f docker-compose.dev.yml up
    ```
   mysql повиснет на стандартном 3306 порту, redis на 6379.

   Веб-роутер на 80 порту будет перенаправлять запросы с `*.orbitar.local` на `localhost:5000` (фронт), а `api.orbitar.local` на `localhost:5001` (бэк).


2. Запустить фронт в режиме отладки (в папке `frontend`):

    * Установить зависимости:
        ```
        npm install
        ```  
    * Запустить node:
        ```
        npm run start
        ```

3. Запустить бэк в режиме отладки (в папке `backend`):

    * Установить зависимости:
        ```
        npm install
        ```  
    * Выполнить миграции БД
       ```
       npm run migration:dev up
       ```
    * Запустить node:
        ```
        npm run start:dev
        ```

После первого запуска можно открыть приглашение http://orbitar.local/invite/initial и зарегистрировать первый юзернейм.

### Настройка загрузки изображений на orbitar.media (опционально)

Указать в .env, frontend/.env.development, backend/.env.development файле правильные:

1. MEDIA_HOSTING_URL - адрес хостинга изображений: e.g. https://orbitar.media
2. MEDIA_HOSTING_CLIENT_ID - авторизация загрузки
3. MEDIA_HOSTING_DIMS_AES_KEY - ключ для расшифровки размеров изображений


### Настройка локального https (опционально)
1. В `frontend/.env.local` добавить `WDS_SOCKET_PORT=0`
2. Сгенерировать самоподписанный сертификат для https:
   ```
   cd caddy
   openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 \
     -config openssl.cnf -extensions req_ext \
     -keyout certs/orbitar.key -out certs/orbitar.crt
   ```
   Сгенерированный `certs/orbitar.crt` добавить в систему/браузер как доверенный.

3. Для запуска контейнеров использовать конфиг `docker-compose.ssl.dev.yml`


### Настройка Web Push Notifications (опционально)
1. Настроить https, либо разрешить в браузере работу Service Workers по http.

2. В директории `backend` выполнить генерацию VAPID-ключей:
    ```
    npx web-push generate-vapid-keys
    ```
3. Сгенерированные ключи прописать в `backend/.env.development` и указать ваш контактный адрес (email или url):
    ```
    VAPID_PUBLIC_KEY=<Public Key>
    VAPID_PRIVATE_KEY=<Private Key>
    VAPID_CONTACT=<email@email.com>
    ```
4. В `frontend/.env.development` добавить публичный ключ:
   ```
   REACT_APP_VAPID_PUBLIC_KEY=<Public Key>
   ```