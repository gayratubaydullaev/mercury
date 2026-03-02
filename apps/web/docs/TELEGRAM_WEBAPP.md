# Telegram Web App — используемые части API

Официальная документация: **[core.telegram.org/bots/webapps](https://core.telegram.org/bots/webapps)**

## Что используем в MyShopUZ

- **Инициализация:** скрипт `telegram-web-app.js?60`, вызовы `ready()`, `expand()`, `setHeaderColor()`.
- **Жесты:**
  - `disableVerticalSwipes()` (Bot API 7.7+) — отключает закрытие/сворачивание по вертикальному свайпу по **контенту**. По документации: *«In any case, the user will still be able to minimize and close the Mini App by swiping the Mini App's header»* — свайп по **шапке** всё равно закрывает.
  - `enableClosingConfirmation()` (Bot API 6.2+) — диалог подтверждения при попытке закрыть приложение.
- **BackButton** (Bot API 6.1+): `show()`, `hide()`, `onClick(callback)`. Событие `backButtonClicked` срабатывает только при нажатии на **кнопку «Назад» в шапке** Mini App. Системный жест «назад» (кнопка Android / свайп от левого края) в документации не описан и может закрывать WebView без вызова этого события.
- **MainButton** (в доке с 7.10 именуется BottomButton): `setText()`, `show()`, `hide()`, `onClick()`, `offClick()`.
- **Тема:** `themeParams` (bg_color, text_color, button_color и др.), CSS-переменные `var(--tg-theme-*)`.
- **Данные:** `initData`, `initDataUnsafe` — для авторизации на бэкенде (проверка подписи через бот-токен).

## Ограничения по документации

1. Перехватить **системный** жест «назад» (или закрытие по свайпу по шапке) через Web App API нельзя — только кнопка в шапке и её событие `backButtonClicked`.
2. Вертикальные свайпы отключены только по контенту; свайп по шапке мини-приложения по-прежнему закрывает/сворачивает.
3. Рекомендуется вызывать `ready()` как можно раньше; настройки жестов мы повторно применяем при `visibilitychange`, `focus`, `pageshow` и смене маршрута, чтобы клиент не сбрасывал их.
