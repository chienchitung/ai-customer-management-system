// Enum for the different stages of a customer in the sales pipeline.
export enum CustomerStatus {
  LEAD = 'Lead',
  PROSPECT = 'Prospect',
  NEGOTIATION = 'Negotiation',
  CLOSED_WON = 'Closed (Won)',
  CLOSED_LOST = 'Closed (Lost)',
}

// Enum for the types of interactions with a customer.
export enum InteractionType {
  EMAIL = 'Email',
  CALL = 'Call',
  MEETING = 'Meeting',
  NOTE = 'Note',
}

// Interface representing a single interaction with a customer.
export interface Interaction {
  id: string;
  type: InteractionType;
  date: string; // Stored as 'YYYY-MM-DD'
  summary: string;
}

// Interface for a key contact at the customer's company.
export interface KeyContact {
    id: string;
    name: string;
    title: string;
}

// Interface for the next actionable step.
export interface NextAction {
    description: string;
    dueDate: string; // Stored as 'YYYY-MM-DD'
}

// Interface representing a customer.
export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  status: CustomerStatus;
  lastContact: string; // Stored as 'YYYY-MM-DD'
  interactions: Interaction[];
  // Enhanced Customer Intelligence Fields
  dealValue?: number;
  keyContacts?: KeyContact[];
  customerPainPoints?: string[];
  competitors?: string[];
  // Proactive Task Management
  nextAction?: NextAction;
  closedReason?: string; // For Closed-Lost/Won analysis
  createdAt?: string; // 'YYYY-MM-DD'
  statusHistory?: StatusChange[]; // Oldest first; used for stage-duration analytics
}

// A record of when a customer entered a pipeline stage.
export interface StatusChange {
  status: CustomerStatus;
  date: string; // 'YYYY-MM-DD'
}

// Enum for the types of AI suggestions available.
export enum AISuggestionType {
    NEXT_STEP = 'nextStep',
    SUMMARY = 'summarize',
    DRAFT_EMAIL = 'draftEmail',
    MEETING_BRIEF = 'meetingBrief',
}