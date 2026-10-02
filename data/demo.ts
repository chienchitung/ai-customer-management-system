import { Customer, CustomerStatus, InteractionType } from '../types';
import { addDays, todayISO } from '../lib/dates';

// Demo data with dates relative to today so the Today workbench always has realistic content.
export const createDemoCustomers = (language: 'en' | 'zh' = 'zh'): Customer[] => {
  const d = (offset: number) => addDays(todayISO(), offset);
  const L = (en: string, zh: string) => (language === 'zh' ? zh : en);
  return [
    {
      id: 'demo-1', name: 'Eleanor Vance', company: 'Innovate Corp', email: 'eleanor.v@innovate.com',
      status: CustomerStatus.PROSPECT, lastContact: d(-6), dealValue: 75000, createdAt: d(-30),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-30) }, { status: CustomerStatus.PROSPECT, date: d(-11) }],
      customerPainPoints: [L('Manual data entry is time-consuming', '手動輸入資料非常耗時'), L('Lack of integration with existing tools', '無法與現有工具整合')],
      competitors: ['OldGuard Solutions'],
      keyContacts: [{ id: 'kc-1', name: 'David Chen', title: 'CTO' }],
      nextAction: { description: L('Send over technical whitepaper for AI integration.', '寄送 AI 整合技術白皮書'), dueDate: d(-2) },
      interactions: [
        { id: 'int1_1', type: InteractionType.EMAIL, date: d(-6), summary: L('Sent follow-up email about the proposal.', '寄出提案的後續追蹤郵件。') },
        { id: 'int1_2', type: InteractionType.CALL, date: d(-11), summary: L('Initial discovery call. Client showed strong interest in AI integration features and is excited about the potential.', '初次需求訪談。客戶對 AI 整合功能非常有興趣，也很期待導入效益。') },
      ],
    },
    {
      id: 'demo-2', name: 'Marcus Holloway', company: 'Cyber Solutions', email: 'marcus.h@cybersolutions.net',
      status: CustomerStatus.NEGOTIATION, lastContact: d(-4), dealValue: 120000, createdAt: d(-45),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-45) }, { status: CustomerStatus.PROSPECT, date: d(-30) }, { status: CustomerStatus.NEGOTIATION, date: d(-8) }],
      customerPainPoints: [L('Security compliance concerns', '擔心資安合規'), L('High cost of current provider', '現有供應商費用過高')],
      keyContacts: [{ id: 'kc-2', name: 'Sarah Jenkins', title: L('Head of Security', '資安主管') }, { id: 'kc-3', name: 'Tom Riley', title: L('IT Director', 'IT 總監') }],
      competitors: ['Legacy Systems Inc.', 'SecureNet'],
      nextAction: { description: L('Send revised implementation timeline and security compliance docs.', '寄送修訂後的導入時程與資安合規文件'), dueDate: d(0) },
      interactions: [
        { id: 'int2_1', type: InteractionType.MEETING, date: d(-4), summary: L('Demo of the premium tier. They raised some concerns about the implementation timeline but were impressed with the features.', '展示進階方案。客戶對導入時程有些疑慮，但對功能印象深刻。') },
        { id: 'int2_2', type: InteractionType.EMAIL, date: d(-8), summary: L('Confirmed meeting and sent agenda.', '確認會議並寄出議程。') },
      ],
    },
    {
      id: 'demo-3', name: 'Chloe Decker', company: 'Logistics Prime', email: 'chloe.d@logiprime.com',
      status: CustomerStatus.LEAD, lastContact: d(-1), dealValue: 45000, createdAt: d(-1),
      interactions: [
        { id: 'int3_1', type: InteractionType.NOTE, date: d(-1), summary: L('New lead from marketing webinar. Downloaded our e-book on supply chain optimization.', '行銷線上研討會帶來的新名單，下載了供應鏈優化電子書。') },
      ],
    },
    {
      id: 'demo-4', name: 'Aidan Gallagher', company: 'Quantum Dynamics', email: 'aidan.g@quantum.dev',
      status: CustomerStatus.CLOSED_WON, lastContact: d(-20), dealValue: 95000, createdAt: d(-70),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-70) }, { status: CustomerStatus.PROSPECT, date: d(-55) }, { status: CustomerStatus.NEGOTIATION, date: d(-35) }, { status: CustomerStatus.CLOSED_WON, date: d(-20) }],
      closedReason: L('Superior feature set compared to competitors.', '功能完整度勝過競爭對手'),
      interactions: [
        { id: 'int4_1', type: InteractionType.EMAIL, date: d(-20), summary: L('Contract signed. Onboarding scheduled.', '合約已簽署，已安排導入啟動會議。') },
      ],
    },
    {
      id: 'demo-5', name: 'Javier Castillo', company: 'HealthBridge', email: 'javier.c@healthbridge.io',
      status: CustomerStatus.LEAD, lastContact: d(-18), dealValue: 60000, createdAt: d(-18),
      interactions: [],
    },
    {
      id: 'demo-6', name: 'Isabelle Rossi', company: 'Fintech United', email: 'isabelle.r@finu.com',
      status: CustomerStatus.PROSPECT, lastContact: d(-9), dealValue: 85000, createdAt: d(-25),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-25) }, { status: CustomerStatus.PROSPECT, date: d(-9) }],
      nextAction: { description: L('Share customer case study from a similar fintech client.', '分享同產業金融科技客戶的成功案例'), dueDate: d(3) },
      interactions: [
        { id: 'int6_1', type: InteractionType.CALL, date: d(-9), summary: L('Good conversation, they are evaluating options and we are on the shortlist.', '溝通順利，對方正在評估方案，我們已進入決選名單。') },
      ],
    },
    {
      id: 'demo-7', name: 'Kenji Tanaka', company: 'AutoDrive Inc.', email: 'kenji.t@autodrive.com',
      status: CustomerStatus.CLOSED_LOST, lastContact: d(-15), dealValue: 110000, createdAt: d(-60),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-60) }, { status: CustomerStatus.PROSPECT, date: d(-40) }, { status: CustomerStatus.CLOSED_LOST, date: d(-15) }],
      closedReason: L('Decided to stay with their current provider due to budget constraints.', '因預算限制，決定繼續使用現有供應商'),
      interactions: [
        { id: 'int7_1', type: InteractionType.EMAIL, date: d(-15), summary: L('Received email informing us they will not be moving forward at this time.', '收到來信，對方表示目前暫不推進。') },
      ],
    },
  ];
};

/** Demo customers all use ids starting with "demo-". */
export const isDemoCustomer = (c: Customer) => c.id.startsWith('demo-');
