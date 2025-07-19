/**
 * 🔧 Template Helpers and Filters
 * Built-in and custom helper functions for template rendering
 */

import { HelperRegistry, FilterRegistry, I18nConfig } from './types';

/**
 * Helper and Filter Manager
 */
export class TemplateHelperManager {
  private helpers: HelperRegistry = {};
  private filters: FilterRegistry = {};
  private i18nConfig: I18nConfig | undefined;

  constructor(i18nConfig?: I18nConfig) {
    this.i18nConfig = i18nConfig;
    this.setupBuiltinHelpers();
    this.setupBuiltinFilters();
  }

  /**
   * Register a custom helper
   */
  registerHelper(name: string, fn: (...args: any[]) => any): void {
    this.helpers[name] = fn;
  }

  /**
   * Register a custom filter
   */
  registerFilter(name: string, fn: (value: any, ...args: any[]) => any): void {
    this.filters[name] = fn;
  }

  /**
   * Get helper function
   */
  getHelper(name: string): ((...args: any[]) => any) | undefined {
    return this.helpers[name];
  }

  /**
   * Get filter function
   */
  getFilter(name: string): ((value: any, ...args: any[]) => any) | undefined {
    return this.filters[name];
  }

  /**
   * Get all helpers
   */
  getAllHelpers(): HelperRegistry {
    return { ...this.helpers };
  }

  /**
   * Get all filters
   */
  getAllFilters(): FilterRegistry {
    return { ...this.filters };
  }

  /**
   * Setup built-in helper functions
   */
  private setupBuiltinHelpers(): void {
    this.helpers = {
      // Date and time helpers
      formatDate: (date: Date | string, format: string = 'YYYY-MM-DD') => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return format
          .replace('YYYY', String(year))
          .replace('MM', month)
          .replace('DD', day);
      },

      timeAgo: (date: Date | string) => {
        const now = new Date().getTime();
        const then = new Date(date).getTime();
        const diff = now - then;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
      },

      // String manipulation helpers
      uppercase: (str: string) => String(str).toUpperCase(),
      lowercase: (str: string) => String(str).toLowerCase(),
      capitalize: (str: string) => {
        const s = String(str);
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      },
      truncate: (str: string, length: number, suffix: string = '...') => {
        const s = String(str);
        return s.length > length ? s.slice(0, length) + suffix : s;
      },
      slugify: (str: string) => {
        return String(str)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      },
      trim: (str: string) => String(str).trim(),
      replace: (str: string, search: string, replacement: string) => {
        return String(str).replace(new RegExp(search, 'g'), replacement);
      },

      // Number helpers
      formatNumber: (num: number, decimals: number = 0) => {
        return Number(num).toFixed(decimals);
      },
      formatPrice: (
        price: number,
        currency: string = 'USD',
        locale: string = 'en-US'
      ) => {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
        }).format(Number(price));
      },
      round: (num: number, decimals: number = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(Number(num) * factor) / factor;
      },

      // Comparison helpers
      eq: (a: any, b: any) => a === b,
      ne: (a: any, b: any) => a !== b,
      gt: (a: number, b: number) => Number(a) > Number(b),
      lt: (a: number, b: number) => Number(a) < Number(b),
      gte: (a: number, b: number) => Number(a) >= Number(b),
      lte: (a: number, b: number) => Number(a) <= Number(b),

      // Logic helpers
      and: (...args: any[]) => args.every(Boolean),
      or: (...args: any[]) => args.some(Boolean),
      not: (value: any) => !value,

      // Array helpers
      length: (arr: any) => {
        if (Array.isArray(arr)) return arr.length;
        if (typeof arr === 'string') return arr.length;
        if (arr && typeof arr === 'object') return Object.keys(arr).length;
        return 0;
      },
      first: (arr: any[]) => (Array.isArray(arr) ? arr[0] : undefined),
      last: (arr: any[]) =>
        Array.isArray(arr) ? arr[arr.length - 1] : undefined,
      slice: (arr: any[], start: number, end?: number) => {
        return Array.isArray(arr) ? arr.slice(start, end) : arr;
      },
      sort: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return arr;
        if (!key) return [...arr].sort();
        return [...arr].sort((a, b) => {
          const aVal = a[key];
          const bVal = b[key];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        });
      },
      reverse: (arr: any[]) => (Array.isArray(arr) ? [...arr].reverse() : arr),
      join: (arr: any[], separator: string = ', ') => {
        return Array.isArray(arr) ? arr.join(separator) : String(arr);
      },
      unique: (arr: any[]) =>
        Array.isArray(arr) ? Array.from(new Set(arr)) : arr,
      filter: (arr: any[], key: string, value?: any) => {
        if (!Array.isArray(arr)) return arr;
        if (value === undefined) {
          return arr.filter((item) => Boolean(item[key]));
        }
        return arr.filter((item) => item[key] === value);
      },
      map: (arr: any[], key: string) => {
        return Array.isArray(arr) ? arr.map((item) => item[key]) : arr;
      },

      // Object helpers
      keys: (obj: any) =>
        obj && typeof obj === 'object' ? Object.keys(obj) : [],
      values: (obj: any) =>
        obj && typeof obj === 'object' ? Object.values(obj) : [],
      has: (obj: any, key: string) =>
        obj && typeof obj === 'object' && key in obj,

      // Utility helpers
      json: (obj: any, indent: number = 2) => JSON.stringify(obj, null, indent),
      default: (value: any, defaultValue: any) =>
        value !== undefined && value !== null && value !== ''
          ? value
          : defaultValue,
      debug: (value: any) => {
        console.log('Template Debug:', value);
        return value;
      },
      typeof: (value: any) => typeof value,
      stringify: (value: any) => String(value),

      // URL helpers
      urlEncode: (str: string) => encodeURIComponent(String(str)),
      urlDecode: (str: string) => decodeURIComponent(String(str)),

      // Conditional helpers
      unless: (condition: any, content: string) => (!condition ? content : ''),
      when: (condition: any, truthyValue: any, falsyValue?: any) => {
        return condition ? truthyValue : (falsyValue || '');
      },

      // Internationalization helpers
      t: (key: string, locale?: string) => {
        return this.translate(key, locale);
      },
      tn: (key: string, count: number, locale?: string) => {
        return this.translatePlural(key, count, locale);
      },
    };
  }

  /**
   * Setup built-in filter functions
   */
  private setupBuiltinFilters(): void {
    this.filters = {
      // String filters
      upper: (value: string) => String(value).toUpperCase(),
      lower: (value: string) => String(value).toLowerCase(),
      title: (value: string) => {
        return String(value).replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      },
      escape: (value: string) => {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },

      // Number filters
      currency: (value: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(Number(value));
      },
      percent: (value: number, decimals: number = 2) => {
        return (Number(value) * 100).toFixed(decimals) + '%';
      },

      // Array filters
      size: (value: any) => {
        if (Array.isArray(value)) return value.length;
        if (typeof value === 'string') return value.length;
        if (value && typeof value === 'object') return Object.keys(value).length;
        return 0;
      },
      join: (value: any[], separator: string = ', ') => {
        return Array.isArray(value) ? value.join(separator) : String(value);
      },

      // Date filters
      date: (value: Date | string, format: string = 'YYYY-MM-DD') => {
        return this.helpers.formatDate(value, format);
      },
    };
  }

  /**
   * Translate a key using i18n configuration
   */
  private translate(key: string, locale?: string): string {
    if (!this.i18nConfig?.translations) return key;

    const targetLocale = locale || this.i18nConfig.locale || this.i18nConfig.defaultLocale || 'en';
    const translation = this.i18nConfig.translations[targetLocale]?.[key];
    
    if (translation) return translation;

    // Fallback to default locale
    if (this.i18nConfig.fallback) {
      const fallbackTranslation = this.i18nConfig.translations[this.i18nConfig.fallback]?.[key];
      if (fallbackTranslation) return fallbackTranslation;
    }

    return key;
  }

  /**
   * Translate plural forms
   */
  private translatePlural(key: string, count: number, locale?: string): string {
    const pluralKey = count === 1 ? key : `${key}_plural`;
    return this.translate(pluralKey, locale);
  }
}
