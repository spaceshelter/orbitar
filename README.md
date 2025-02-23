# Orbitar

Прототип коллективного блога.

![Build badge](https://github.com/spaceshelter/orbitar/actions/workflows/build.yml/badge.svg?event=push&branch=main)

**ДИСКЛЕЙМЕР**: целью было быстро сделать прототип. Писалось всё быстро и на коленке, код дурно пахнет и на 100% подлежит переписыванию.

## Разработка

### Настройка

Файл `.env.sample` необходимо скопировать в `.env` и заполнить или скорректировать необходимые значения.

В hosts добавить:

```hosts
127.0.0.1 orbitar.local api.orbitar.local
```

### Особенности

* [Локальный запуск в дебаг режиме](docs/local-development.md)
* [Организация .env переменных](docs/environment.md)

### Запуск production-сборки полностью в контейнере

Пересборка фронта и бэка (если необходимо):

```sh
docker compose -p orbitar -f compose-deploy-nonssl.yml build --no-cache frontend backend
```

Запуск:

```sh
docker compose -p orbitar -f compose-deploy-nonssl.yml up
```

### Линт и форматирование

Для линта и форматирования используется eslint и prettier.

в корне проекта:
```sh
npm run install # установит зависимости и pre-commit хук
```

линт и форматирование:
```sh
npm run lint
# или
npm run lint:fix
```


## Утилиты

### Генератор рандомного контента для тестов

Для генерации контента надо запустить проект в [дебаг режиме](docs/local-development.md).

Использование:

(в папке `backend`, перед первым запуском выполнить `npm install`)

```sh
npm run generate-dummy-content -- --help
```

Например:

```sh
npm run generate-dummy-content -- -u 10 -s 8 -p 20 -c 100
```

Для генерации осмысленных текстов используйте параметр `-f 1`, например:

```sh
npm run generate-dummy-content -- -u 10 -s 8 -p 20 -c 100 -f 1
```

Для генерации осмысленных текстов используется API https://fish-text.ru/, соответственно, нужно интернет-соединение.
