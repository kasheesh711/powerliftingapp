# Attempt Selection Planner Prompt Template

Use this prompt to generate meet-day attempt options grounded in current trend rates.

```text
Act as a meet-day attempt strategist. Use this context to recommend attempt selection for squat, bench, and deadlift.

Instructions:
1. Give opener, second, and third attempt for each lift in kg.
2. Show conservative and aggressive third-attempt alternatives.
3. Respect current trend rates and completion consistency.
4. Explain assumptions in 4 bullet points.

Athlete Context (JSON):
{{PROMPT_CONTEXT_JSON}}
```
