import { locales, defaultLocale, type Locale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  zh: zhMessages,
};

export function getMessages(locale: Locale) {
  return messages[locale] || messages[defaultLocale];
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export { locales, defaultLocale, type Locale };
