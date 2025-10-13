import { CustomerStatus, AISuggestionType } from './types';

const translations = {
    en: {
        management: 'Management',
        dashboard: 'Dashboard',
        searchCustomer: 'Search customer...',
        allCustomers: 'All Customers',
        buttons: {
            toggleLanguage: 'Toggle Language',
            toggleTheme: 'Toggle Theme',
            listView: 'List View',
            kanbanView: 'Kanban View',
            toggleAI: 'Toggle AI Assistant',
        },
        langName: 'EN',
        addNewCustomer: 'Add New Customer',
        editCustomer: 'Edit Customer',
        selectCustomerPrompt: 'Select a customer to view their details.',
        or: 'or',
        interactionHistory: 'Interaction History',
        table: {
            date: 'Date',
            type: 'Type',
            summary: 'Summary',
            sentiment: 'Sentiment',
        },
        filters: {
            type: 'Filter by type',
            all: 'All Types',
            dateRange: 'Filter by date range',
            from: 'From',
            to: 'To',
            advancedFilters: 'Advanced Filters',
            status: 'Status',
            allStatuses: 'All Statuses',
            lastContact: 'Last Contact',
            dealValue: 'Deal Value',
            min: 'Min',
            max: 'Max',
            clear: 'Clear Filters',
        },
        noInteractions: 'No interactions found for the selected criteria.',
        logNewInteraction: 'Log New Interaction',
        logInteractionPlaceholder: 'Enter a summary of the interaction...',
        analyzing: 'Analyzing...',
        logInteraction: 'Log Interaction',
        welcome: {
            title: 'Welcome to AI Customer Management System',
            message: 'Get started by adding your first customer. This dashboard will help you manage relationships, track progress, and get AI-powered insights to close deals faster.',
            cta: 'Add Your First Customer',
        },
        modal: {
            addTitle: 'Add New Customer',
            editTitle: 'Edit Customer',
            primaryInfo: 'Primary Information',
            fullName: 'Full Name',
            company: 'Company',
            emailAddress: 'Email Address',
            dealValue: 'Deal Value ($)',
            dealValuePlaceholder: 'e.g., 50000',
            nextActionDesc: 'Next Action Description',
            nextActionDueDate: 'Due Date',
            addContact: 'Add Contact',
            contactName: 'Contact Name',
            contactTitle: 'Contact Title',
            addPainPoint: 'Add Pain Point',
            addCompetitor: 'Add Competitor',
            remove: 'Remove',
            cancel: 'Cancel',
            addCustomer: 'Add Customer',
            saveChanges: 'Save Changes',
        },
        performanceDashboard: 'Performance Dashboard',
        totalCustomers: 'Total Customers',
        totalCustomersDesc: 'All customers in the system.',
        pipelineValue: 'Total Pipeline Value',
        pipelineValueDesc: 'Sum of deal values for all open deals.',
        avgDealValue: 'Average Deal Value',
        avgDealValueDesc: 'Average value across all deals.',
        salesFunnel: 'Sales Funnel',
        nextAction: 'Next Action',
        dueDate: 'Due Date',
        noNextAction: 'No next action set.',
        keyContacts: 'Key Contacts',
        noContacts: 'No key contacts added.',
        dealValue: 'Deal Value',
        knownCompetitors: 'Known Competitors',
        customerPainPoints: 'Customer Pain Points',
        notAvailable: 'N/A',
        quickLog: {
            followUp: 'Sent follow-up',
            voicemail: 'Left a voicemail',
            meetingScheduled: 'Scheduled meeting',
        },
        // AI Assistant
        aiAssistant: 'AI Assistant',
        aiAssistantDescription: 'Get AI-powered insights and suggestions for this customer.',
        askAQuestion: 'Ask a question...',
        suggestionType: 'What do you need help with?',
        getSuggestion: 'Get Suggestion',
        generating: 'Generating...',
        copyToClipboard: 'Copy',
        copied: 'Copied!',
        aiSuggestions: {
            [AISuggestionType.NEXT_STEP]: 'Suggest Next Step',
            [AISuggestionType.SUMMARY]: 'Summarize Relationship',
            [AISuggestionType.DRAFT_EMAIL]: 'Draft Follow-up Email',
            [AISuggestionType.MEETING_BRIEF]: 'Generate Pre-Meeting Briefing',
        },
        // Statuses
        statuses: {
            [CustomerStatus.LEAD]: 'Lead',
            [CustomerStatus.PROSPECT]: 'Prospect',
            [CustomerStatus.NEGOTIATION]: 'Negotiation',
            [CustomerStatus.CLOSED_WON]: 'Closed (Won)',
            [CustomerStatus.CLOSED_LOST]: 'Closed (Lost)',
        }
    },
    zh: {
        management: '客戶管理',
        dashboard: '儀表板',
        searchCustomer: '搜尋客戶...',
        allCustomers: '所有客戶',
        buttons: {
            toggleLanguage: '切換語言',
            toggleTheme: '切換主題',
            listView: '列表視圖',
            kanbanView: '看板視圖',
            toggleAI: '切換 AI 助理',
        },
        langName: '中文',
        addNewCustomer: '新增客戶',
        editCustomer: '編輯客戶',
        selectCustomerPrompt: '選擇一位客戶以查看其詳細資訊。',
        or: '或',
        interactionHistory: '互動記錄',
        table: {
            date: '日期',
            type: '類型',
            summary: '摘要',
            sentiment: '情緒分析',
        },
        filters: {
            type: '按類型篩選',
            all: '所有類型',
            dateRange: '按日期範圍篩選',
            from: '從',
            to: '到',
            advancedFilters: '進階篩選',
            status: '狀態',
            allStatuses: '所有狀態',
            lastContact: '上次聯絡',
            dealValue: '交易價值',
            min: '最小',
            max: '最大',
            clear: '清除篩選',
        },
        noInteractions: '找不到符合條件的互動記錄。',
        logNewInteraction: '記錄新的互動',
        logInteractionPlaceholder: '輸入互動摘要...',
        analyzing: '分析中...',
        logInteraction: '記錄互動',
        welcome: {
            title: '歡迎使用 AI 客戶管理系統',
            message: '開始新增您的第一位客戶。此儀表板將幫助您管理客戶關係、追蹤進度，並獲得 AI 驅動的洞察以更快地完成交易。',
            cta: '新增您的第一位客戶',
        },
        modal: {
            addTitle: '新增客戶',
            editTitle: '編輯客戶',
            primaryInfo: '主要資訊',
            fullName: '全名',
            company: '公司',
            emailAddress: '電子郵件地址',
            dealValue: '交易價值 ($)',
            dealValuePlaceholder: '例如：50000',
            nextActionDesc: '下一步行動描述',
            nextActionDueDate: '截止日期',
            addContact: '新增聯絡人',
            contactName: '聯絡人姓名',
            contactTitle: '職位',
            addPainPoint: '新增痛點',
            addCompetitor: '新增競爭對手',
            remove: '移除',
            cancel: '取消',
            addCustomer: '新增客戶',
            saveChanges: '儲存變更',
        },
        performanceDashboard: '績效儀表板',
        totalCustomers: '總客戶數',
        totalCustomersDesc: '系統中的所有客戶。',
        pipelineValue: '總銷售管道價值',
        pipelineValueDesc: '所有進行中交易的交易價值總和。',
        avgDealValue: '平均交易價值',
        avgDealValueDesc: '所有交易的平均價值。',
        salesFunnel: '銷售漏斗',
        nextAction: '下一步行動',
        dueDate: '截止日期',
        noNextAction: '未設定下一步行動。',
        keyContacts: '主要聯絡人',
        noContacts: '尚未新增主要聯絡人。',
        dealValue: '交易價值',
        knownCompetitors: '已知競爭對手',
        customerPainPoints: '客戶痛點',
        notAvailable: '不適用',
        quickLog: {
            followUp: '寄出後續郵件',
            voicemail: '留了語音信箱',
            meetingScheduled: '已安排會議',
        },
        // AI Assistant
        aiAssistant: 'AI 助理',
        aiAssistantDescription: '獲取針對此客戶的 AI 洞察和建議。',
        askAQuestion: '在這裡提問...',
        suggestionType: '您需要什麼幫助？',
        getSuggestion: '獲取建議',
        generating: '生成中...',
        copyToClipboard: '複製',
        copied: '已複製！',
        aiSuggestions: {
            [AISuggestionType.NEXT_STEP]: '建議下一步',
            [AISuggestionType.SUMMARY]: '總結客戶關係',
            [AISuggestionType.DRAFT_EMAIL]: '草擬後續郵件',
            [AISuggestionType.MEETING_BRIEF]: '生成會前簡報',
        },
        // Statuses
        statuses: {
            [CustomerStatus.LEAD]: '潛在客戶',
            [CustomerStatus.PROSPECT]: '潛在顧客',
            [CustomerStatus.NEGOTIATION]: '談判中',
            [CustomerStatus.CLOSED_WON]: '已成交 (成功)',
            [CustomerStatus.CLOSED_LOST]: '已結案 (失敗)',
        }
    },
};

type Language = 'en' | 'zh';

export const t = (key: string, lang: Language): string => {
    const keys = key.split('.');
    let result: any = translations[lang] || translations.en;

    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = result[k];
        } else {
            // Fallback to English
            let fallbackResult: any = translations.en;
            for (const fk of keys) {
                if (fallbackResult && typeof fallbackResult === 'object' && fk in fallbackResult) {
                    fallbackResult = fallbackResult[fk];
                } else {
                    return key; // Key not found in either language
                }
            }
            return fallbackResult;
        }
    }

    return typeof result === 'string' ? result : key;
};

export const translateStatus = (status: CustomerStatus, lang: Language): string => {
    return translations[lang].statuses[status] || translations['en'].statuses[status];
};