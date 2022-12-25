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

### Настройка загрузки изображений на imgur (опционально)
1. Сгенерировать `client_id` на странице https://api.imgur.com/oauth2/addclient.

   В `Authorization type` выбрать `Anonymous usage`, в `Authorization callback URL` - любой валидный URL (он требуется для регистрации, но не используется).
2. В корневом `.env` файле прописать полученный `client_id`
   ```
    IMGUR_CLIENT_ID=<client_id>
   ```
3. Перезапустить caddy
   ```
   docker-compose -p orbitar-dev -f docker-compose.dev.yml up -d caddy
   ```

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