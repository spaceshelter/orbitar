## Orbitar

Прототип коллективного блога.

![Build badge](https://github.com/mugabe/orbitar/actions/workflows/build.yml/badge.svg?event=push&branch=main) ![Lint badge](https://github.com/mugabe/orbitar/actions/workflows/lint.yml/badge.svg?event=push&branch=main)

**ДИСКЛЕЙМЕР**: целью было быстро сделать прототип. Писалось всё быстро и на коленке, код дурно пахнет и на 100% подлежит переписыванию.

## Разработка
Файл `.env.sample` необходимо скопировать в `.env` и заполнить или скорректировать необходимые значения.

В hosts добавить:
```
127.0.0.1 orbitar.local api.orbitar.local

# Можно дополнить списком подсайтов по вкусу (опционально)
127.0.0.1 idiod.orbitar.local
```

### Запуск для отладки

1. Запустить контейнер с базой и веб-роутером (в корне проекта):
    ```
    docker-compose -p orbitar-dev -f docker-compose.dev.yml up
    ```
    mysql повиснет на стандартном 3306 порту, redis на 6379.
    
    Веб-роутер на 80 порту - будет перенаправлять запросы с `*.orbitar.local` на `localhost:5000` (фронт), а `api.orbitar.local` на `localhost:5001` (бэк).


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
1. Сгенерировать client_id на странице https://api.imgur.com/oauth2/addclient.
    
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
3. Сгенерированные ключи прописать в `backend/.env.local` и указать ваш контактный адрес (email или url):
    ```
    VAPID_PUBLIC_KEY=<Public Key>
    VAPID_PRIVATE_KEY=<Private Key>
    VAPID_CONTACT=<email@email.com>
    ```
4. В `frontend/.env.local` добавить публичный ключ и `WDS_SOCKET_PORT=0`:
   ```
   REACT_APP_VAPID_PUBLIC_KEY=<Public Key>
   ```

### Запуск production-сборки полностью в контейнере
```
# Пересборка фронта и бэка (если необходимо)
docker-compose -p orbitar -f docker-compose.local.yml build --no-cache frontend backend
# Запуск
docker-compose -p orbitar -f docker-compose.local.yml up
```

## Утилиты

### Генератор рандомного контента для тестов

Использование:

(в папке `backend`, перед первым запуском выполнить `npm install`)

    npm run generate-dummy-content -- --help
   
Например:
   
    npm run generate-dummy-content -- -u 10 -s 8 -p 20 -c 100
   
