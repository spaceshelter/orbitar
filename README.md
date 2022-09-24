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

### Разработка

* [Локаьлный запуск в дебаг режиме](docs/local-develpoment.md)
* [Организация .env переменных](docs/environment.md)


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
   
Для генерации осмысленных текстов используйте параметр `-f 1`, например:

    npm run generate-dummy-content -- -u 10 -s 8 -p 20 -c 100 -f 1


Для генерации осмысленных текстов используется API https://fish-text.ru/, соответственно, нужно интернет-соединение
