import { CustomerStatus, AISuggestionType } from "./types";

// Type definition for the nested translation object.
type Translations = {
  [key: string]: string | Translations;
};

// Centralized object for all UI strings in both languages.
const translations: { en: Translations, zh: Translations } = {
  en: {
    management: "Management",
    dashboard: "Dashboard",
    customerPipeline: "Customer Pipeline",
    allCustomers: "All Customers",
    addNewCustomer: "Add New Customer",
    selectCustomerPrompt: "Select a customer to view details",
    or: "or",
    interactionHistory: "Interaction History",
    noInteractions: "No interactions have been logged yet.",
    logNewInteraction: "Log New Interaction",
    logInteractionPlaceholder: "Add a note, email summary, or call log...",
    logInteraction: "Log Interaction",
    analyzing: "Analyzing...",
    dealValue: "Estimated Deal Value ($)",
    knownCompetitors: "Known Competitors",
    customerPainPoints: "Customer Pain Points",
    keyContacts: "Key Contacts",
    nextAction: "Next Action",
    modalTitle: "Add New Customer",
    fullName: "Full Name",
    company: "Company",
    emailAddress: "Email Address",
    cancel: "Cancel",
    addCustomer: "Add Customer",
    aiAssistant: "AI Assistant",
    aiAssistantPrompt: "Click a button to get AI-powered insights for",
    performanceDashboard: "Performance Dashboard",
    totalCustomers: "Total Customers",
    totalCustomersDesc: "Total number of leads and customers in the system.",
    pipelineValue: "Pipeline Value",
    pipelineValueDesc: "Estimated value of all open deals (Lead, Prospect, Negotiation).",
    avgDealValue: "Average Deal Value",
    avgDealValueDesc: "Average value across all customers with a deal value.",
    salesFunnel: "Sales Funnel",
    buttons: {
      listView: "List View",
      kanbanView: "Kanban View",
      toggleTheme: "Toggle Theme",
      toggleLanguage: "Switch Language",
    },
    ai: {
        [AISuggestionType.NEXT_STEP]: 'Suggest Next Step',
        [AISuggestionType.SUMMARY]: 'Summarize',
        [AISuggestionType.DRAFT_EMAIL]: 'Draft Email',
        [AISuggestionType.MEETING_BRIEF]: 'Meeting Brief',
    }
  },
  zh: {
    management: "客戶管理",
    dashboard: "儀表板",
    customerPipeline: "客戶流程",
    allCustomers: "所有客戶",
    addNewCustomer: "新增客戶",
    selectCustomerPrompt: "選擇一位客戶以查看詳細資訊",
    or: "或",
    interactionHistory: "互動歷史",
    noInteractions: "尚未記錄任何互動。",
    logNewInteraction: "記錄新互動",
    logInteractionPlaceholder: "新增筆記、郵件摘要或通話記錄...",
    logInteraction: "記錄互動",
    analyzing: "分析中...",
    dealValue: "預估交易金額 ($)",
    knownCompetitors: "已知競爭對手",
    customerPainPoints: "客戶痛點",
    keyContacts: "關鍵聯絡人",
    nextAction: "下一步行動",
    modalTitle: "新增客戶",
    fullName: "全名",
    company: "公司",
    emailAddress: "電子郵件地址",
    cancel: "取消",
    addCustomer: "新增客戶",
    aiAssistant: "AI 助理",
    aiAssistantPrompt: "點擊上方按鈕以獲取關於 ... 的 AI 洞察",
    performanceDashboard: "績效儀表板",
    totalCustomers: "總客戶數",
    totalCustomersDesc: "系統中所有潛在客戶和正式客戶的總數。",
    pipelineValue: "流程總價值",
    pipelineValueDesc: "所有進行中交易（潛在、待開發、談判中）的預估價值。",
    avgDealValue: "平均交易價值",
    avgDealValueDesc: "所有已設定交易價值客戶的平均價值。",
    salesFunnel: "銷售漏斗",
    buttons: {
      listView: "列表視圖",
      kanbanView: "看板視圖",
      toggleTheme: "切換主題",
      toggleLanguage: "切換語言",
    },
    ai: {
        [AISuggestionType.NEXT_STEP]: '建議下一步',
        [AISuggestionType.SUMMARY]: '總結關係',
        [AISuggestionType.DRAFT_EMAIL]: '草擬郵件',
        [AISuggestionType.MEETING_BRIEF]: '會議簡報',
    }
  },
};

// Mapping for customer status enum.
const statusTranslations: { [lang in 'en' | 'zh']: { [key in CustomerStatus]: string } } = {
    en: {
        [CustomerStatus.LEAD]: 'Lead',
        [CustomerStatus.PROSPECT]: 'Prospect',
        [CustomerStatus.NEGOTIATION]: 'Negotiation',
        [CustomerStatus.CLOSED_WON]: 'Closed (Won)',
        [CustomerStatus.CLOSED_LOST]: 'Closed (Lost)',
    },
    zh: {
        [CustomerStatus.LEAD]: '潛在客戶',
        [CustomerStatus.PROSPECT]: '待開發客戶',
        [CustomerStatus.NEGOTIATION]: '談判中',
        [CustomerStatus.CLOSED_WON]: '已成交',
        [CustomerStatus.CLOSED_LOST]: '未成交',
    }
};

/**
 * Gets a translated string for a given key and language.
 * Supports nested keys using dot notation e.g., 'buttons.listView'.
 * @param key The key of the string to retrieve.
 * @param lang The current language ('en' or 'zh').
 * @returns The translated string.
 */
export const t = (key: string, lang: 'en' | 'zh'): string => {
  const keys = key.split('.');
  let result: any = translations[lang];
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) {
      // Fallback to English if translation is missing
      result = translations['en'];
      for (const fk of keys) {
          result = result?.[fk];
      }
      return result || key;
    }
  }
  return result || key;
};

/**
 * Translates a CustomerStatus enum value.
 * @param status The status enum to translate.
 * @param lang The current language.
 * @returns The translated status string.
 */
export const translateStatus = (status: CustomerStatus, lang: 'en' | 'zh'): string => {
    return statusTranslations[lang][status] || status;
};