# Telegram Web App — интеграция (сайт + PWA + TWA)

Официальная документация: **[core.telegram.org/bots/webapps](https://core.telegram.org/bots/webapps)**

Один и тот же фронт работает как **обычный сайт**, **PWA** и **Telegram Mini App (TWA)**. Скрипт подключается глобально через `TelegramWebAppProvider`; при открытии в Telegram на `body` ставится `data-telegram-webapp="true"`, доступны `useTelegramWebApp()` и тема.

## Архитектура

- **Корень приложения:** `TelegramWebAppProvider` загружает скрипт `telegram-web-app.js?60` (если ещё нет), инициализирует Web App и отдаёт контекст. `TelegramThemeApplicator` выставляет атрибут на `body` при `isTWA`.
- **Хук `useTelegramWebApp()`:** возвращает `{ isTWA, webApp, themeParams, isReady, platform, colorScheme, reinit }`. Любая страница может проверять `isTWA` и подстраивать UI (кнопки, тема, BackButton).
- **Маршрут `/telegram-app`:** точка входа Mini App: свой layout с `TelegramWebAppInit` (жесты, повторный init при фокусе/навигации). Если открыть эту страницу в обычном браузере (`!isTWA`), показывается подсказка «Откройте в Telegram».
- **Сохранение окна при свайпе:**
  - **Sticky App (CSS):** при `isTWA` на `body` вешается класс `twa-sticky-body` (overflow: hidden, height: 100dvh), контент оборачивается в `twa-sticky-wrap` (overflow-y: auto). Скролл происходит только внутри обёртки, вертикальные свайпы не уходят в Telegram и не закрывают окно (см. [Sticky App](https://docs.telegram-mini-apps.com/platform/sticky-app)).
  - **Жест «назад»:** при `isTWA` в history делается `pushState`; при срабатывании `popstate` снова вызывается `pushState`, чтобы остаться на текущей странице. Так мы пытаемся «съесть» один жест назад, если клиент передаёт его как `history.back()`. Если клиент закрывает WebView до вызова JS, перехват невозможен — тогда остаётся только кнопка «Назад» в шапке Telegram.

## Что используем из API

- **Инициализация:** скрипт `telegram-web-app.js?60`, вызовы `ready()`, `expand()`, `setHeaderColor()`.
- **Жесты:**
  - `disableVerticalSwipes()` (Bot API 7.7+) — отключает закрытие/сворачивание по вертикальному свайпу по **контенту**. По документации: *«In any case, the user will still be able to minimize and close the Mini App by swiping the Mini App's header»* — свайп по **шапке** всё равно закрывает.
  - `enableClosingConfirmation()` (Bot API 6.2+) — диалог подтверждения при попытке закрыть приложение.
- **BackButton** (Bot API 6.1+): `show()`, `hide()`, `onClick(callback)`. В шапке Mini App при вызове `BackButton.show()` отображается **стрелка «назад»** вместо только крестика; по нажатию вызывается наш обработчик. Компонент `TelegramBackButton` в корне приложения всегда показывает BackButton при `isTWA`: на подстраницах — переход по истории (`router.back()`), на главной `/telegram-app` — подтверждение и закрытие. Модальные окна регистрируют свой обработчик через `useTelegramBackHandler(open, onClose)` — тогда стрелка сначала закрывает модал. Системный жест «назад» (кнопка Android / свайп от левого края) в документации не описан и может закрывать WebView без вызова этого события.
- **MainButton** (в доке с 7.10 именуется BottomButton): `setText()`, `show()`, `hide()`, `onClick()`, `offClick()`.
- **Тема:** `themeParams` (bg_color, text_color, button_color и др.), CSS-переменные `var(--tg-theme-*)`.
- **Данные:** `initData`, `initDataUnsafe` — для авторизации на бэкенде (проверка подписи через бот-токен).

## Ограничения по документации

1. Перехватить **системный** жест «назад» (или закрытие по свайпу по шапке) через Web App API нельзя — только кнопка в шапке и её событие `backButtonClicked`.
2. Вертикальные свайпы отключены только по контенту; свайп по шапке мини-приложения по-прежнему закрывает/сворачивает.
3. Рекомендуется вызывать `ready()` как можно раньше; настройки жестов мы повторно применяем при `visibilitychange`, `focus`, `pageshow` и смене маршрута, чтобы клиент не сбрасывал их.

## SDK

Используется только официальный скрипт `telegram-web-app.js` и свой контекст `TelegramWebAppProvider` + хук `useTelegramWebApp()`. Пакет `@telegram-apps/sdk-react` не подключается, чтобы не плодить зависимости; при необходимости его можно добавить и заменить вызовы в layout/страницах TWA на хуки SDK.
