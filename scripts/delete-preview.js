#!/usr/bin/env node

/**
 * Script para borrar un entorno de preview
 * Uso: npm run preview:delete <branch-name>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, ignoreError = false) {
  console.log(`\n> ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
    return output;
  } catch (error) {
    if (!ignoreError) {
      console.error(`Error ejecutando comando: ${error.message}`);
    }
    return null;
  }
}

function main() {
  const branchName = process.argv[2] || getCurrentBranch();

  if (!branchName) {
    console.error('❌ No se pudo determinar el nombre de la rama');
    console.log('Uso: npm run preview:delete <branch-name>');
    process.exit(1);
  }

  // Sanitizar el nombre de la rama
  const sanitizedBranch = branchName
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase()
    .substring(0, 30);

  const dbName = `trackme-${sanitizedBranch}`;
  const workerName = `trackme-${sanitizedBranch}`;

  console.log('🧹 Borrando entorno de preview...');
  console.log(`   Rama: ${branchName}`);
  console.log(`   DB: ${dbName}`);
  console.log(`   Worker: ${workerName}`);

  // Borrar secretos primero
  console.log('\n🗑️  Borrando secretos de Cloudflare...');
  exec(`npx wrangler secret delete USER --name ${workerName} --force`, true);
  exec(`npx wrangler secret delete PASSWORD --name ${workerName} --force`, true);

  // Borrar worker
  console.log('\n🗑️  Borrando worker...');
  exec(`npx wrangler delete ${workerName} --force`, true);

  // Borrar base de datos
  console.log('\n🗑️  Borrando base de datos...');
  exec(`npx wrangler d1 delete ${dbName} --skip-confirmation`, true);

  // Borrar archivo de configuración temporal
  const configPath = path.join(process.cwd(), `wrangler.${sanitizedBranch}.toml`);
  if (fs.existsSync(configPath)) {
    console.log(`\n🗑️  Borrando configuración temporal: ${configPath}`);
    fs.unlinkSync(configPath);
  }

  console.log('\n✅ ¡Entorno de preview borrado exitosamente!');
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

main();
