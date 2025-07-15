document.addEventListener('DOMContentLoaded', function() {
    // --- VARIÁVEIS GLOBAIS ---
    let allProducts = [];
    let veiculosParaFiltro = {};
    let cart = JSON.parse(localStorage.getItem('turboostCart')) || [];
    const WHATSAPP_NUMBER = '5551920012581'; // COLOQUE SEU NÚMERO de telefone aqui

    // --- ELEMENTOS DO DOM ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const marcaSelect = document.getElementById('marca-select');
    const modeloSelect = document.getElementById('modelo-select');
    const anoSelect = document.getElementById('ano-select');
    const buscarBtn = document.getElementById('buscar-produtos-btn');
    const productGrid = document.getElementById('product-grid');
    const vitrineTitulo = document.getElementById('vitrine-titulo');
    const yearSpan = document.getElementById('year');
    
    // Elementos do Carrinho
    const cartButton = document.getElementById('cart-button');
    const cartPanel = document.getElementById('cart-panel');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    // Elementos da Galeria de Som
    const btnSomOriginal = document.getElementById('btn-som-original');
    const btnSomLenta = document.getElementById('btn-som-lenta');
    const btnSomAcelerando = document.getElementById('btn-som-acelerando');
    const soundButtons = [btnSomOriginal, btnSomLenta, btnSomAcelerando];
    let currentAudio = null;

    // Elementos do Modal de Detalhes
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
    const modalMainImage = document.getElementById('modal-main-image');
    const modalVideoContainer = document.getElementById('modal-video-container');
    const modalThumbnails = document.getElementById('modal-thumbnails');
    const modalProductTitle = document.getElementById('modal-product-title');
    const modalProductDescription = document.getElementById('modal-product-description');
    const modalProductPrice = document.getElementById('modal-product-price');
    const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');


    // --- FUNÇÕES DE INICIALIZAÇÃO E UI ---
    function setupEventListeners() {
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    if (mobileMenu && !mobileMenu.classList.contains('-translate-y-[150%]')) {
                        toggleMobileMenu();
                    }
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
        
        marcaSelect.addEventListener('change', handleMarcaChange);
        modeloSelect.addEventListener('change', handleModeloChange);
        anoSelect.addEventListener('change', () => buscarBtn.disabled = !anoSelect.value);
        buscarBtn.addEventListener('click', handleSearch);
        
        cartButton.addEventListener('click', openCart);
        closeCartBtn.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        
        if(checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

        closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
        detailsModalOverlay.addEventListener('click', closeDetailsModal);
    }

    function toggleMobileMenu() {
        if (mobileMenu) {
            const isOpen = mobileMenu.classList.toggle('-translate-y-[150%]');
            mobileMenu.classList.toggle('translate-y-0', !isOpen);
        }
    }

    function updateYear() {
        if (yearSpan) {
            yearSpan.textContent = new Date().getFullYear();
        }
    }

    // --- LÓGICA DE PRODUTOS E VITRINE ---
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
            if(productGrid) productGrid.innerHTML = "<p class='text-center text-red-500 col-span-full'>Não foi possível carregar os produtos. Tente novamente mais tarde.</p>";
        }
    }

    function processarProdutosParaFiltro(products) {
        const filtro = {};
        products.forEach(p => {
            if (!filtro[p.marca]) filtro[p.marca] = {};
            if (!filtro[p.marca][p.modelo]) filtro[p.marca][p.modelo] = new Set();
            if (Array.isArray(p.ano)) {
                p.ano.forEach(ano => filtro[p.marca][p.modelo].add(ano));
            }
        });
        for (const marca in filtro) {
            for (const modelo in filtro[marca]) {
                filtro[marca][modelo] = Array.from(filtro[marca][modelo]).sort((a, b) => b - a);
            }
        }
        veiculosParaFiltro = filtro;
    }

    function popularVitrine(products) {
        if(!productGrid) return;
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = "<p class='text-center text-gray-400 col-span-full'>Nenhum produto encontrado para a seleção atual.</p>";
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${product.imagemURL1 || 'https://placehold.co/600x400/1a1a1a/FFC700?text=Imagem+Indisponível'}" alt="${product.nomeProduto}" class="w-full h-56 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/1a1a1a/FFC700?text=Imagem+Indisponível';">
                <div class="p-6 flex-grow flex flex-col">
                    <h3 class="font-anton text-2xl text-white">${product.nomeProduto}</h3>
                    <p class="text-gray-400 my-3 flex-grow">${product.descricao.substring(0, 100)}...</p>
                    <span class="text-3xl font-bold text-accent my-3">R$ ${product.preco.toFixed(2).replace('.', ',')}</span>
                    <div class="mt-auto pt-4 border-t border-gray-700 flex gap-4">
                        <button class="btn btn-outline w-full view-details-btn" data-id="${product.id}">Ver Detalhes</button>
                        <button class="btn btn-accent w-full add-to-cart-btn" data-id="${product.id}">Adicionar</button>
                    </div>
                </div>
            `;
            productGrid.appendChild(card);
        });

        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', handleAddToCart);
        });
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const product = allProducts.find(p => p.id === productId);
                if (product) openDetailsModal(product);
            });
        });
    }

    // --- LÓGICA DOS FILTROS ---
    function popularFiltros() {
        if(!marcaSelect) return;
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
        setSoundButtonsState(null);

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
        
        stopCurrentSound();
        const productForSound = allProducts.find(p => p.marca === marcaSelecionada && p.modelo === modeloSelecionado);
        setSoundButtonsState(productForSound);

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
    }

    function handleSearch() {
        const marca = marcaSelect.value;
        const modelo = modeloSelect.value;
        const ano = parseInt(anoSelect.value, 10);
        const produtosFiltrados = allProducts.filter(p => {
            return p.marca === marca && p.modelo === modelo && Array.isArray(p.ano) && p.ano.includes(ano);
        });
        vitrineTitulo.innerHTML = `Resultados para <span class="text-accent">${marca} ${modelo} ${ano}</span>`;
        popularVitrine(produtosFiltrados);
    }

    // --- LÓGICA DO MODAL DE DETALHES ---
    function openDetailsModal(product) {
        modalProductTitle.textContent = product.nomeProduto;
        modalProductDescription.textContent = product.descricao;
        modalProductPrice.textContent = `R$ ${product.preco.toFixed(2).replace('.', ',')}`;
        
        modalThumbnails.innerHTML = '';
        modalVideoContainer.innerHTML = '';
        modalVideoContainer.classList.add('hidden');
        modalMainImage.parentElement.classList.remove('hidden');

        modalAddToCartBtn.dataset.id = product.id;
        modalAddToCartBtn.onclick = handleAddToCart;

        const mediaItems = [];
        if (product.videoURL) mediaItems.push({ type: 'video', url: product.videoURL });
        if (product.imagemURL1) mediaItems.push({ type: 'image', url: product.imagemURL1 });
        if (product.imagemURL2) mediaItems.push({ type: 'image', url: product.imagemURL2 });
        if (product.imagemURL3) mediaItems.push({ type: 'image', url: product.imagemURL3 });

        mediaItems.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'modal-thumbnail';
            if (item.type === 'video') {
                thumb.classList.add('video-thumb');
                thumb.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg>`;
                thumb.onclick = () => showMedia(item, thumb);
            } else {
                thumb.innerHTML = `<img src="${item.url}" alt="Miniatura do produto" class="w-full h-full object-cover">`;
                thumb.onclick = () => showMedia(item, thumb);
            }
            modalThumbnails.appendChild(thumb);
            if (index === 0) {
                showMedia(item, thumb);
            }
        });

        detailsModalOverlay.classList.add('open');
        detailsModal.classList.add('open');
    }

    function closeDetailsModal() {
        detailsModalOverlay.classList.remove('open');
        detailsModal.classList.remove('open');
        modalVideoContainer.innerHTML = '';
    }

    function showMedia(item, activeThumb) {
        document.querySelectorAll('.modal-thumbnail').forEach(t => t.classList.remove('active'));
        activeThumb.classList.add('active');

        if (item.type === 'video') {
            modalMainImage.parentElement.classList.add('hidden');
            modalVideoContainer.classList.remove('hidden');
            const videoId = getYouTubeID(item.url);
            if (videoId) {
                modalVideoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
        } else {
            modalVideoContainer.classList.add('hidden');
            modalVideoContainer.innerHTML = '';
            modalMainImage.parentElement.classList.remove('hidden');
            modalMainImage.src = item.url;
        }
    }

    function getYouTubeID(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    // --- LÓGICA DO CARRINHO ---
    function handleAddToCart(event) {
        const productId = event.currentTarget.dataset.id;
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
        const productId = event.currentTarget.dataset.id;
        cart = cart.filter(item => item.id !== productId);
        saveCartAndRender();
    }
    
    function saveCartAndRender() {
        localStorage.setItem('turboostCart', JSON.stringify(cart));
        renderCart();
    }

    function renderCart() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-gray-400 text-center">Seu carrinho está vazio.</p>';
        } else {
            cart.forEach(item => {
                const cartItemEl = document.createElement('div');
                cartItemEl.className = 'cart-item';
                cartItemEl.innerHTML = `
                    <img src="${item.imagemURL1 || 'https://placehold.co/100x100/1a1a1a/FFC700?text=Img'}" alt="${item.nomeProduto}" onerror="this.onerror=null;this.src='https://placehold.co/100x100/1a1a1a/FFC700?text=Img';">
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
        
        if(checkoutBtn) checkoutBtn.disabled = cart.length === 0;
    }

    function openCart() {
        if(cartPanel) cartPanel.classList.add('open');
        if(cartOverlay) cartOverlay.classList.add('open');
    }

    function closeCart() {
        if(cartPanel) cartPanel.classList.remove('open');
        if(cartOverlay) cartOverlay.classList.remove('open');
    }

    function handleCheckout() {
        if (cart.length === 0) return;
        let message = "Olá! Gostaria de fazer um pedido com os seguintes itens:\n\n";
        cart.forEach(item => {
            message += `*${item.quantity}x ${item.nomeProduto}* - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
        });
        const totalPrice = cart.reduce((sum, item) => sum + (item.preco * item.quantity), 0);
        message += `\n*Total:* R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    // --- LÓGICA DA GALERIA DE SONS ---
    function setSoundButtonsState(product) {
        const iconHTML = `<div class="wave-bar" style="animation-delay: 0.1s;"></div><div class="wave-bar" style="animation-delay: 0.2s;"></div><div class="wave-bar" style="animation-delay: 0.3s;"></div>`;
        btnSomOriginal.querySelector('.sound-wave-icon').innerHTML = iconHTML;
        btnSomLenta.querySelector('.sound-wave-icon').innerHTML = iconHTML;
        btnSomAcelerando.querySelector('.sound-wave-icon').innerHTML = iconHTML;

        btnSomOriginal.disabled = !product?.somOriginal;
        btnSomLenta.disabled = !product?.somLenta;
        btnSomAcelerando.disabled = !product?.somAcelerando;
    }

    function stopCurrentSound() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        soundButtons.forEach(btn => btn.classList.remove('playing'));
    }

    function playSound(audioPath, buttonElement) {
        if (buttonElement.classList.contains('playing')) {
            stopCurrentSound();
            return;
        }
        stopCurrentSound();
        if (audioPath) {
            currentAudio = new Audio(audioPath);
            currentAudio.play().catch(e => console.error("Erro ao tocar áudio:", e));
            buttonElement.classList.add('playing');
            currentAudio.addEventListener('ended', stopCurrentSound);
        }
    }
    
    function setupSoundButtonListeners() {
        const getSelectedProductAndPlay = (soundKey, button) => {
            const marca = marcaSelect.value;
            const modelo = modeloSelect.value;
            if (!marca || !modelo) return;
            const product = allProducts.find(p => p.marca === marca && p.modelo === modelo);
            if (product && product[soundKey]) {
                playSound(product[soundKey], button);
            }
        };

        btnSomOriginal.addEventListener('click', (e) => getSelectedProductAndPlay('somOriginal', e.currentTarget));
        btnSomLenta.addEventListener('click', (e) => getSelectedProductAndPlay('somLenta', e.currentTarget));
        btnSomAcelerando.addEventListener('click', (e) => getSelectedProductAndPlay('somAcelerando', e.currentTarget));
    }

    // --- INICIALIZAÇÃO ---
    function init() {
        setupEventListeners();
        setupSoundButtonListeners();
        carregarProdutos();
        renderCart();
        updateYear();
    }

    init();
});
