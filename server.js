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
const DB_FOLDER = path.join(__dirname, 'db'); // Pasta para os arquivos JSON
const PRODUCTS_FILE = path.join(DB_FOLDER, 'products.json');
const USERS_FILE = path.join(DB_FOLDER, 'users.json');
const SALT_ROUNDS = 10;

// Função para garantir que os diretórios e arquivos de 'banco de dados' existam
const ensureDbExists = async () => {
    try {
        await fs.mkdir(DB_FOLDER, { recursive: true });
        await fs.access(PRODUCTS_FILE);
    } catch (error) {
        await fs.writeFile(PRODUCTS_FILE, '[]', 'utf8');
    }
    try {
        await fs.access(USERS_FILE);
    } catch (error) {
        await fs.writeFile(USERS_FILE, '[]', 'utf8');
    }
};


// 3. MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'seu-segredo-super-secreto-e-longo-para-turboost',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // Cookie de 1 dia
}));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));


// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let destFolder = 'images'; // Pasta padrão
        if (file.fieldname.startsWith('som')) {
            destFolder = 'sounds';
        }
        const fullPath = path.join(__dirname, 'public', destFolder);
        fs.mkdir(fullPath, { recursive: true }).then(() => {
            cb(null, fullPath);
        });
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
const uploadFields = upload.fields([
    { name: 'imagemURL', maxCount: 1 },
    { name: 'somOriginal', maxCount: 1 },
    { name: 'somLenta', maxCount: 1 },
    { name: 'somAcelerando', maxCount: 1 }
]);

// Middleware para verificar se o usuário está autenticado
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
        return next();
    }
    res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
}


// 4. FUNÇÕES AUXILIARES PARA O 'BANCO DE DADOS' JSON
const readData = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));
const writeData = async (filePath, data) => fs.writeFile(filePath, JSON.stringify(data, null, 2));


// 5. ROTAS DA API PÚBLICA E DE AUTENTICAÇÃO

// [GET] /api/check-admin - Verifica se um admin já existe
app.get('/api/check-admin', async (req, res) => {
    try {
        const users = await readData(USERS_FILE);
        res.json({ adminExists: users.length > 0 });
    } catch (error) {
        res.json({ adminExists: false });
    }
});

// [GET] /api/products - Rota pública para listar todos os produtos
app.get('/api/products', async (req, res) => {
    try {
        const products = await readData(PRODUCTS_FILE);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao ler os produtos.' });
    }
});

// [POST] /api/register - Registra o primeiro administrador
app.post('/api/register', async (req, res) => {
    try {
        let users = await readData(USERS_FILE);
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
        await writeData(USERS_FILE, users);
        res.status(201).json({ message: 'Administrador cadastrado com sucesso!' });

    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor ao registrar.' });
    }
});

// [POST] /login - Autentica o administrador
app.post('/login', async (req, res) => {
    try {
        const users = await readData(USERS_FILE);
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
        res.status(500).json({ message: 'Erro interno do servidor ao fazer login.' });
    }
});

// [POST] /logout - Encerra a sessão
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ message: 'Não foi possível fazer logout.' }); }
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});


// 6. ROTAS PROTEGIDAS (CRUD de Produtos)

// [POST] /api/products - Cria um novo produto
app.post('/api/products', isAuthenticated, uploadFields, async (req, res) => {
    try {
        const products = await readData(PRODUCTS_FILE);
        const { marca, modelo, ano, nomeProduto, descricao, preco } = req.body;

        if (!marca || !modelo || !ano || !nomeProduto || !preco || !req.files || !req.files['imagemURL']) {
            return res.status(400).json({ message: 'Campos obrigatórios (incluindo imagem principal) não foram preenchidos.' });
        }
        
        const newProduct = {
            id: Date.now(),
            marca,
            modelo,
            ano: ano.split(',').map(a => parseInt(a.trim(), 10)).filter(a => !isNaN(a)),
            nomeProduto,
            descricao,
            preco: parseFloat(preco),
            imagemURL: `/images/${req.files['imagemURL'][0].filename}`,
            somOriginal: req.files['somOriginal'] ? `/sounds/${req.files['somOriginal'][0].filename}` : null,
            somLenta: req.files['somLenta'] ? `/sounds/${req.files['somLenta'][0].filename}` : null,
            somAcelerando: req.files['somAcelerando'] ? `/sounds/${req.files['somAcelerando'][0].filename}` : null,
        };

        products.push(newProduct);
        await writeData(PRODUCTS_FILE, products);
        res.status(201).json(newProduct);

    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar produto.' });
    }
});

// [PUT] /api/products/:id - Atualiza um produto existente
app.put('/api/products/:id', isAuthenticated, uploadFields, async (req, res) => {
    try {
        const products = await readData(PRODUCTS_FILE);
        const productId = parseInt(req.params.id, 10);
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const existingProduct = products[productIndex];
        const { marca, modelo, ano, nomeProduto, descricao, preco } = req.body;

        const updatedProduct = {
            ...existingProduct,
            marca: marca || existingProduct.marca,
            modelo: modelo || existingProduct.modelo,
            ano: ano ? ano.split(',').map(a => parseInt(a.trim(), 10)).filter(a => !isNaN(a)) : existingProduct.ano,
            nomeProduto: nomeProduto || existingProduct.nomeProduto,
            descricao: descricao || existingProduct.descricao,
            preco: preco ? parseFloat(preco) : existingProduct.preco
        };
        
        // Atualiza os caminhos dos arquivos apenas se novos arquivos foram enviados
        if (req.files['imagemURL']) updatedProduct.imagemURL = `/images/${req.files['imagemURL'][0].filename}`;
        if (req.files['somOriginal']) updatedProduct.somOriginal = `/sounds/${req.files['somOriginal'][0].filename}`;
        if (req.files['somLenta']) updatedProduct.somLenta = `/sounds/${req.files['somLenta'][0].filename}`;
        if (req.files['somAcelerando']) updatedProduct.somAcelerando = `/sounds/${req.files['somAcelerando'][0].filename}`;

        products[productIndex] = updatedProduct;
        await writeData(PRODUCTS_FILE, products);
        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar produto.' });
    }
});

// [DELETE] /api/products/:id - Exclui um produto
app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        let products = await readData(PRODUCTS_FILE);
        const productId = parseInt(req.params.id, 10);
        
        const productToDelete = products.find(p => p.id === productId);
        if (!productToDelete) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        // Opcional: deletar os arquivos de mídia do servidor
        Object.values(productToDelete).forEach(async (value) => {
            if (typeof value === 'string' && (value.startsWith('/images/') || value.startsWith('/sounds/'))) {
                try {
                    await fs.unlink(path.join(__dirname, 'public', value));
                } catch (err) {
                    console.error(`Falha ao deletar arquivo: ${value}`, err.message);
                }
            }
        });

        const updatedProducts = products.filter(p => p.id !== productId);
        await writeData(PRODUCTS_FILE, updatedProducts);
        res.status(200).json({ message: 'Produto excluído com sucesso.' });

    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir produto.' });
    }
});


// 7. INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, async () => {
    await ensureDbExists(); // Garante que os arquivos/pastas existam antes de iniciar
    console.log(`Servidor Turboost rodando na porta ${PORT}`);
});
