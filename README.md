## Orbitar

Прототип коллективного блога.

**ДИСКЛЕЙМЕР**: целью было быстро сделать прототип. Писалось всё быстро и на коленке, код дурно пахнет и на 100% подлежит переписыванию.

## Разработка
В hosts добавить:
```
127.0.0.1 orbitar.local api.orbitar.local

# Можно дополнить списком подсайтов по вкусу (опционально)
127.0.0.1 idiod.orbitar.local
```
В файле `.env` можно изменить имя хоста, если `orbitar.local` вдруг не подходит.

### Запуск для отладки

1. Запустить контейнер с базой и веб-роутером (в корне проекта):
    ```
    docker-compose -p orbitar-dev -f docker-compose.dev.yml up
    ```
    mysql повиснет на стандартном 3306 порту
    
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
      npm run migrations:dev up
      ```
   * Запустить node:
       ```
       npm run start:dev
       ```

После первого запуска можно открыть приглашение http://orbitar.local/invite/initial и зарегистрировать первый юзернейм.

### Запуск полностью в контейнере (локально)
```
# Пересборка фронта и бэка
docker-compose -p orbitar -f docker-compose.local.yml build --no-cache
# Запуск
docker-compose -p orbitar -f docker-compose.local.yml up
```
