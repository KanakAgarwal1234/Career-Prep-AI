import type { ExperienceLevel, QuestionType } from "@/lib/types";
import type { RoleFamily } from "@/lib/resume/lexicon";

export interface QTemplate {
  key: string;
  text: string;
  focus: string;
  type: QuestionType;
  levels?: ExperienceLevel[];
}

const q = (type: QuestionType, key: string, focus: string, text: string, levels?: ExperienceLevel[]): QTemplate => ({ type, key, focus, text, levels });

export const OPENERS: QTemplate[] = [
  q("opener", "op-walk", "Narrative & motivation", "To start, walk me through your background and what's drawing you to this {role} role."),
  q("opener", "op-recent", "Narrative & motivation", "Tell me about yourself — focus on the last few years, and why {role} is the right next step for you."),
];

export const BEHAVIORAL: QTemplate[] = [
  q("behavioral", "bh-conflict", "Conflict resolution", "Tell me about a time you strongly disagreed with a teammate or stakeholder. How did you handle it, and what happened?"),
  q("behavioral", "bh-failure", "Learning from failure", "Describe a project that failed or fell short of its goal. What went wrong, and what did you change afterwards?"),
  q("behavioral", "bh-deadline", "Execution under pressure", "Tell me about a time you had to deliver under a tight deadline with incomplete information. How did you decide what to do?"),
  q("behavioral", "bh-influence", "Influence without authority", "Give me an example of when you changed a decision without having formal authority over the people involved."),
  q("behavioral", "bh-feedback", "Coachability", "Describe a time you received tough feedback. What did you do with it?"),
  q("behavioral", "bh-turnaround", "Leadership", "Tell me about a time you turned around an underperforming team or project. What did you change first?", ["senior", "lead"]),
  q("behavioral", "bh-hire", "Building teams", "Tell me about a hiring or people decision you got wrong. How did you recognise it and what did you do?", ["lead"]),
  q("behavioral", "bh-learn", "Learning agility", "Tell me about a time you had to learn something new quickly to get a result. How did you approach it?", ["entry", "mid"]),
];

export const SITUATIONAL: QTemplate[] = [
  q("situational", "st-assumption", "Judgment", "Imagine that a month into this role you discover the team's top priority rests on a flawed assumption. What do you do?"),
  q("situational", "st-conflicting", "Prioritisation", "Suppose two senior stakeholders give you conflicting priorities with the same deadline. Walk me through how you'd resolve it."),
  q("situational", "st-90", "Strategic planning", "If you started as our {role} on Monday, what would your first 90 days look like?"),
  q("situational", "st-underperform", "Managing performance", "A strong performer on your team has missed three commitments in a row. How would you handle it?", ["senior", "lead"]),
];

export const TECHNICAL: Record<RoleFamily, QTemplate[]> = {
  software: [
    q("technical", "sw-design", "System design", "Walk me through how you'd design a URL shortener that handles ten thousand requests per second. What are the key components and trade-offs?"),
    q("technical", "sw-bug", "Debugging", "Tell me about the hardest bug you've tracked down. How did you isolate the root cause?"),
    q("technical", "sw-latency", "Performance", "An API endpoint's p95 latency doubled right after a deploy. How would you diagnose it?"),
    q("technical", "sw-refactor", "Engineering judgment", "How do you decide when to refactor versus ship? Give me a concrete example."),
  ],
  data: [
    q("technical", "da-ab", "Experimentation", "How would you design an A/B test to measure whether a new onboarding flow improves retention? What could invalidate the result?"),
    q("technical", "da-drop", "Root-cause analysis", "A key metric dropped fifteen percent week over week. Walk me through how you'd investigate."),
    q("technical", "da-story", "Insight communication", "Tell me about an analysis where the data told a different story than stakeholders expected. How did you land it?"),
    q("technical", "da-messy", "Data quality", "How do you handle missing or messy data before you build a model or dashboard?"),
  ],
  product: [
    q("technical", "pm-prio", "Prioritisation", "You have ten good ideas and capacity for three next quarter. How do you decide what to build?"),
    q("technical", "pm-metric", "Product sense", "Pick a product you use often. What single metric would you use to measure its success, and why?"),
    q("technical", "pm-dau", "Analytical thinking", "Daily active users dropped ten percent overnight. Walk me through how you'd diagnose it."),
    q("technical", "pm-kill", "Product judgment", "Tell me about a feature you killed or descoped. How did you make that call and bring people along?"),
  ],
  design: [
    q("technical", "ds-research", "Research-driven design", "Walk me through a design decision that was shaped by research. What did you learn from users?"),
    q("technical", "ds-checkout", "Problem solving", "How would you improve the checkout of an e-commerce app with a high drop-off rate?"),
    q("technical", "ds-pushback", "Design advocacy", "How do you handle a stakeholder who insists on a design you believe hurts usability?"),
    q("technical", "ds-system", "Systems thinking", "How do you keep a design system consistent as more teams contribute to it?"),
  ],
  marketing: [
    q("technical", "mk-budget", "Budget allocation", "How would you allocate a fifty-thousand-dollar quarterly budget across channels for a new {industry} product launch?"),
    q("technical", "mk-under", "Performance analysis", "Tell me about a campaign that underperformed. How did you diagnose and fix it?"),
    q("technical", "mk-roi", "Attribution", "How do you measure the ROI of brand or content work that doesn't convert directly?"),
    q("technical", "mk-cac", "Growth strategy", "How would you lower customer acquisition cost by twenty percent without reducing volume?"),
  ],
  sales: [
    q("technical", "sl-process", "Sales process", "Walk me through your process from first contact to closed deal for a complex B2B sale."),
    q("technical", "sl-price", "Objection handling", "A prospect says your price is thirty percent higher than a competitor's. How do you respond?"),
    q("technical", "sl-lost", "Self-assessment", "Tell me about a deal you lost. What would you do differently?"),
    q("technical", "sl-pipe", "Pipeline management", "How do you build and prioritise your pipeline at the start of a quarter?"),
  ],
  finance: [
    q("technical", "fn-model", "Financial modeling", "Walk me through how you'd build a three-statement model for a subscription business."),
    q("technical", "fn-variance", "Analysis to action", "Tell me about a variance you uncovered that changed a business decision."),
    q("technical", "fn-value", "Valuation", "How would you value a company with negative earnings but strong revenue growth?"),
    q("technical", "fn-explain", "Communication", "How do you explain a complex financial result to a non-finance executive?"),
  ],
  operations: [
    q("technical", "op-process", "Process improvement", "Walk me through a process you redesigned. How did you measure the improvement?"),
    q("technical", "op-supplier", "Crisis management", "A key supplier misses a delivery and production will stall in forty-eight hours. What do you do?"),
    q("technical", "op-metrics", "Metrics design", "How do you decide which operational metrics to review every week?"),
    q("technical", "op-cost", "Cost optimisation", "Tell me about a time you reduced cost without hurting quality."),
  ],
  people: [
    q("technical", "hr-tth", "Recruiting strategy", "How would you cut time-to-hire for a hard-to-fill role by thirty percent?"),
    q("technical", "hr-er", "Employee relations", "Tell me about a sensitive employee-relations issue you handled. How did you balance fairness and policy?"),
    q("technical", "hr-engage", "People analytics", "How do you measure whether an engagement initiative actually worked?"),
  ],
  consulting: [
    q("technical", "cs-sizing", "Structured thinking", "Estimate the annual market for electric scooters in a major city. Talk me through your approach."),
    q("technical", "cs-profit", "Case structuring", "A retail client's profits fell twenty percent while revenue stayed flat. How would you structure the problem?"),
    q("technical", "cs-push", "Client management", "Tell me about a time a client pushed back hard on your recommendation. What happened?"),
  ],
  general: [
    q("technical", "gn-first", "Problem solving", "What's the first significant problem you'd expect to own as a {role}, and how would you approach it?"),
    q("technical", "gn-skill", "Craft growth", "What's a skill central to {role} work that you've deliberately improved recently, and how?"),
    q("technical", "gn-data", "Data-driven thinking", "Tell me about a time you used data to change someone's mind."),
  ],
};

export const CLOSERS: QTemplate[] = [
  q("closing", "cl-why", "Motivation & fit", "Last question: why this role, and what would make you exceptional at it in your first year?"),
  q("closing", "cl-manager", "Self-awareness", "Finally — what's one thing about how you work that a future manager should know on day one?"),
];

export const ACKS = ["Thanks, that's helpful.", "Got it.", "Okay, that makes sense.", "Appreciate the detail.", "Understood.", "Thanks for walking me through that."];
export const FOLLOW_UP_ACKS = ["Let me dig into that a little.", "I'd like to go one level deeper there.", "Let's stay on that for a moment."];
export const CLOSING_LINE = "That's the end of our interview — thank you. I'm putting together your evaluation now.";
