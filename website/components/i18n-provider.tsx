"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { type Locale, defaultLocale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";

const messages: Record<Locale, typeof enMessages> = {
  en: enMessages,
  zh: zhMessages,
};

interface I18nContextType {
  locale: Locale;
  t: (key: string) => string | Record<string, string>;
}

const I18nContext = createContext<I18nContextType>({
  locale: defaultLocale,
  t: () => "",
});

export function I18nProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const messageSet = messages[locale] || messages[defaultLocale];

  const t = (key: string): string | Record<string, string> => {
    const keys = key.split(".");
    let value: unknown = messageSet;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // Return key if not found
      }
    }

    return (value as string | Record<string, string>) || key;
  };

  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
