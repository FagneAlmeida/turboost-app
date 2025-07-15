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
                    if (!mobileMenu.classList.contains('-translate-y-[150%]')) {
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

        // Listeners do Modal de Detalhes
        closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
        detailsModalOverlay.addEventListener('click', closeDetailsModal);
    }

    function toggleMobileMenu() {
        const isOpen = mobileMenu.classList.toggle('-translate-y-[150%]');
        mobileMenu.classList.toggle('translate-y-0', !isOpen);
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

        // Adiciona listeners aos novos botões
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
    // (As funções de filtro permanecem as mesmas)
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
        // ... (código existente)
    }

    function handleModeloChange() {
        // ... (código existente)
    }

    function handleSearch() {
        // ... (código existente)
    }

    // --- LÓGICA DO MODAL DE DETALHES ---
    function openDetailsModal(product) {
        modalProductTitle.textContent = product.nomeProduto;
        modalProductDescription.textContent = product.descricao;
        modalProductPrice.textContent = `R$ ${product.preco.toFixed(2).replace('.', ',')}`;
        
        // Limpa a galeria anterior
        modalThumbnails.innerHTML = '';
        modalVideoContainer.innerHTML = '';
        modalVideoContainer.classList.add('hidden');
        modalMainImage.parentElement.classList.remove('hidden');

        // Adiciona o botão do carrinho com o ID correto
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
                showMedia(item, thumb); // Mostra o primeiro item por padrão
            }
        });

        detailsModalOverlay.classList.add('open');
        detailsModal.classList.add('open');
    }

    function closeDetailsModal() {
        detailsModalOverlay.classList.remove('open');
        detailsModal.classList.remove('open');
        // Para o vídeo do YouTube se estiver tocando
        modalVideoContainer.innerHTML = '';
    }

    function showMedia(item, activeThumb) {
        // Atualiza a miniatura ativa
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
            modalVideoContainer.innerHTML = ''; // Para o vídeo
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
    // (As funções do carrinho permanecem as mesmas)
    function handleAddToCart(event) {
        // ... (código existente)
    }
    // ... (resto das funções do carrinho) ...


    // --- LÓGICA DA GALERIA DE SONS ---
    // (As funções da galeria de som permanecem as mesmas)
    function setupSoundButtonListeners() {
        // ... (código existente)
    }
    // ... (resto das funções de som) ...


    // --- INICIALIZAÇÃO ---
    function init() {
        setupEventListeners();
        setupSoundButtonListeners();
        carregarProdutos();
        // renderCart(); // Descomente se precisar
        updateYear();
    }

    init();
});
