import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../lib/translations';

type LanguageType = 'English' | 'Filipino' | 'Hiligaynon';

interface TranslationContextProps {
  language: LanguageType;
  changeLanguage: (lang: LanguageType) => Promise<void>;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextProps | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<LanguageType>('English');

  useEffect(() => {
    const loadStoredLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('settings_language');
        if (savedLang === 'English' || savedLang === 'Filipino' || savedLang === 'Hiligaynon') {
          setLanguage(savedLang);
        } else {
          // Default to English
          setLanguage('English');
        }
      } catch (error) {
        console.warn('Failed to load language preference:', error);
      }
    };
    loadStoredLanguage();
  }, []);

  const changeLanguage = async (newLang: LanguageType) => {
    setLanguage(newLang);
    try {
      await AsyncStorage.setItem('settings_language', newLang);
    } catch (error) {
      console.warn('Failed to save language preference:', error);
    }
  };

  const t = (key: string): string => {
    const currentTranslations = translations[language];
    if (currentTranslations && currentTranslations[key] !== undefined) {
      return currentTranslations[key];
    }
    // Fall back to English
    const fallbackTranslations = translations['English'];
    if (fallbackTranslations && fallbackTranslations[key] !== undefined) {
      return fallbackTranslations[key];
    }
    return key;
  };

  return (
    <TranslationContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
