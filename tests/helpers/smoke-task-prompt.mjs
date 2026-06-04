/**
 * Minimal valid PROMPT.md body for batch integration tests.
 *
 * @param {string} taskId
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.mission]
 * @param {string} [options.fileScope]
 */
export function minimalValidPromptMarkdown(
	taskId,
	{ title = "Smoke", mission = "Smoke task for batch tests.", fileScope = "src/smoke.txt" } = {},
) {
	return `# Task: ${taskId} — ${title}

## Mission
${mission}

## Dependencies
- **None**

## File Scope
- \`${fileScope}\`

## Steps
### Step 0: Done
- [ ] one

### Step 1: Testing & Verification
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- touch unrelated files
`;
}
