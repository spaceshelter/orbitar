## Orbitar

Прототип коллективного блога.

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

### Настройка web-push (опционально)
1. В директории `backend` выполнить генерацию VAPID-ключей:
    ```
    npx web-push generate-vapid-keys
    ```
2. Сгенерированные ключи прописать в `backend/.env.local` и указать ваш контактный адрес (email или url):
    ```
    VAPID_PUBLIC_KEY=<Public Key>
    VAPID_PRIVATE_KEY=<Private Key>
    VAPID_CONTACT=<email@email.com>
    ```
3. Публичный ключ так же прописать в `frontend/.env.local`:
   ```
   REACT_APP_VAPID_PUBLIC_KEY=<Public Key>
   ```
4. Для локальной отладки в Chrome открыть `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, включить опцию и добавить в разрешённые адреса `http://orbitar.local`. 

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
   