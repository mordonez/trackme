#!/usr/bin/env node

/**
 * Script para crear un entorno de preview local
 * Uso: npm run preview:create <branch-name>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command) {
  console.log(`\n> ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
    return output;
  } catch (error) {
    console.error(`Error ejecutando comando: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const branchName = process.argv[2] || getCurrentBranch();

  if (!branchName) {
    console.error('❌ No se pudo determinar el nombre de la rama');
    console.log('Uso: npm run preview:create <branch-name>');
    process.exit(1);
  }

  // Sanitizar el nombre de la rama para usarlo en nombres de recursos
  const sanitizedBranch = branchName
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase()
    .substring(0, 30);

  const dbName = `trackme-${sanitizedBranch}`;
  const workerName = `trackme-${sanitizedBranch}`;

  console.log('🚀 Creando entorno de preview...');
  console.log(`   Rama: ${branchName}`);
  console.log(`   DB: ${dbName}`);
  console.log(`   Worker: ${workerName}`);

  // Verificar si la DB ya existe
  console.log('\n📊 Verificando base de datos...');
  let dbId;

  try {
    const listOutput = execSync('npx wrangler d1 list', { encoding: 'utf-8' });
    const dbExists = listOutput.includes(dbName);

    if (dbExists) {
      console.log(`✅ La base de datos ${dbName} ya existe`);
      // Extraer el ID de la base de datos
      const lines = listOutput.split('\n');
      for (const line of lines) {
        if (line.includes(dbName)) {
          const parts = line.split(/\s+/);
          dbId = parts[1];
          break;
        }
      }
    } else {
      console.log(`🆕 Creando base de datos ${dbName}...`);
      const createOutput = execSync(`npx wrangler d1 create ${dbName}`, { encoding: 'utf-8' });
      console.log(createOutput);

      // Extraer el database_id
      const match = createOutput.match(/database_id = "([^"]+)"/);
      if (match) {
        dbId = match[1];
      }
    }

    if (!dbId) {
      console.error('❌ No se pudo obtener el database_id');
      process.exit(1);
    }

    console.log(`   Database ID: ${dbId}`);

    // Crear wrangler.toml temporal
    console.log('\n📝 Creando configuración temporal...');
    const wranglerConfig = `name = "${workerName}"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
USER = "admin"
PASSWORD = "${sanitizedBranch}"

[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "${dbId}"
`;

    const configPath = path.join(process.cwd(), `wrangler.${sanitizedBranch}.toml`);
    fs.writeFileSync(configPath, wranglerConfig);
    console.log(`✅ Configuración creada: ${configPath}`);

    // Inicializar schema
    console.log('\n🗄️  Inicializando schema de base de datos...');
    exec(`npx wrangler d1 execute ${dbName} --file=./schema.sql`);

    // Desplegar worker
    console.log('\n🚀 Desplegando worker...');
    exec(`npx wrangler deploy --config ${configPath}`);

    // Configurar secretos
    console.log('\n🔐 Configurando secretos de Cloudflare...');
    const username = 'admin';
    const password = sanitizedBranch;

    try {
      execSync(`echo "${username}" | npx wrangler secret put USER --name ${workerName}`, {
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      execSync(`echo "${password}" | npx wrangler secret put PASSWORD --name ${workerName}`, {
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      console.log('✅ Secretos configurados correctamente');
    } catch (error) {
      console.warn('⚠️  Warning: No se pudieron configurar los secretos automáticamente');
      console.log('   Configúralos manualmente con:');
      console.log(`   npx wrangler secret put USER --name ${workerName}`);
      console.log(`   npx wrangler secret put PASSWORD --name ${workerName}`);
    }

    console.log('\n✅ ¡Entorno de preview creado exitosamente!');
    console.log(`\n🌐 URL: https://${workerName}.workers.dev`);
    console.log(`🔐 User: ${username}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`\n💡 Para borrar este preview: npm run preview:delete ${branchName}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

main();
