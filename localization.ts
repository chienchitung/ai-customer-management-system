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

        today: 'Today',
        interactionTypes: { Email: 'Email', Call: 'Call', Meeting: 'Meeting', Note: 'Note' },
        todayView: {
            title: 'Today',
            subtitle: 'Your prioritized follow-ups. Clear this list and the pipeline takes care of itself.',
            allClear: 'All caught up! No follow-ups need attention.',
            overdue: 'Overdue', dueToday: 'Due today', stale: 'Going cold', noNextAction: 'No next action', upcoming: 'Coming up',
            daysOverdue: '{n} days overdue', daysSince: 'No contact for {n} days', inDays: 'Due in {n} days',
            complete: 'Done', snooze: 'Snooze 1 day', defaultAction: 'Follow up with {name}', log: 'Log', open: 'Open', setAction: 'Set action',
            aiHint: 'AI tip', aiHintLoad: 'Get AI tips for the top 5',
            statOverdue: 'Overdue', statToday: 'Due today', statStale: 'Going cold', statForecast: 'Weighted forecast',
        },
        nextActionCard: { complete: 'Mark done', snooze: '+1 day', snoozeWeek: '+1 week', edit: 'Edit', overdueBy: 'Overdue by {n} days', dueTodayLabel: 'Due today' },
        completeAction: { title: 'Complete next action', logAs: 'Log it as an interaction', result: 'Result / notes', next: 'Next action (optional)', save: 'Complete' },
        logger: {
            organize: 'AI tidy up', organizing: 'Organizing...', dictate: 'Dictate', stopDictate: 'Stop',
            aiResult: 'AI suggestions', applySummary: 'Use this summary', applyNext: 'Set as next action', addPain: 'Add pain points', addComp: 'Add competitors', saveAll: 'Log & apply all',
            dictationUnsupported: 'Voice input is not supported in this browser.',
        },
        ai: {
            copy: 'Copy', copied: 'Copied', saveNote: 'Save as note', saved: 'Saved', setNext: 'Set as next action', openEmail: 'Open in email & log', retry: 'Retry', stop: 'Stop',
            errors: {
                rate_limited: 'The AI service is busy. Please retry in a moment.',
                missing_api_key: 'AI is not configured: set GEMINI_API_KEY on the server.',
                network: 'Network error. Check your connection and retry.',
                upstream_error: 'The AI service returned an error. Please retry.',
                bad_response: 'The AI returned an unexpected format. Please retry.',
            },
            nextStepTitle: 'Suggested next step', emailTitle: 'Email draft', subject: 'Subject', due: 'Due',
        },
        capture: {
            button: 'Smart capture', title: 'Create customer from text',
            help: 'Paste an email, signature, business card or meeting notes. AI will pre-fill the customer form for you to review.',
            placeholder: 'e.g. "Hi, I\'m Amy Lin, Procurement Manager at Acme Ltd (amy@acme.com). We are looking to replace our spreadsheet process..."',
            extract: 'Extract with AI', extracting: 'Extracting...',
        },
        closeReason: {
            wonTitle: 'Why did we win?', lostTitle: 'Why did we lose?', help: 'A short reason helps the team learn from each deal.',
            placeholder: 'e.g. price, missing feature, chose competitor X...', save: 'Save', skip: 'Skip',
            presets: { price: 'Price', features: 'Features', competitor: 'Competitor', timing: 'Timing / budget', relationship: 'Relationship' },
        },
        bulk: { selected: '{n} selected', setStatus: 'Set status...', followUp: 'Follow up in 3 days', clear: 'Clear', selectAll: 'Select all', delete: 'Delete', confirmDelete: 'Delete {n} customers? This cannot be undone.' },
        data: {
            menu: 'Data', exportJson: 'Export backup (JSON)', exportCsv: 'Export to Excel (CSV)', importJson: 'Import backup (JSON)', resetDemo: 'Reset to demo data',
            importOk: 'Imported {n} customers.', importFail: 'This file is not a valid backup.', confirmImport: 'Replace all current data with {n} customers from the file?', confirmReset: 'Replace all current data with the demo data?',
            saveFailed: 'Could not save to this browser. Export a backup to avoid losing changes.',
        },
        shortcuts: { title: 'Keyboard shortcuts', newCustomer: 'New customer', search: 'Search', goToday: 'Today', goManage: 'Management', goDashboard: 'Dashboard', logFocus: 'Log interaction', help: 'Show shortcuts', close: 'Close dialog' },
        undo: 'Undo', deleted: 'Customer deleted.', deleteCustomer: 'Delete customer', confirmDeleteOne: 'Delete {name}? This cannot be undone.',
        lastContactAgo: '{n}d ago',
        dash: {
            weightedForecast: 'Weighted Forecast', weightedForecastDesc: 'Open pipeline × stage win probability.',
            winRate: 'Win Rate', winRateDesc: 'Won ÷ (won + lost).', wonValue: 'Won Revenue', wonValueDesc: 'Total value of won deals.',
            conversion: 'Stage Conversion', avgDays: 'Avg. days in stage', activity: 'Weekly Activity (last 8 weeks)',
            closedReasons: 'Win / Loss Reasons', noReasons: 'No reasons recorded yet.', aiAnalyze: 'AI: find patterns', analyzing: 'Analyzing...', noData: 'Not enough data',
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

        today: '今日工作',
        interactionTypes: { Email: '郵件', Call: '電話', Meeting: '會議', Note: '備註' },
        todayView: {
            title: '今日工作台',
            subtitle: '依緊急程度與金額排序的待辦跟進。清空這份清單，業績自然推進。',
            allClear: '太好了！目前沒有需要處理的跟進。',
            overdue: '已逾期', dueToday: '今天到期', stale: '客戶變冷', noNextAction: '未設下一步', upcoming: '即將到期',
            daysOverdue: '逾期 {n} 天', daysSince: '已 {n} 天未聯絡', inDays: '{n} 天後到期',
            complete: '完成', snooze: '延後 1 天', defaultAction: '跟進 {name}', log: '記錄', open: '開啟', setAction: '設定行動',
            aiHint: 'AI 建議', aiHintLoad: '為前 5 位取得 AI 建議',
            statOverdue: '已逾期', statToday: '今天到期', statStale: '客戶變冷', statForecast: '加權預測',
        },
        nextActionCard: { complete: '標記完成', snooze: '+1 天', snoozeWeek: '+1 週', edit: '編輯', overdueBy: '已逾期 {n} 天', dueTodayLabel: '今天到期' },
        completeAction: { title: '完成下一步行動', logAs: '同時記錄為一筆互動', result: '結果 / 備註', next: '下一步行動（選填）', save: '完成' },
        logger: {
            organize: 'AI 整理', organizing: '整理中...', dictate: '語音輸入', stopDictate: '停止',
            aiResult: 'AI 建議', applySummary: '使用此摘要', applyNext: '設為下一步行動', addPain: '加入痛點', addComp: '加入競爭對手', saveAll: '記錄並全部套用',
            dictationUnsupported: '此瀏覽器不支援語音輸入。',
        },
        ai: {
            copy: '複製', copied: '已複製', saveNote: '存成備註', saved: '已儲存', setNext: '設為下一步行動', openEmail: '開啟郵件並記錄', retry: '重試', stop: '停止',
            errors: {
                rate_limited: 'AI 服務忙碌中，請稍後重試。',
                missing_api_key: '尚未設定 AI：請在伺服器設定 GEMINI_API_KEY。',
                network: '網路錯誤，請檢查連線後重試。',
                upstream_error: 'AI 服務發生錯誤，請重試。',
                bad_response: 'AI 回傳格式異常，請重試。',
            },
            nextStepTitle: '建議的下一步', emailTitle: '郵件草稿', subject: '主旨', due: '期限',
        },
        capture: {
            button: '智慧建檔', title: '從文字建立客戶',
            help: '貼上郵件、簽名檔、名片文字或會議筆記，AI 會自動預填客戶表單，確認後即可儲存。',
            placeholder: '例如：「您好，我是 Acme 公司採購經理林小美 (amy@acme.com)，我們想汰換目前用 Excel 管理的流程……」',
            extract: 'AI 擷取', extracting: '擷取中...',
        },
        closeReason: {
            wonTitle: '這筆為什麼贏？', lostTitle: '這筆為什麼輸？', help: '簡短記錄原因，團隊才能從每筆交易中學習。',
            placeholder: '例如：價格、缺少功能、選擇了競爭對手 X……', save: '儲存', skip: '略過',
            presets: { price: '價格', features: '功能', competitor: '競爭對手', timing: '時機 / 預算', relationship: '關係經營' },
        },
        bulk: { selected: '已選 {n} 位', setStatus: '變更狀態...', followUp: '3 天後跟進', clear: '取消選取', selectAll: '全選', delete: '刪除', confirmDelete: '確定刪除 {n} 位客戶？此動作無法復原。' },
        data: {
            menu: '資料', exportJson: '匯出備份 (JSON)', exportCsv: '匯出 Excel (CSV)', importJson: '匯入備份 (JSON)', resetDemo: '重設為示範資料',
            importOk: '已匯入 {n} 位客戶。', importFail: '檔案不是有效的備份。', confirmImport: '要以檔案中的 {n} 位客戶取代目前所有資料嗎？', confirmReset: '要以示範資料取代目前所有資料嗎？',
            saveFailed: '無法儲存到此瀏覽器，請先匯出備份以免遺失資料。',
        },
        shortcuts: { title: '鍵盤快捷鍵', newCustomer: '新增客戶', search: '搜尋', goToday: '今日工作', goManage: '客戶管理', goDashboard: '儀表板', logFocus: '記錄互動', help: '顯示快捷鍵', close: '關閉視窗' },
        undo: '復原', deleted: '已刪除客戶。', deleteCustomer: '刪除客戶', confirmDeleteOne: '確定刪除 {name}？此動作無法復原。',
        lastContactAgo: '{n} 天前',
        dash: {
            weightedForecast: '加權預測營收', weightedForecastDesc: '進行中金額 × 各階段成交機率。',
            winRate: '成交率', winRateDesc: '成交 ÷（成交 + 流失）。', wonValue: '已成交金額', wonValueDesc: '所有成交案件的金額總和。',
            conversion: '階段轉換率', avgDays: '平均停留天數', activity: '每週活動量（近 8 週）',
            closedReasons: '成交 / 流失原因', noReasons: '尚未記錄任何原因。', aiAnalyze: 'AI 找出規律', analyzing: '分析中...', noData: '資料不足',
        },
        // Statuses
        statuses: {
            [CustomerStatus.LEAD]: '銷售線索',
            [CustomerStatus.PROSPECT]: '潛在客戶',
            [CustomerStatus.NEGOTIATION]: '談判中',
            [CustomerStatus.CLOSED_WON]: '已成交',
            [CustomerStatus.CLOSED_LOST]: '已流失',
        }
    },
};

type Language = 'en' | 'zh';

/** Translates a key and fills {placeholders} from vars. */
export const tf = (key: string, lang: Language, vars: Record<string, string | number>): string =>
    t(key, lang).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

export const translateInteractionType = (type: string, lang: Language): string => t(`interactionTypes.${type}`, lang);

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