// server.js - Servidor principal
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cloudinary = require('cloudinary').v2;


const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---------------- Middleware ----------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'lalu-dev-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------- Upload de imagens ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/projetos/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'projeto-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas!'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ---------------- Banco de dados ----------------
async function initDatabase() {
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Criar tabelas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS administradores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(50) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Remove projeto de exemplo, se existir
    await connection.execute(`DELETE FROM projetos WHERE titulo = 'projetoExemplo'`);

    // Criar usuário admin padrão
    const senhaAdmin = process.env.ADMIN_PASSWORD;
    const senhaHash = await bcrypt.hash(senhaAdmin, 10);
    await connection.execute(`
      INSERT IGNORE INTO administradores (usuario, senha_hash) VALUES (?, ?)
    `, ['admin', senhaHash]);

    console.log('✅ Banco de dados inicializado!');
    console.log(`📝 Login padrão: admin / ${senhaAdmin}`);

    await connection.end();
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
  }
}

// ---------------- Middleware de autenticação ----------------
function requireAuth(req, res, next) {
  if (req.session.adminLogado) next();
  else res.redirect('/admin.html');
}

// ---------------- Rotas públicas ----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/projetos.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'projetos.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ---------------- Rotas administrativas ----------------
app.get('/admin-form.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-form.html'));
});

app.post('/admin', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM administradores WHERE usuario = ?',
      [usuario]
    );
    await connection.end();

    if (rows.length === 0 || !(await bcrypt.compare(senha, rows[0].senha_hash))) {
      return res.send(`
        <script>
          alert('Usuário ou senha inválidos!');
          window.location.href = '/admin.html';
        </script>
      `);
    }

    req.session.adminLogado = true;
    req.session.adminId = rows[0].id;

    res.redirect('/admin-form.html');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno do servidor');
  }
});

// ---------------- Tecnologias ----------------
const tecnologiasPermitidas = [
  'html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt.js', 'gatsby',
  'react native', 'flutter', 'ionic', 'xamarin', 'kotlin', 'swift', 'node.js', 'express', 'fastify', 'nest.js',
  'python', 'django', 'flask', 'fastapi', 'php', 'laravel', 'symfony', 'codeigniter', 'java', 'spring', 'spring boot',
  'c#', '.net', '.net core', 'ruby', 'rails', 'sinatra', 'go', 'gin', 'echo', 'rust', 'actix', 'sql', 'mysql', 'postgresql',
  'sqlite', 'mariadb', 'mongodb', 'couchdb', 'redis', 'memcached', 'firebase', 'firestore', 'supabase', 'power bi', 'tableau',
  'excel', 'google analytics', 'looker', 'aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify', 'docker', 'kubernetes', 'jenkins',
  'github actions', 'git', 'github', 'gitlab', 'bitbucket', 'figma', 'adobe xd', 'sketch', 'photoshop', 'webpack', 'vite',
  'parcel', 'rollup', 'jest', 'cypress', 'playwright', 'selenium'
];

function processarTecnologias(techsString) {
  if (!techsString) return [];
  const techs = techsString.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
  const invalidas = techs.filter(t => !tecnologiasPermitidas.includes(t));
  if (invalidas.length) console.warn(`🔸 Tecnologias não reconhecidas: ${invalidas.join(', ')}`);
  return techs;
}

// ---------------- Cadastro de projetos ----------------
app.post('/admin-form', requireAuth, upload.single('imagens'), async (req, res) => {
  try {
    const { titulo, descricao, techs, link, link_github } = req.body;
    const tecnologias = processarTecnologias(techs);
    let imagemUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'projetos'
      });
      imagemUrl = result.secure_url;
      await fs.unlink(req.file.path); // opcional: remove o arquivo local
    }


    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(`
      INSERT INTO projetos (titulo, descricao, tecnologias, link_projeto, link_github, imagem)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [titulo, descricao, JSON.stringify(tecnologias), link, link_github, imagemUrl]);
    await connection.end();

    console.log(`✅ Projeto "${titulo}" cadastrado com tecnologias: ${tecnologias.join(', ')}`);

    res.send(`
      <script>
        alert('Projeto cadastrado com sucesso!');
        window.location.href = '/admin-form.html';
      </script>
    `);
  } catch (error) {
    console.error('Erro ao cadastrar projeto:', error);
    res.status(500).send('Erro ao cadastrar projeto');
  }
});

// ---------------- Logout ----------------
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ---------------- API ----------------
function safeJSONParse(str) {
  try {
    if (!str) return [];
    return Array.isArray(str) ? str : JSON.parse(str);
  } catch {
    return [];
  }
}

app.get('/api/projetos', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM projetos WHERE ativo = true ORDER BY criado_em DESC'
    );
    await connection.end();

    const projetos = rows.map(p => ({
      id: p.id,
      titulo: p.titulo,
      descricao: p.descricao,
      tecnologias: safeJSONParse(p.tecnologias),
      linkProjeto: p.link_projeto,
      linkGithub: p.link_github,
      imagem: p.imagem || null,

      criadoEm: p.criado_em
    }));

    res.json(projetos);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  } finally {
    if (connection) await connection.end();
  }
});

app.get('/api/tecnologias', (req, res) => {
  res.json({ tecnologias: tecnologiasPermitidas.sort(), total: tecnologiasPermitidas.length });
});

// ---------------- Inicialização ----------------
async function createDirectories() {
  await fs.mkdir('uploads/projetos', { recursive: true });
}

async function startServer() {
  await createDirectories();
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📋 Tecnologias disponíveis: http://localhost:${PORT}/api/tecnologias`);
    console.log(`🗂️  Projetos: http://localhost:${PORT}/api/projetos`);
  });
}

startServer();
