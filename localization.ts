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
            title: 'Welcome to Pulse CRM',
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
            showAll: 'Show all {n}', showLess: 'Show less', complete: 'Done', snooze: 'Snooze 1 day', defaultAction: 'Follow up with {name}', log: 'Log', open: 'Open', setAction: 'Set action',
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
                quota_exceeded: 'You have reached today\'s AI usage limit. It resets tomorrow.',
                unauthorized: 'Your session has expired. Please sign in again.',
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
        bulk: { selectOne: 'Select {name}', selected: '{n} selected', setStatus: 'Set status...', followUp: 'Follow up in 3 days', clear: 'Clear', selectAll: 'Select all', delete: 'Delete', confirmDelete: 'Delete {n} customers? This cannot be undone.' },
        data: {
            menu: 'Data', exportJson: 'Export backup (JSON)', exportCsv: 'Export to Excel (CSV)', importJson: 'Import backup (JSON)', resetDemo: 'Reset to demo data',
            importOk: 'Imported {n} customers.', importFail: 'This file is not a valid backup.', confirmImport: 'Replace all current data with {n} customers from the file?', confirmReset: 'Replace all current data with the demo data?',
            saveFailed: 'Could not save to this browser. Export a backup to avoid losing changes.',
        },
        shortcuts: { title: 'Keyboard shortcuts', palette: 'Command palette', newCustomer: 'New customer', search: 'Search', goToday: 'Today', goManage: 'Management', goDashboard: 'Dashboard', logFocus: 'Log interaction', help: 'Show shortcuts', close: 'Close dialog' },
        undo: 'Undo', deleted: 'Customer deleted.', deleteCustomer: 'Delete customer', confirmDeleteOne: 'Delete {name}? This cannot be undone.',
        lastContactAgo: '{n}d ago',
        dash: {
            weightedForecast: 'Weighted Forecast', weightedForecastDesc: 'Open pipeline × stage win probability.',
            winRate: 'Win Rate', winRateDesc: 'Won ÷ (won + lost).', wonValue: 'Won Revenue', wonValueDesc: 'Total value of won deals.',
            conversion: 'Stage Conversion', avgDays: 'Avg. days in stage', activity: 'Weekly Activity (last 8 weeks)',
            closedReasons: 'Win / Loss Reasons', noReasons: 'No reasons recorded yet.', aiAnalyze: 'AI: find patterns', analyzing: 'Analyzing...', noData: 'Not enough data',
        },

        auth: {
            title: 'Sign in to your CRM', subtitle: 'Your customers are private to your account.',
            google: 'Continue with Google', googleHint: 'Recommended: also connects Gmail so emails can be synced and sent from here.',
            or: 'or use email', email: 'Email', password: 'Password (min. 6 characters)', signIn: 'Sign in', signUp: 'Create account',
            toSignUp: 'No account yet? Create one', toSignIn: 'Already have an account? Sign in',
            checkEmail: 'Check your inbox to confirm your email, then sign in.', loading: 'Loading...',
            errors: { invalid: 'Incorrect email or password.', generic: 'Sign-in failed. Please try again.' },
        },
        settings: { menu: 'Menu', language: 'Language', theme: 'Dark mode', account: 'Account', signOut: 'Sign out', localMode: 'Local mode (this browser only)' },
        sync: { saving: 'Saving...', saved: 'Saved', error: 'Not saved', retry: 'Retry', loading: 'Loading...', local: 'Saved in this browser' },
        migrate: { found: 'Found {n} customers saved in this browser from before you signed in.', import: 'Upload to my account', dismiss: 'Ignore', done: 'Uploaded {n} customers.' },
        emptyCloud: { demo: 'Load demo data' },
        confirm: { ok: 'Confirm', cancel: 'Cancel', title: 'Please confirm' },
        gmail: {
            title: 'Gmail', connect: 'Connect Gmail', connectHint: 'Connect Gmail to see and log emails with this customer and send AI drafts directly.',
            connected: 'Connected as {email}', disconnect: 'Disconnect Gmail', noEmail: 'Add an email address to this customer to see Gmail history.',
            none: 'No emails with this customer yet.', refresh: 'Refresh', log: 'Log', logged: 'Logged', aiLog: 'AI summarize & log', logAll: 'Log all new ({n})',
            inbound: 'Received', outbound: 'Sent', loggedToast: 'Email logged.', loggedAllToast: 'Logged {n} emails.',
            send: 'Send with Gmail', sending: 'Sending...', sentToast: 'Email sent and logged.', to: 'To', subject: 'Subject', body: 'Message',
            sendTitle: 'Review & send', reauth: 'Gmail access expired. Please reconnect.', error: 'Could not reach Gmail. Please retry.',
            fromInbox: 'Pick from recent Gmail', inboxEmpty: 'No recent emails found.', loadingInbox: 'Loading recent emails...',
            sentPrefix: 'Sent: ', receivedPrefix: 'Received: ',
        },
        detailsMore: 'More details (contacts, pain points, competitors)',
        dates: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', inDays: 'in {n} days', daysAgo: '{n} days ago' },
        moveTo: 'Move to...',

        shell: {
            search: 'Search or jump to...', newCustomer: 'New customer', quick: 'Quick actions', pages: 'Pages', customers: 'Customers', actions: 'Actions',
            noResults: 'No results', toggleTheme: 'Toggle dark mode', toggleLanguage: 'Switch language', collapse: 'Collapse sidebar',
            titles: { today: 'Today', management: 'Customers', dashboard: 'Dashboard' },
            overview: 'Overview', activity: 'Activity', recent: 'Recent activity', viewAll: 'View all',
        },
        sort: { label: 'Sort', count: '{n} customers', default: 'Default order', due: 'Next due date', value: 'Deal value (high→low)', lastContact: 'Least recently contacted', name: 'Name' },
        demo: { banner: 'You are viewing {n} demo customers. Clear them when you are ready to start with your own data.', clear: 'Clear demo data', keep: 'Keep for now', cleared: 'Removed {n} demo customers.', tag: 'Demo' },
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
            title: '歡迎使用 Pulse CRM',
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
            showAll: '顯示全部 {n} 筆', showLess: '收合', complete: '完成', snooze: '延後 1 天', defaultAction: '跟進 {name}', log: '記錄', open: '開啟', setAction: '設定行動',
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
                quota_exceeded: '已達今日 AI 使用上限，明天會自動重置。',
                unauthorized: '登入已過期，請重新登入。',
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
        bulk: { selectOne: '選取 {name}', selected: '已選 {n} 位', setStatus: '變更狀態...', followUp: '3 天後跟進', clear: '取消選取', selectAll: '全選', delete: '刪除', confirmDelete: '確定刪除 {n} 位客戶？此動作無法復原。' },
        data: {
            menu: '資料', exportJson: '匯出備份 (JSON)', exportCsv: '匯出 Excel (CSV)', importJson: '匯入備份 (JSON)', resetDemo: '重設為示範資料',
            importOk: '已匯入 {n} 位客戶。', importFail: '檔案不是有效的備份。', confirmImport: '要以檔案中的 {n} 位客戶取代目前所有資料嗎？', confirmReset: '要以示範資料取代目前所有資料嗎？',
            saveFailed: '無法儲存到此瀏覽器，請先匯出備份以免遺失資料。',
        },
        shortcuts: { title: '鍵盤快捷鍵', palette: '指令面板', newCustomer: '新增客戶', search: '搜尋', goToday: '今日工作', goManage: '客戶管理', goDashboard: '儀表板', logFocus: '記錄互動', help: '顯示快捷鍵', close: '關閉視窗' },
        undo: '復原', deleted: '已刪除客戶。', deleteCustomer: '刪除客戶', confirmDeleteOne: '確定刪除 {name}？此動作無法復原。',
        lastContactAgo: '{n} 天前',
        dash: {
            weightedForecast: '加權預測營收', weightedForecastDesc: '進行中金額 × 各階段成交機率。',
            winRate: '成交率', winRateDesc: '成交 ÷（成交 + 流失）。', wonValue: '已成交金額', wonValueDesc: '所有成交案件的金額總和。',
            conversion: '階段轉換率', avgDays: '平均停留天數', activity: '每週活動量（近 8 週）',
            closedReasons: '成交 / 流失原因', noReasons: '尚未記錄任何原因。', aiAnalyze: 'AI 找出規律', analyzing: '分析中...', noData: '資料不足',
        },

        auth: {
            title: '登入您的客戶管理系統', subtitle: '您的客戶資料只有您自己看得到。',
            google: '使用 Google 登入', googleHint: '建議使用：同時連結 Gmail，即可在系統內同步與寄送郵件。',
            or: '或使用 Email', email: 'Email', password: '密碼（至少 6 個字元）', signIn: '登入', signUp: '建立帳號',
            toSignUp: '還沒有帳號？立即建立', toSignIn: '已有帳號？前往登入',
            checkEmail: '請到信箱點擊確認連結，再回來登入。', loading: '載入中...',
            errors: { invalid: 'Email 或密碼錯誤。', generic: '登入失敗，請再試一次。' },
        },
        settings: { menu: '選單', language: '語言', theme: '深色模式', account: '帳號', signOut: '登出', localMode: '本機模式（僅存在此瀏覽器）' },
        sync: { saving: '儲存中...', saved: '已儲存', error: '尚未儲存', retry: '重試', loading: '載入中...', local: '已存在此瀏覽器' },
        migrate: { found: '發現登入前存在此瀏覽器的 {n} 位客戶。', import: '上傳到我的帳號', dismiss: '忽略', done: '已上傳 {n} 位客戶。' },
        emptyCloud: { demo: '載入示範資料' },
        confirm: { ok: '確定', cancel: '取消', title: '請確認' },
        gmail: {
            title: 'Gmail', connect: '連結 Gmail', connectHint: '連結 Gmail 後，可查看並記錄與此客戶的往來郵件，AI 草稿也能直接寄出。',
            connected: '已連結 {email}', disconnect: '中斷 Gmail 連結', noEmail: '請先為此客戶填寫 Email，才能顯示 Gmail 往來記錄。',
            none: '目前沒有與此客戶的往來郵件。', refresh: '重新整理', log: '記錄', logged: '已記錄', aiLog: 'AI 摘要並記錄', logAll: '記錄全部新郵件（{n}）',
            inbound: '收到', outbound: '寄出', loggedToast: '已記錄郵件。', loggedAllToast: '已記錄 {n} 封郵件。',
            send: '用 Gmail 寄出', sending: '寄送中...', sentToast: '郵件已寄出並記錄。', to: '收件者', subject: '主旨', body: '內容',
            sendTitle: '確認後寄出', reauth: 'Gmail 授權已失效，請重新連結。', error: '無法連線到 Gmail，請重試。',
            fromInbox: '從最近的 Gmail 選擇', inboxEmpty: '沒有找到最近的郵件。', loadingInbox: '載入最近郵件中...',
            sentPrefix: '寄出：', receivedPrefix: '收到：',
        },
        detailsMore: '更多資料（聯絡人、痛點、競爭對手）',
        dates: { today: '今天', tomorrow: '明天', yesterday: '昨天', inDays: '{n} 天後', daysAgo: '{n} 天前' },
        moveTo: '移動到...',

        shell: {
            search: '搜尋或跳轉...', newCustomer: '新增客戶', quick: '快速動作', pages: '頁面', customers: '客戶', actions: '動作',
            noResults: '沒有符合的結果', toggleTheme: '切換深色模式', toggleLanguage: '切換語言', collapse: '收合側邊欄',
            titles: { today: '今日工作台', management: '客戶', dashboard: '儀表板' },
            overview: '概覽', activity: '互動記錄', recent: '最近互動', viewAll: '查看全部',
        },
        sort: { label: '排序', count: '共 {n} 位', default: '預設順序', due: '下一步到期日', value: '交易金額（高→低）', lastContact: '最久未聯絡', name: '名稱' },
        demo: { banner: '目前包含 {n} 位示範客戶。準備好使用自己的資料時，可一鍵清除。', clear: '清除示範資料', keep: '先保留', cleared: '已移除 {n} 位示範客戶。', tag: '示範' },
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
