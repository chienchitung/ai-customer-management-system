import { Customer, CustomerStatus, InteractionType } from '../types';
import { addDays, todayISO } from '../lib/dates';

// Demo data with dates relative to today so the Today workbench always has realistic content.
export const createDemoCustomers = (): Customer[] => {
  const d = (offset: number) => addDays(todayISO(), offset);
  return [
    {
      id: 'demo-1', name: 'Eleanor Vance', company: 'Innovate Corp', email: 'eleanor.v@innovate.com',
      status: CustomerStatus.PROSPECT, lastContact: d(-6), dealValue: 75000, createdAt: d(-30),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-30) }, { status: CustomerStatus.PROSPECT, date: d(-11) }],
      customerPainPoints: ['Manual data entry is time-consuming', 'Lack of integration with existing tools'],
      competitors: ['OldGuard Solutions'],
      keyContacts: [{ id: 'kc-1', name: 'David Chen', title: 'CTO' }],
      nextAction: { description: 'Send over technical whitepaper for AI integration.', dueDate: d(-2) },
      interactions: [
        { id: 'int1_1', type: InteractionType.EMAIL, date: d(-6), summary: 'Sent follow-up email about the proposal.' },
        { id: 'int1_2', type: InteractionType.CALL, date: d(-11), summary: 'Initial discovery call. Client showed strong interest in AI integration features and is excited about the potential.' },
      ],
    },
    {
      id: 'demo-2', name: 'Marcus Holloway', company: 'Cyber Solutions', email: 'marcus.h@cybersolutions.net',
      status: CustomerStatus.NEGOTIATION, lastContact: d(-4), dealValue: 120000, createdAt: d(-45),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-45) }, { status: CustomerStatus.PROSPECT, date: d(-30) }, { status: CustomerStatus.NEGOTIATION, date: d(-8) }],
      customerPainPoints: ['Security compliance concerns', 'High cost of current provider'],
      keyContacts: [{ id: 'kc-2', name: 'Sarah Jenkins', title: 'Head of Security' }, { id: 'kc-3', name: 'Tom Riley', title: 'IT Director' }],
      competitors: ['Legacy Systems Inc.', 'SecureNet'],
      nextAction: { description: 'Send revised implementation timeline and security compliance docs.', dueDate: d(0) },
      interactions: [
        { id: 'int2_1', type: InteractionType.MEETING, date: d(-4), summary: 'Demo of the premium tier. They raised some concerns about the implementation timeline but were impressed with the features.' },
        { id: 'int2_2', type: InteractionType.EMAIL, date: d(-8), summary: 'Confirmed meeting and sent agenda.' },
      ],
    },
    {
      id: 'demo-3', name: 'Chloe Decker', company: 'Logistics Prime', email: 'chloe.d@logiprime.com',
      status: CustomerStatus.LEAD, lastContact: d(-1), dealValue: 45000, createdAt: d(-1),
      interactions: [
        { id: 'int3_1', type: InteractionType.NOTE, date: d(-1), summary: 'New lead from marketing webinar. Downloaded our e-book on supply chain optimization.' },
      ],
    },
    {
      id: 'demo-4', name: 'Aidan Gallagher', company: 'Quantum Dynamics', email: 'aidan.g@quantum.dev',
      status: CustomerStatus.CLOSED_WON, lastContact: d(-20), dealValue: 95000, createdAt: d(-70),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-70) }, { status: CustomerStatus.PROSPECT, date: d(-55) }, { status: CustomerStatus.NEGOTIATION, date: d(-35) }, { status: CustomerStatus.CLOSED_WON, date: d(-20) }],
      closedReason: 'Superior feature set compared to competitors.',
      interactions: [
        { id: 'int4_1', type: InteractionType.EMAIL, date: d(-20), summary: 'Contract signed. Onboarding scheduled.' },
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
      nextAction: { description: 'Share customer case study from a similar fintech client.', dueDate: d(3) },
      interactions: [
        { id: 'int6_1', type: InteractionType.CALL, date: d(-9), summary: 'Good conversation, they are evaluating options and we are on the shortlist.' },
      ],
    },
    {
      id: 'demo-7', name: 'Kenji Tanaka', company: 'AutoDrive Inc.', email: 'kenji.t@autodrive.com',
      status: CustomerStatus.CLOSED_LOST, lastContact: d(-15), dealValue: 110000, createdAt: d(-60),
      statusHistory: [{ status: CustomerStatus.LEAD, date: d(-60) }, { status: CustomerStatus.PROSPECT, date: d(-40) }, { status: CustomerStatus.CLOSED_LOST, date: d(-15) }],
      closedReason: 'Decided to stay with their current provider due to budget constraints.',
      interactions: [
        { id: 'int7_1', type: InteractionType.EMAIL, date: d(-15), summary: 'Received email informing us they will not be moving forward at this time.' },
      ],
    },
  ];
};
