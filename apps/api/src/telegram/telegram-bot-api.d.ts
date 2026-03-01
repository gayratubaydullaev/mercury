declare module 'node-telegram-bot-api' {
  export interface InlineKeyboardButton {
    text: string;
    url?: string;
    callback_data?: string;
    style?: 'primary' | 'success' | 'danger';
  }
  interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][];
  }
  interface SendMessageOptions {
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: InlineKeyboardMarkup;
  }
  class TelegramBot {
    constructor(token: string, options?: { polling?: boolean });
    on(event: 'message', callback: (msg: Message) => void): void;
    on(event: 'callback_query', callback: (query: CallbackQuery) => void): void;
    sendMessage(chatId: number | string, text: string, options?: SendMessageOptions): Promise<Message>;
    answerCallbackQuery(callbackQueryId: string, options?: { text?: string }): Promise<boolean>;
    editMessageReplyMarkup(
      markup: InlineKeyboardMarkup,
      options?: { chat_id?: number | string; message_id?: number }
    ): Promise<Message | boolean>;
    editMessageText(
      text: string,
      options?: { chat_id?: number | string; message_id?: number; parse_mode?: string; reply_markup?: InlineKeyboardMarkup }
    ): Promise<Message | boolean>;
    setMyCommands(commands: { command: string; description: string }[]): Promise<boolean>;
    stopPolling(): void;
  }
  namespace TelegramBot {
    interface Message {
      chat: { id: number; type?: string };
      text?: string;
      from?: { id: number; username?: string };
      message_id?: number;
    }
    interface CallbackQuery {
      id: string;
      from?: { id: number };
      message?: { chat: { id: number }; message_id?: number };
      data?: string;
    }
    interface InlineKeyboardMarkup {
      inline_keyboard: InlineKeyboardButton[][];
    }
  }
  export = TelegramBot;
}
