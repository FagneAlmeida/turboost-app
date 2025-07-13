// server.js

// 1. IMPORTAÇÃO DE MÓDULOS
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');

// 2. CONFIGURAÇÃO INICIAL
const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const SALT_ROUNDS = 10;

// 3. MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'seu-segredo-super-secreto-e-longo',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(express.static(path.join(__dirname, 'public')));

// (Código do Multer e isAuthenticated permanece o mesmo)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let destFolder = 'images';
        if (file.fieldname.startsWith('som')) { destFolder = 'sounds'; }
        cb(null, path.join(__dirname, 'public', destFolder));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) { return next(); }
    res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
}


// 4. ROTAS DA API PÚBLICA E DE AUTENTICAÇÃO

// [GET] /api/check-admin - NOVA ROTA para verificar se um admin existe
app.get('/api/check-admin', async (req, res) => {
    try {
        // Tenta ler o arquivo de usuários
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        // Retorna true se houver um ou mais usuários, false caso contrário
        res.json({ adminExists: users.length > 0 });
    } catch (error) {
        // Se o arquivo não existir (ou outro erro de leitura), assume que não há admin
        res.json({ adminExists: false });
    }
});

// [GET] /api/products - Rota pública para produtos
app.get('/api/products', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// [POST] /api/register - Registra o primeiro administrador
app.post('/api/register', async (req, res) => {
    try {
        let users = [];
        try {
            const usersData = await fs.readFile(USERS_FILE, 'utf8');
            users = JSON.parse(usersData);
        } catch (e) { /* Arquivo não existe, o que é esperado na primeira vez */ }

        if (users.length > 0) {
            return res.status(403).json({ message: 'Um administrador já está cadastrado.' });
        }

        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const newUser = { id: Date.now(), username, password: hashedPassword };
        
        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        res.status(201).json({ message: 'Administrador cadastrado com sucesso!' });

    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// [POST] /login - Autentica o administrador
app.post('/login', async (req, res) => {
    try {
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        const { username, password } = req.body;
        
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.loggedIn = true;
            res.status(200).json({ message: 'Login bem-sucedido!' });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// [POST] /logout - Encerra a sessão
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ message: 'Não foi possível fazer logout.' }); }
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});

// 5. ROTAS PROTEGIDAS (CRUD de Produtos)
// (As rotas POST, PUT, DELETE para /api/products permanecem as mesmas)
app.post('/api/products', isAuthenticated, upload.fields([{ name: 'imagemURL', maxCount: 1 }, { name: 'somOriginal', maxCount: 1 }, { name: 'somLenta', maxCount: 1 }, { name: 'somAcelerando', maxCount: 1 }]), async (req, res) => { /* ...código existente... */ });
app.put('/api/products/:id', isAuthenticated, async (req, res) => { /* ...código existente... */ });
app.delete('/api/products/:id', isAuthenticated, async (req, res) => { /* ...código existente... */ });

// 6. INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor Turboost rodando na porta ${PORT}`);
});
