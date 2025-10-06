// setup.js - Script de configuração inicial
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');


async function setup() {
    console.log('🚀 Iniciando configuração do Lalu Dev Backend...\n');

    try {
        // 1. Criar diretórios necessários
        console.log('📁 Criando diretórios...');
        await fs.mkdir('uploads/projetos', { recursive: true });
        await fs.mkdir('public', { recursive: true });
        console.log('✅ Diretórios criados!\n');

        // 2. Conectar ao banco MySQL
    console.log('🗄️  Conectando ao banco MySQL...');
const connection = await mysql.createConnection({
    host: process.env.DB_HOST,       // Railway vai fornecer automaticamente
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME    // importante incluir o nome do banco
});
    console.log('✅ Conectado ao MySQL!');

        // 3. Criar tabelas
        console.log('📋 Criando tabelas...');
        
        // Tabela de administradores
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS administradores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario VARCHAR(50) UNIQUE NOT NULL,
                senha_hash VARCHAR(255) NOT NULL,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de projetos
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS projetos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT NOT NULL,
                tecnologias JSON NOT NULL,
                link_projeto VARCHAR(500),
                link_github VARCHAR(500),
                imagem VARCHAR(255),
                ativo BOOLEAN DEFAULT true,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabelas criadas!\n');

// 5. Criar usuário administrador
console.log('👤 Configurando administrador...');

const usuarioAdmin = 'admin';
const senhaAdmin = process.env.ADMIN_PASSWORD;
const senhaHash = await bcrypt.hash(senhaAdmin, 10);

// Inserir administrador no banco
await connection.execute(`
    INSERT INTO administradores (usuario, senha_hash) 
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash)
`, [usuarioAdmin, senhaHash]);

console.log(`✅ Administrador configurado!`);
console.log(`   Usuário: ${usuarioAdmin}`);
console.log(`   Senha: ${senhaAdmin}\n`);

// Encerrar conexão
await connection.end();


        // 6. Verificar arquivos HTML
        console.log('📄 Verificando arquivos HTML...');
        const arquivosObrigatorios = [
            'public/index.html',
            'public/admin.html', 
            'public/admin-form.html',
            'public/projetos.html'
        ];

        for (const arquivo of arquivosObrigatorios) {
            try {
                await fs.access(arquivo);
                console.log(`✅ ${arquivo} encontrado`);
            } catch {
                console.log(`⚠️  ${arquivo} não encontrado - você precisa criar este arquivo`);
            }
        }

        console.log('\n🎉 CONFIGURAÇÃO CONCLUÍDA!');
        console.log('\n📋 PRÓXIMOS PASSOS:');
        console.log('1. Configure suas variáveis no arquivo .env');
        console.log('2. Mova seus arquivos HTML para a pasta public/');
        console.log('3. Execute: npm run dev');
        console.log('4. Acesse: http://localhost:3000');
        console.log('\n🔐 LOGIN DO ADMINISTRADOR:');
        console.log(`   Usuário: ${usuarioAdmin}`);
        console.log(`   Senha: ${senhaAdmin}`);
        console.log('\n⚠️  IMPORTANTE: Altere a senha padrão em produção!');

    } catch (error) {
        console.error('❌ Erro na configuração:', error);
        console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
        console.log('• Verifique se o MySQL está rodando');
        console.log('• Confira as credenciais no arquivo .env');
        console.log('• Certifique-se que o usuário MySQL tem permissões');
    }
}

// Executar configuração
setup();
