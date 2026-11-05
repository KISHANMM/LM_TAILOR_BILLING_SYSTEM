#!/usr/bin/env node

/**
 * LM Tailor Billing System - Pre-Deployment Verification Pipeline
 * Validates linting, frontend build, backend syntax, and repository state before deploying.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const SERVER_DIR = path.join(ROOT_DIR, 'server');

const isWindows = process.platform === 'win32';
const NPM = isWindows ? 'npm.cmd' : 'npm';

function logStep(stepNum, totalSteps, title) {
    console.log(`\n${CYAN}[${stepNum}/${totalSteps}]${RESET} ${BOLD}${title}${RESET}`);
}
function logPass(message) {
    console.log(`  ${GREEN}✔ PASS:${RESET} ${message}`);
}
function logFail(message, details = '') {
    console.log(`  ${RED}✖ FAIL:${RESET} ${message}`);
    if (details && details.trim()) {
        console.log(`${GRAY}${details.trim()}${RESET}`);
    }
}
function logWarn(message) {
    console.log(`  ${YELLOW}⚠ WARN:${RESET} ${message}`);
}

function run(cmd, cwd) {
    try {
        const output = execSync(cmd, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return { success: true, output: output || '' };
    } catch (err) {
        return {
            success: false,
            output: (err.stdout || '') + (err.stderr || '') || err.message
        };
    }
}

console.log(`${BOLD}======================================================${RESET}`);
console.log(`${BOLD}  L.M. TAILOR BILLING SYSTEM - PRE-DEPLOYMENT PIPELINE${RESET}`);
console.log(`${BOLD}======================================================${RESET}`);
console.log(`${GRAY}Timestamp: ${new Date().toISOString()}${RESET}`);
console.log(`${GRAY}Target Root: ${ROOT_DIR}${RESET}\n`);

let hasFailure = false;
const TOTAL_STEPS = 4;

// ─── Step 1: Client ESLint ────────────────────────────────────────────
logStep(1, TOTAL_STEPS, 'Checking Client Code Quality (ESLint)...');
const lintResult = run(`${NPM} run lint`, CLIENT_DIR);
if (lintResult.success) {
    logPass('Zero lint errors or warnings found in client code.');
} else {
    hasFailure = true;
    logFail('Client linting failed!', lintResult.output);
}

// ─── Step 2: Client Production Build ─────────────────────────────────
logStep(2, TOTAL_STEPS, 'Verifying Client Production Build (Vite)...');
const buildResult = run(`${NPM} run build`, CLIENT_DIR);
if (buildResult.success) {
    const distIndex = path.join(CLIENT_DIR, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
        logPass('Vite client bundle compiled successfully to /dist.');
    } else {
        hasFailure = true;
        logFail('Build command succeeded but dist/index.html was not found.');
    }
} else {
    hasFailure = true;
    logFail('Client production build failed!', buildResult.output);
}

// ─── Step 3: Server Syntax Validation ────────────────────────────────
logStep(3, TOTAL_STEPS, 'Validating Server Syntax & Routes...');
const serverFiles = [
    'server.js',
    'db.js',
    'routes/orders.js',
    'routes/customers.js',
    'routes/alterations.js',
    'routes/analytics.js',
    'routes/auth.js',
    'routes/dashboard.js'
];

let serverErrors = 0;
for (const relFile of serverFiles) {
    const fullPath = path.join(SERVER_DIR, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const res = run(`node --check "${fullPath}"`, SERVER_DIR);
    if (!res.success) {
        serverErrors++;
        hasFailure = true;
        logFail(`Syntax error in server/${relFile}`, res.output);
    }
}

if (serverErrors === 0) {
    logPass('All server entry points and routes passed Node.js syntax verification.');
}

// ─── Step 4: Git Status Check ─────────────────────────────────────────
logStep(4, TOTAL_STEPS, 'Checking Git Repository Status...');
const gitResult = run('git status --porcelain', ROOT_DIR);
if (gitResult.success) {
    const changedFiles = gitResult.output.trim();
    if (changedFiles) {
        const count = changedFiles.split('\n').length;
        logWarn(`Found ${count} uncommitted/modified file(s) in working tree.`);
        console.log(`${GRAY}  (Commit all changes before pushing to main branch)${RESET}`);
    } else {
        logPass('Working tree is clean. Ready for push.');
    }
} else {
    logWarn('Git status check skipped (Git not found or not a repository).');
}

// ─── Final Summary ────────────────────────────────────────────────────
console.log(`\n${BOLD}======================================================${RESET}`);
if (hasFailure) {
    console.log(`${RED}${BOLD}❌ PRE-DEPLOYMENT CHECKS FAILED!${RESET}`);
    console.log(`${RED}Deployment is blocked to prevent breaking production.${RESET}`);
    console.log(`${YELLOW}Please resolve the errors above and retry.${RESET}`);
    console.log(`${BOLD}======================================================${RESET}\n`);
    process.exit(1);
} else {
    console.log(`${GREEN}${BOLD}✔ ALL PRE-DEPLOYMENT CHECKS PASSED!${RESET}`);
    console.log(`${GREEN}Your codebase is healthy and safe to deploy to Vercel/Production.${RESET}`);
    console.log(`${BOLD}======================================================${RESET}\n`);
    process.exit(0);
}
