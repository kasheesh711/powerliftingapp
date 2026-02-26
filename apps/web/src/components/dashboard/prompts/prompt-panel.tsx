import { useState } from 'react';

import type { PromptContextVM, PromptTemplateId } from '../types';
import { buildPromptText, getPromptTemplates } from './prompt-templates';

import styles from '../dashboard-view.module.css';

interface PromptPanelProps {
  context: PromptContextVM;
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document !== 'undefined') {
    const element = document.createElement('textarea');
    element.value = value;
    element.style.position = 'fixed';
    element.style.opacity = '0';
    document.body.appendChild(element);
    element.focus();
    element.select();
    document.execCommand('copy');
    document.body.removeChild(element);
  }
}

export function PromptPanel({ context }: PromptPanelProps): JSX.Element {
  const [copiedTemplate, setCopiedTemplate] = useState<PromptTemplateId | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopy(templateId: PromptTemplateId): Promise<void> {
    try {
      await copyText(buildPromptText(templateId, context));
      setCopiedTemplate(templateId);
      setCopyError(null);
    } catch (error) {
      setCopiedTemplate(null);
      setCopyError(error instanceof Error ? error.message : 'Unable to copy prompt.');
    }
  }

  return (
    <section className={styles.promptPanel} data-testid="prompt-panel">
      <div className={styles.promptPanelHeader}>
        <h3 className={styles.cardTitle}>Coach Prompt Builder</h3>
        <p className={styles.sectionHint}>Generate copy-ready prompts with current block context.</p>
      </div>
      <div className={styles.promptButtons}>
        {getPromptTemplates().map((template) => (
          <button
            key={template.id}
            type="button"
            className={styles.buttonSecondary}
            onClick={() => {
              void handleCopy(template.id);
            }}
            data-testid={`prompt-copy-${template.id}`}
          >
            {copiedTemplate === template.id ? `${template.label} Copied` : `Copy ${template.label}`}
          </button>
        ))}
      </div>
      {copyError ? <p className={styles.infoHint}>{copyError}</p> : null}
    </section>
  );
}
