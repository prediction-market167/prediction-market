import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import mn from './locales/mn'
import ru from './locales/ru'
import hi from './locales/hi'

const savedLang = localStorage.getItem('lang') ?? 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mn: { translation: mn },
    ru: { translation: ru },
    hi: { translation: hi },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => localStorage.setItem('lang', lng))

export default i18n
