import type { PromptContextVM, PromptTemplateId } from '../types';

interface PromptTemplate {
  id: PromptTemplateId;
  label: string;
  intro: string;
  instructions: string[];
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'weekly_training_review',
    label: 'Weekly Training Review',
    intro: 'Act as my powerlifting coach and performance analyst. Review this athlete context and produce a concise weekly review.',
    instructions: [
      'Identify one positive trend and one risk trend.',
      'Explain which lift needs the highest-priority intervention and why.',
      'Provide 3 concrete next-week actions with load and RPE guidance.',
      'Keep the response under 250 words.'
    ]
  },
  {
    id: 'attempt_selection_planner',
    label: 'Attempt Selection Planner',
    intro: 'Act as a meet-day attempt strategist. Use this context to recommend attempt selection for squat, bench, and deadlift.',
    instructions: [
      'Give opener, second, and third attempt for each lift in kg.',
      'Show conservative and aggressive third-attempt alternatives.',
      'Respect current trend rates and completion consistency.',
      'Explain assumptions in 4 bullet points.'
    ]
  },
  {
    id: 'adjustment_decision_prompt',
    label: 'Adjustment Decision Prompt',
    intro: 'Act as a programming coach. Decide if the athlete should hold, increase, or reduce training stress for the next session.',
    instructions: [
      'Choose exactly one recommendation: hold, increase, or reduce.',
      'Use completion and trend-rate evidence to justify the call.',
      'Provide one primary-lift and one accessory adjustment.',
      'Return result in sections: Decision, Why, Next Session Plan.'
    ]
  }
];

export function getPromptTemplates(): PromptTemplate[] {
  return PROMPT_TEMPLATES;
}

export function buildPromptText(templateId: PromptTemplateId, context: PromptContextVM): string {
  const template = PROMPT_TEMPLATES.find((entry) => entry.id === templateId) ?? PROMPT_TEMPLATES[0];

  return [
    template.intro,
    '',
    'Instructions:',
    ...template.instructions.map((line, index) => `${index + 1}. ${line}`),
    '',
    'Athlete Context (JSON):',
    JSON.stringify(context, null, 2)
  ].join('\n');
}
