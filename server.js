// 1. IMPORTAÇÃO DE MÓDULOS
const express = require('express');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin');

// =======================================================================================
// 2. CONFIGURAÇÃO DO FIREBASE
try {
    const serviceAccount = require('./serviceAccountKey.json');
    const BUCKET_NAME = 'oficina-fg-motos.appspot.com'; // CONFIRMADO

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET_NAME
    });
} catch (error) {
    console.error("ERRO CRÍTICO: O arquivo 'serviceAccountKey.json' não foi encontrado ou está inválido. O servidor não pode iniciar sem ele.");
    process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
// =======================================================================================


// 3. CONFIGURAÇÃO INICIAL DO EXPRESS
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;


// 4. MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'um-segredo-muito-forte-para-proteger-a-sessao',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));


// Configuração do Multer para aceitar todos os novos campos de mídia
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});
const uploadFields = upload.fields([
    { name: 'imagemURL1', maxCount: 1 },
    { name: 'imagemURL2', maxCount: 1 },
    { name: 'imagemURL3', maxCount: 1 },
    { name: 'somOriginal', maxCount: 1 },
    { name: 'somLenta', maxCount: 1 },
    { name: 'somAcelerando', maxCount: 1 }
]);

function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
        return next();
    }
    res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
}

const uploadFileToStorage = async (file, folder) => {
    if (!file) return null;
    const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;
    const fileUpload = bucket.file(fileName);
    const blobStream = fileUpload.createWriteStream({
        metadata: { contentType: file.mimetype }
    });
    return new Promise((resolve, reject) => {
        blobStream.on('error', error => reject(error));
        blobStream.on('finish', () => {
            fileUpload.makePublic().then(() => {
                resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
            });
        });
        blobStream.end(file.buffer);
    });
};


// 5. ROTAS DA API PÚBLICA E DE AUTENTICAÇÃO
const usersCollection = db.collection('users');
const productsCollection = db.collection('products');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/check-admin', async (req, res) => {
    try {
        const snapshot = await usersCollection.limit(1).get();
        res.json({ adminExists: !snapshot.empty });
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const snapshot = await productsCollection.orderBy('createdAt', 'desc').get();
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao ler os produtos.' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const snapshot = await usersCollection.limit(1).get();
        if (!snapshot.empty) {
            return res.status(403).json({ message: 'Um administrador já está cadastrado.' });
        }
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
        }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await usersCollection.add({ username, password: hashedPassword });
        res.status(201).json({ message: 'Administrador cadastrado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor ao registrar.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const snapshot = await usersCollection.where('username', '==', username).limit(1).get();
        if (snapshot.empty) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const userDoc = snapshot.docs[0];
        const user = userDoc.data();
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

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { return res.status(500).json({ message: 'Não foi possível fazer logout.' }); }
        res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
});


// 6. ROTAS PROTEGIDAS (CRUD de Produtos)

// [POST] /api/products - Cria um novo produto com múltiplas mídias
app.post('/api/products', isAuthenticated, uploadFields, async (req, res) => {
    try {
        const { marca, modelo, ano, nomeProduto, descricao, preco, videoURL } = req.body;
        const files = req.files;

        if (!marca || !modelo || !ano || !nomeProduto || !preco || !files || !files['imagemURL1']) {
            return res.status(400).json({ message: 'Campos obrigatórios (incluindo imagem principal) não foram preenchidos.' });
        }
        
        const [
            imagemURL1, imagemURL2, imagemURL3,
            somOriginal, somLenta, somAcelerando
        ] = await Promise.all([
            uploadFileToStorage(files.imagemURL1 ? files.imagemURL1[0] : null, 'images'),
            uploadFileToStorage(files.imagemURL2 ? files.imagemURL2[0] : null, 'images'),
            uploadFileToStorage(files.imagemURL3 ? files.imagemURL3[0] : null, 'images'),
            uploadFileToStorage(files.somOriginal ? files.somOriginal[0] : null, 'sounds'),
            uploadFileToStorage(files.somLenta ? files.somLenta[0] : null, 'sounds'),
            uploadFileToStorage(files.somAcelerando ? files.somAcelerando[0] : null, 'sounds')
        ]);

        const newProduct = {
            marca, modelo, nomeProduto, descricao,
            ano: ano.split(',').map(a => parseInt(a.trim(), 10)).filter(a => !isNaN(a)),
            preco: parseFloat(preco),
            videoURL: videoURL || null,
            imagemURL1, imagemURL2, imagemURL3,
            somOriginal, somLenta, somAcelerando,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await productsCollection.add(newProduct);
        res.status(201).json({ id: docRef.id, ...newProduct });

    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar produto.' });
    }
});

// [PUT] /api/products/:id - Atualiza um produto existente com múltiplas mídias
app.put('/api/products/:id', isAuthenticated, uploadFields, async (req, res) => {
    try {
        const productId = req.params.id;
        const docRef = productsCollection.doc(productId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const { marca, modelo, ano, nomeProduto, descricao, preco, videoURL } = req.body;
        const files = req.files;
        const updateData = {};

        if (marca) updateData.marca = marca;
        if (modelo) updateData.modelo = modelo;
        if (nomeProduto) updateData.nomeProduto = nomeProduto;
        if (descricao) updateData.descricao = descricao;
        if (preco) updateData.preco = parseFloat(preco);
        if (ano) updateData.ano = ano.split(',').map(a => parseInt(a.trim(), 10)).filter(a => !isNaN(a));
        if (videoURL !== undefined) updateData.videoURL = videoURL || null;

        if (files.imagemURL1) updateData.imagemURL1 = await uploadFileToStorage(files.imagemURL1[0], 'images');
        if (files.imagemURL2) updateData.imagemURL2 = await uploadFileToStorage(files.imagemURL2[0], 'images');
        if (files.imagemURL3) updateData.imagemURL3 = await uploadFileToStorage(files.imagemURL3[0], 'images');
        if (files.somOriginal) updateData.somOriginal = await uploadFileToStorage(files.somOriginal[0], 'sounds');
        if (files.somLenta) updateData.somLenta = await uploadFileToStorage(files.somLenta[0], 'sounds');
        if (files.somAcelerando) updateData.somAcelerando = await uploadFileToStorage(files.somAcelerando[0], 'sounds');
        
        await docRef.update(updateData);
        res.status(200).json({ message: 'Produto atualizado com sucesso.' });

    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar produto.' });
    }
});

// [DELETE] /api/products/:id - Exclui um produto e todas as suas mídias
app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
        const productId = req.params.id;
        const docRef = productsCollection.doc(productId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const productData = doc.data();
        
        const fileUrls = [
            productData.imagemURL1, productData.imagemURL2, productData.imagemURL3,
            productData.somOriginal, productData.somLenta, productData.somAcelerando
        ];

        for (const url of fileUrls) {
            if (url) {
                try {
                    const fileName = decodeURIComponent(url.split('/o/')[1].split('?')[0]);
                    await bucket.file(fileName).delete();
                } catch (err) {
                    console.error(`Falha ao deletar arquivo do Storage: ${url}`, err.message);
                }
            }
        }

        await docRef.delete();
        res.status(200).json({ message: 'Produto excluído com sucesso.' });

    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir produto.' });
    }
});


// 7. INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor Turboost rodando na porta ${PORT} com integração Firebase.`);
});
