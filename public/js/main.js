document.addEventListener('DOMContentLoaded', function() {
    // --- VARIÁVEIS GLOBAIS ---
    let allProducts = [];
    let veiculosParaFiltro = {};
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];
    const WHATSAPP_NUMBER = '5551995470868'; // Número de telefone para o checkout

    // --- ELEMENTOS DO DOM ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const heroCtaButton = document.getElementById('hero-cta-button');
    const marcaSelect = document.getElementById('marca-select');
    const modeloSelect = document.getElementById('modelo-select');
    const anoSelect = document.getElementById('motor-select');
    const buscarBtn = document.getElementById('buscar-produtos-btn');
    const productGrid = document.getElementById('product-grid');
    const vitrineTitulo = document.getElementById('vitrine-titulo');
    const cartButton = document.getElementById('cart-button');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const contactForm = document.getElementById('contact-form');
    const yearSpan = document.getElementById('year');
    const btnSomOriginal = document.getElementById('btn-som-original');
    const btnSomLenta = document.getElementById('btn-som-lenta');
    const btnSomAcelerando = document.getElementById('btn-som-acelerando');
    const soundButtons = [btnSomOriginal, btnSomLenta, btnSomAcelerando];
    let currentSynth = null;
    let soundStopTimeout = null;
    
    // --- BIBLIOTECA DE SONS (SIMULAÇÃO) ---
    const bibliotecaSons = {
        'MT-09': {
            original: () => new Tone.NoiseSynth({ noise: { type: 'brown', playbackRate: 0.5 }, envelope: { attack: 0.1, decay: 0.3, sustain: 0.2, release: 0.1 } }).toDestination(),
            lenta: () => new Tone.NoiseSynth({ noise: { type: 'brown', playbackRate: 0.8 }, envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.1 } }).toDestination(),
            acelerando: (synth) => {
                synth.envelope.attack = 0.01;
                synth.noise.playbackRate.rampTo(5, 1.5);
                synth.triggerAttackRelease("1.5s");
            }
        },
        'S 1000 RR': {
            original: () => new Tone.NoiseSynth({ noise: { type: 'pink', playbackRate: 0.6 }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.1, release: 0.1 } }).toDestination(),
            lenta: () => new Tone.NoiseSynth({ noise: { type: 'pink', playbackRate: 1.2 }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.1 } }).toDestination(),
            acelerando: (synth) => {
                synth.envelope.attack = 0.01;
                synth.noise.playbackRate.rampTo(8, 1.2);
                synth.triggerAttackRelease("1.2s");
            }
        },
        'Interceptor 650': {
            original: () => new Tone.NoiseSynth({ noise: { type: 'brown', playbackRate: 0.3 }, envelope: { attack: 0.2, decay: 0.5, sustain: 0.3, release: 0.2 } }).toDestination(),
            lenta: () => new Tone.NoiseSynth({ noise: { type: 'brown', playbackRate: 0.5 }, envelope: { attack: 0.1, decay: 0.4, sustain: 0.5, release: 0.2 } }).toDestination(),
            acelerando: (synth) => {
                synth.envelope.attack = 0.05;
                synth.noise.playbackRate.rampTo(3, 2);
                synth.triggerAttackRelease("2s");
            }
        }
    };

    // --- FUNÇÕES DE INICIALIZAÇÃO E UI ---
    function setupEventListeners() {
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
        document.querySelectorAll('#mobile-menu a').forEach(link => link.addEventListener('click', toggleMobileMenu));
        if (heroCtaButton) heroCtaButton.addEventListener('click', smoothScroll);
        
        marcaSelect.addEventListener('change', handleMarcaChange);
        modeloSelect.addEventListener('change', handleModeloChange);
        anoSelect.addEventListener('change', () => buscarBtn.disabled = !anoSelect.value);
        buscarBtn.addEventListener('click', handleSearch);
        
        cartButton.addEventListener('click', openCart);
        closeCartBtn.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        
        contactForm.addEventListener('submit', handleContactSubmit);
        
        btnSomOriginal.addEventListener('click', (e) => playSound(modeloSelect.value, 'original', e.currentTarget));
        btnSomLenta.addEventListener('click', (e) => playSound(modeloSelect.value, 'lenta', e.currentTarget));
        btnSomAcelerando.addEventListener('click', (e) => playSound(modeloSelect.value, 'acelerando', e.currentTarget));

        checkoutBtn.addEventListener('click', handleCheckout);
    }

    function toggleMobileMenu() {
        mobileMenu.classList.toggle('translate-y-0');
        mobileMenu.classList.toggle('-translate-y-[150%]');
    }

    function smoothScroll(event) {
        event.preventDefault();
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function updateYear() {
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
    }

    // --- LÓGICA DE PRODUTOS ---
    async function carregarProdutos() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allProducts = await response.json();
            processarProdutosParaFiltro(allProducts);
            popularFiltros();
            popularVitrine(allProducts);
        } catch (error) {
            console.error("Falha ao carregar produtos:", error);
            productGrid.innerHTML = "<p class='text-center text-red-500 col-span-full'>Não foi possível carregar os produtos.</p>";
        }
    }

    function processarProdutosParaFiltro(products) {
        const filtro = {};
        products.forEach(p => {
            if (!filtro[p.marca]) filtro[p.marca] = {};
            if (!filtro[p.marca][p.modelo]) filtro[p.marca][p.modelo] = new Set();
            p.ano.forEach(ano => filtro[p.marca][p.modelo].add(ano));
        });
        for (const marca in filtro) {
            for (const modelo in filtro[marca]) {
                filtro[marca][modelo] = Array.from(filtro[marca][modelo]).sort((a, b) => b - a);
            }
        }
        veiculosParaFiltro = filtro;
    }

    function popularVitrine(products) {
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = "<p class='text-center text-gray-400 col-span-full'>Nenhum produto encontrado.</p>";
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${product.imagemURL}" alt="${product.nomeProduto}" class="w-full h-56 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/1a1a1a/FFC700?text=Imagem+Indisponível';">
                <div class="p-6 flex-grow flex flex-col">
                    <h3 class="font-anton text-2xl text-white">${product.nomeProduto}</h3>
                    <p class="text-gray-400 my-3 flex-grow">${product.descricao}</p>
                    <span class="text-3xl font-bold text-accent my-3">R$ ${product.preco.toFixed(2).replace('.', ',')}</span>
                    <div class="mt-auto pt-4 border-t border-gray-700 flex gap-4">
                        <button class="btn btn-outline w-full">Ver Detalhes</button>
                        <button class="btn btn-accent w-full add-to-cart-btn" data-id="${product.id}">Adicionar</button>
                    </div>
                </div>
            `;
            productGrid.appendChild(card);
        });
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', handleAddToCart);
        });
    }

    function popularFiltros() {
        const marcas = Object.keys(veiculosParaFiltro).sort();
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca;
            option.textContent = marca;
            marcaSelect.appendChild(option);
        });
    }
    
    function resetSelect(selectElem, defaultText) {
        selectElem.innerHTML = `<option value="">${defaultText}</option>`;
        selectElem.disabled = true;
    }

    function handleMarcaChange() {
        const marcaSelecionada = marcaSelect.value;
        resetSelect(modeloSelect, 'Selecione o Modelo');
        resetSelect(anoSelect, 'Selecione o Ano');
        buscarBtn.disabled = true;
        if (marcaSelecionada) {
            modeloSelect.disabled = false;
            const modelos = Object.keys(veiculosParaFiltro[marcaSelecionada]).sort();
            modelos.forEach(modelo => {
                const option = document.createElement('option');
                option.value = modelo;
                option.textContent = modelo;
                modeloSelect.appendChild(option);
            });
        }
    }

    function handleModeloChange() {
        const marcaSelecionada = marcaSelect.value;
        const modeloSelecionado = modeloSelect.value;
        resetSelect(anoSelect, 'Selecione o Ano');
        buscarBtn.disabled = true;
        if (modeloSelecionado) {
            anoSelect.disabled = false;
            const anos = veiculosParaFiltro[marcaSelecionada][modeloSelecionado];
            anos.forEach(ano => {
                const option = document.createElement('option');
                option.value = ano;
                option.textContent = ano;
                anoSelect.appendChild(option);
            });
        }
        stopCurrentSound();
        setSoundButtonsState(modeloSelecionado && bibliotecaSons[modeloSelecionado]);
    }

    function handleSearch() {
        const marca = marcaSelect.value;
        const modelo = modeloSelect.value;
        const ano = parseInt(anoSelect.value, 10);
        const produtosFiltrados = allProducts.filter(p => {
            return p.marca === marca && p.modelo === modelo && p.ano.includes(ano);
        });
        vitrineTitulo.innerHTML = `Resultados para <span class="text-accent">${marca} ${modelo}</span>`;
        popularVitrine(produtosFiltrados);
    }

    // --- LÓGICA DO CARRINHO ---
    function handleAddToCart(event) {
        const productId = parseInt(event.target.dataset.id);
        const productToAdd = allProducts.find(p => p.id === productId);
        if (productToAdd) {
            const existingItem = cart.find(item => item.id === productId);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({ ...productToAdd, quantity: 1 });
            }
            saveCartAndRender();
            openCart();
        }
    }

    function handleRemoveFromCart(event) {
        const productId = parseInt(event.target.dataset.id);
        cart = cart.filter(item => item.id !== productId);
        saveCartAndRender();
    }
    
    function saveCartAndRender() {
        localStorage.setItem('turboostCart', JSON.stringify(cart));
        renderCart();
    }

    function renderCart() {
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-gray-400 text-center">Seu carrinho está vazio.</p>';
        } else {
            cart.forEach(item => {
                const cartItemEl = document.createElement('div');
                cartItemEl.className = 'cart-item';
                cartItemEl.innerHTML = `
                    <img src="${item.imagemURL}" alt="${item.nomeProduto}" onerror="this.onerror=null;this.src='https://placehold.co/100x100/1a1a1a/FFC700?text=Img';">
                    <div class="cart-item-details">
                        <h4>${item.nomeProduto}</h4>
                        <p>R$ ${item.preco.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <button class="remove-btn" data-id="${item.id}">&times;</button>
                `;
                cartItemsContainer.appendChild(cartItemEl);
            });
            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', handleRemoveFromCart);
            });
        }
        
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        cartCount.textContent = totalItems;
        cartTotal.textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
        
        checkoutBtn.disabled = cart.length === 0;
    }

    function openCart() {
        cartPanel.classList.add('open');
        cartOverlay.classList.add('open');
    }

    function closeCart() {
        cartPanel.classList.remove('open');
        cartOverlay.classList.remove('open');
    }

    // --- LÓGICA DO CHECKOUT ---
    function handleCheckout() {
        if (cart.length === 0) {
            alert('Seu carrinho está vazio!');
            return;
        }

        let message = "Olá! Gostaria de fazer um pedido com os seguintes itens:\n\n";
        cart.forEach(item => {
            message += `*${item.quantity}x ${item.nomeProduto}* - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
        });
        const totalPrice = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        message += `\n*Total:* R$ ${totalPrice.toFixed(2).replace('.', ',')}`;

        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        
        window.open(whatsappUrl, '_blank');

        cart = [];
        saveCartAndRender();
        closeCart();
    }

    // --- LÓGICA DA GALERIA DE SONS ---
    function stopCurrentSound() {
        if (soundStopTimeout) clearTimeout(soundStopTimeout);
        if (currentSynth) {
            currentSynth.triggerRelease();
            currentSynth.dispose();
            currentSynth = null;
        }
        soundButtons.forEach(btn => btn.classList.remove('playing'));
    }

    function playSound(model, type, buttonElement) {
        stopCurrentSound();
        if (Tone.context.state !== 'running') Tone.start();
        if (bibliotecaSons[model] && bibliotecaSons[model][type]) {
            const isAccelerating = type === 'acelerando';
            const synthType = isAccelerating ? 'lenta' : type;
            currentSynth = bibliotecaSons[model][synthType]();
            if (isAccelerating) {
                bibliotecaSons[model].acelerando(currentSynth);
                soundStopTimeout = setTimeout(stopCurrentSound, 1500);
            } else {
                currentSynth.triggerAttack();
                soundStopTimeout = setTimeout(stopCurrentSound, 3000);
            }
            buttonElement.classList.add('playing');
        }
    }

    function setSoundButtonsState(enabled) {
        soundButtons.forEach(btn => btn.disabled = !enabled);
    }

    // --- LÓGICA DO FORMULÁRIO DE CONTATO ---
    function handleContactSubmit(e) {
        e.preventDefault();
        alert('Mensagem enviada com sucesso! (Simulação)\nObrigado por entrar em contato.');
        contactForm.reset();
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        setupEventListeners();
        carregarProdutos();
        renderCart();
        updateYear();
    }

    init();
});
