import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectTaskPacketSizeIssues } from "../../src/doctor/task-packet-size.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("collectTaskPacketSizeIssues flags XL and too many steps on pending packet", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tp-size-warn-"));
	const folder = path.join(dir, "TP-997-smoke");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-997 — Oversized

**Size:** L

## Mission
Too big.

## Dependencies
- **None**

## File Scope
- \`a.txt\`

## Steps
### Step 0: One
- [ ] a
### Step 1: Two
- [ ] b
### Step 2: Three
- [ ] c
### Step 3: Four
- [ ] d
### Step 4: Five
- [ ] e
### Step 5: Six
- [ ] f

### Step 6: Testing & Verification
- [ ] test

## Completion Criteria
- [ ] done

## Do NOT
- none
`,
		"utf-8",
	);
	const issues = collectTaskPacketSizeIssues({ tasksRoot: dir });
	assert.ok(issues.some((line) => line.includes("TP-997") && line.includes("Size L")));
	assert.ok(issues.some((line) => line.includes("implementation steps")));
	fs.rmSync(dir, { recursive: true, force: true });
});

test("collectTaskPacketSizeIssues ignores tasks with .DONE", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tp-size-"));
	const folder = path.join(dir, "TP-999-smoke");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-999 — Smoke

## Mission
x

## Dependencies
- **None**

## File Scope
- \`a.txt\`

## Steps
### Step 0: One
- [ ] a
### Step 1: Two
- [ ] b
### Step 2: Three
- [ ] c
### Step 3: Four
- [ ] d
### Step 4: Five
- [ ] e

### Step 5: Testing & Verification
- [ ] test

## Completion Criteria
- [ ] done

## Do NOT
- none
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
	const issues = collectTaskPacketSizeIssues({ tasksRoot: dir });
	assert.equal(issues.length, 0);
	fs.rmSync(dir, { recursive: true, force: true });
});
