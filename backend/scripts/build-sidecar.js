const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendBinDir = path.resolve(__dirname, '../../frontend/src-tauri/bin');

console.log('Building sidecar...');

if (!fs.existsSync(frontendBinDir)) {
    fs.mkdirSync(frontendBinDir, { recursive: true });
}

try {
    console.log('Running tsc...');
    execSync('npx tsc', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
    console.error('tsc failed');
    process.exit(1);
}

try {
    console.log('Running pkg...');
    execSync(`npx pkg . --target node18-win-x64 --output "${path.join(frontendBinDir, 'backend-x86_64-pc-windows-msvc.exe')}"`, { cwd: rootDir, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' } });
} catch (e) {
    console.error('pkg failed');
    process.exit(1);
}

const engineName = 'query_engine-windows.dll.node';
const enginePath = path.join(rootDir, 'node_modules', '@prisma', 'engines', engineName);
const targetEnginePath = path.join(frontendBinDir, engineName);

if (fs.existsSync(enginePath)) {
    fs.copyFileSync(enginePath, targetEnginePath);
    console.log('Copied Prisma engine');
} else {
    console.error('Prisma engine not found at', enginePath);
    process.exit(1);
}

const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const targetSchemaPath = path.join(frontendBinDir, 'schema.prisma');
fs.copyFileSync(schemaPath, targetSchemaPath);
console.log('Copied schema.prisma');

const templatePath = path.join(rootDir, 'prisma', 'template.db');
const targetTemplatePath = path.join(frontendBinDir, 'template.db');
if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, targetTemplatePath);
    console.log('Copied template.db');
} else {
    console.warn('template.db not found at', templatePath, 'skipping');
}

console.log('Sidecar build complete.');
