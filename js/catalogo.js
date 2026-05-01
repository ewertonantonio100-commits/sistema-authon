// ============================================================
// catalogo.js — Catálogo, Estoque, Onboarding de Catálogo
// ============================================================

// ── TOGGLE TIPO (Produto / Serviço) ──
window.toggleCatType = function (type) {
    document.getElementById('catType').value = type;
    const divStock = document.getElementById('div-stock-input');
    if (divStock) divStock.style.display = (type === 'produto' && window.VERSAO_COM_ESTOQUE) ? 'block' : 'none';
    document.getElementById('btn-type-prod').className = type === 'produto' ? 'op-btn active venda'      : 'op-btn';
    document.getElementById('btn-type-serv').className = type === 'servico' ? 'op-btn active agendamento' : 'op-btn';
};


// ── SALVAR ITEM ──
window.saveCatalogItem = async function () {
    const user = window.auth?.currentUser;
    if (!user) { Toast.error('Não logado.'); return; }

    const type      = document.getElementById('catType').value;
    const code      = document.getElementById('catCode').value       || 'S/N';
    const category  = document.getElementById('catCategory').value   || 'Geral';
    const name      = document.getElementById('catName').value?.trim();
    const price     = document.getElementById('catPrice').value;
    const stock     = document.getElementById('catStock').value;
    const editDocId = document.getElementById('catFirebaseDocId').value;

    if (!name) { Toast.warning('Digite o nome do item.'); return; }

    const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    if (code && code.toUpperCase() !== 'S/N') {
        const exists = cat.find(item => item.code === code);
        if (exists && exists.docId !== editDocId) {
            Toast.error(`Código "${code}" já está sendo usado em "${exists.name}".`);
            return;
        }
    }

    const finalStock = (window.VERSAO_COM_ESTOQUE && type === 'produto' && stock) ? parseInt(stock) : null;
    const itemData   = { uid: user.uid, type, code, category, name, price, stock: finalStock };

    const btn = document.getElementById('btn-save-catalog');
    window.setLoading(btn, true, 'Salvando...');

    try {
        if (editDocId) {
            await window.updateDoc(window.doc(window.db, 'catalogo', editDocId), itemData);
            Toast.success('Produto atualizado!');
            document.getElementById('catFirebaseDocId').value = '';
        } else {
            await window.addDoc(window.collection(window.db, 'catalogo'), itemData);
            Toast.success('Item salvo no catálogo!');
        }
        _clearCatalogForm();
    } catch (e) {
        console.error(e);
        Toast.error('Erro ao salvar: ' + e.message);
    }

    window.setLoading(btn, false, 'Salvar no Catálogo');
};

function _clearCatalogForm() {
    ['catName','catCode','catPrice','catStock','catalogEditIdx','catFirebaseDocId']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}


// ── EDITAR ITEM ──
window.editCatalogItem = function (idx) {
    if (localStorage.getItem('authon_mode_locked') === 'true') {
        Toast.error('Bloqueado para funcionários.');
        return;
    }
    const cat  = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const item = cat[idx];
    if (!item) return;

    document.getElementById('catType').value = item.type;
    window.toggleCatType(item.type);
    document.getElementById('catCode').value          = item.code;
    document.getElementById('catCategory').value      = item.category;
    document.getElementById('catName').value          = item.name;
    document.getElementById('catPrice').value         = item.price;
    document.getElementById('catStock').value         = item.stock !== null ? item.stock : '';
    document.getElementById('catFirebaseDocId').value = item.docId;
    document.getElementById('catalogEditIdx').value   = idx;

    document.querySelector('#tab-catalog .container')?.scrollIntoView({ behavior: 'smooth' });
    Toast.info(`Editando: ${item.name}. Altere e salve.`);
};


// ── EXCLUIR ITEM ──
window.delCatalog = async function (idx) {
    if (localStorage.getItem('authon_mode_locked') === 'true') {
        Toast.error('Bloqueado para funcionários.');
        return;
    }
    const cat  = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const item = cat[idx];
    if (!item?.docId) return;

    Confirm(`Excluir "${item.name}" do catálogo?`, async () => {
        try {
            await window.deleteDoc(window.doc(window.db, 'catalogo', item.docId));
            Toast.success('Item excluído!');
        } catch (e) {
            Toast.error('Erro ao excluir.');
        }
    });
};


// ── RENDER LISTA ──
window.renderCatalogList = function () {
    const cat       = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const div       = document.getElementById('catalog-list');
    if (!div) return;
    const term      = (document.getElementById('catalogSearch')?.value || '').toLowerCase();
    div.innerHTML   = '';

    const filtered  = cat.filter(c => {
        const full = `${c.name} ${c.code} ${c.category}`.toLowerCase();
        return !term || full.includes(term);
    });

    if (!filtered.length) {
        div.innerHTML = `
            <div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
                <i class="fas fa-box-open" style="font-size:40px;display:block;margin-bottom:12px;"></i>
                <div style="font-size:14px;font-weight:600;">Catálogo vazio</div>
                <div style="font-size:12px;margin-top:5px;">Adicione serviços e produtos acima</div>
            </div>`;
        return;
    }

    // ── ALERTAS DE ESTOQUE BAIXO / ZERADO ──
    const zerados = cat.filter(c => c.type === 'produto' && c.stock !== null && c.stock <= 0);
    const baixos  = cat.filter(c => c.type === 'produto' && c.stock !== null && c.stock > 0 && c.stock < 6);

    if (!term && (zerados.length > 0 || baixos.length > 0)) {
        let alertHtml = '';

        if (zerados.length > 0) {
            alertHtml += `
            <div style="background:#fff0f0;border:1px solid #ffd5d5;border-radius:14px;
                        padding:14px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
                <div style="width:36px;height:36px;background:#e74c3c;border-radius:10px;
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-exclamation-triangle" style="color:white;font-size:15px;"></i>
                </div>
                <div>
                    <div style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:800;color:#e74c3c;margin-bottom:4px;">
                        ⛔ ${zerados.length} produto${zerados.length > 1 ? 's' : ''} ESGOTADO${zerados.length > 1 ? 'S' : ''}
                    </div>
                    <div style="font-family:'Poppins',sans-serif;font-size:11px;color:#c0392b;line-height:1.5;">
                        ${zerados.map(c => `<strong>${c.name}</strong>`).join(', ')}
                    </div>
                </div>
            </div>`;
        }

        if (baixos.length > 0) {
            alertHtml += `
            <div style="background:#fff8e8;border:1px solid #fde8b0;border-radius:14px;
                        padding:14px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
                <div style="width:36px;height:36px;background:#f39c12;border-radius:10px;
                            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-box-open" style="color:white;font-size:15px;"></i>
                </div>
                <div>
                    <div style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:800;color:#f39c12;margin-bottom:4px;">
                        ⚠️ ${baixos.length} produto${baixos.length > 1 ? 's' : ''} com ESTOQUE BAIXO
                    </div>
                    <div style="font-family:'Poppins',sans-serif;font-size:11px;color:#e67e22;line-height:1.5;">
                        ${baixos.map(c => `<strong>${c.name}</strong> (${c.stock} restante${c.stock > 1 ? 's' : ''})`).join(', ')}
                    </div>
                </div>
            </div>`;
        }

        div.innerHTML = alertHtml;
    }

    filtered.forEach((c, idx) => {
        let stockHtml = '';
        if (c.type === 'servico') {
            stockHtml = '<span class="stock-badge stock-ok" style="background:#e1f5fe;color:#0277bd;">Serviço</span>';
        } else if (window.VERSAO_COM_ESTOQUE && c.stock !== null) {
            const cls = c.stock <= 0 ? 'stock-zero' : (c.stock < 6 ? 'stock-low' : 'stock-ok');
            stockHtml = `<span class="stock-badge ${cls}">Estoque: ${c.stock}</span>`;
        }

        const icon = c.type === 'servico'
            ? '<i class="fas fa-wrench" style="color:#0984e3;font-size:14px;"></i>'
            : '<i class="fas fa-box" style="color:#636e72;font-size:14px;"></i>';

        // Borda colorida por status
        const borderColor = c.type === 'servico' ? '#0984e3'
            : c.stock <= 0 ? '#e74c3c'
            : c.stock < 6  ? '#f39c12'
            : '#00b894';

        div.innerHTML += `
        <div class="catalog-item" style="border-left-color:${borderColor};">
            <div style="font-size:13px;flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    ${icon}
                    <strong style="font-size:14px;color:#1e272e;">${c.name}</strong>
                    <small style="color:#b2bec3;">(${c.code})</small>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <span style="background:#f0f3f9;color:#636e72;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;">${c.category}</span>
                    ${stockHtml}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <div style="text-align:right;">
                    <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:#1e272e;">
                        R$ ${parseFloat(c.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button style="width:32px;height:32px;border-radius:8px;border:none;background:#e8f4fd;color:#0984e3;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="editCatalogItem(${idx})">
                        <i class="fas fa-pen" style="font-size:12px;"></i>
                    </button>
                    <button style="width:32px;height:32px;border-radius:8px;border:none;background:#fef0ee;color:#e74c3c;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="delCatalog(${idx})">
                        <i class="fas fa-trash" style="font-size:12px;"></i>
                    </button>
                </div>
            </div>
        </div>`;
    });
};


// ── CATÁLOGO INICIAL (ONBOARDING) ──
window.injectStarterCatalog = async function (user) {
    if (localStorage.getItem('authon_onboarding_done') === 'true') return;
    try {
        const q  = window.query(window.collection(window.db, 'catalogo'), window.where('uid', '==', user.uid));
        const qs = await window.getDocs(q);
        if (!qs.empty) { localStorage.setItem('authon_onboarding_done', 'true'); return; }

        const servicos = [
            { type:'servico', code:'MEC-01', category:'Mecânica',  name:'Troca de Óleo e Filtro',            price:150, stock:null },
            { type:'servico', code:'MEC-02', category:'Mecânica',  name:'Alinhamento e Balanceamento',       price:120, stock:null },
            { type:'servico', code:'MEC-03', category:'Mecânica',  name:'Revisão de Freios',                 price:180, stock:null },
            { type:'servico', code:'MEC-04', category:'Mecânica',  name:'Limpeza de Bicos Injetores',        price:160, stock:null },
            { type:'servico', code:'MEC-05', category:'Mecânica',  name:'Suspensão / Troca de Amortecedores',price:250, stock:null },
            { type:'servico', code:'EST-01', category:'Estética',  name:'Lavagem Detalhada / Premium',       price:80,  stock:null },
            { type:'servico', code:'EST-02', category:'Estética',  name:'Polimento Comercial',               price:350, stock:null },
            { type:'servico', code:'EST-03', category:'Estética',  name:'Higienização Interna (Bancos)',     price:250, stock:null },
            { type:'servico', code:'EST-04', category:'Estética',  name:'Vitrificação de Pintura',           price:800, stock:null },
            { type:'servico', code:'EST-05', category:'Estética',  name:'Cristalização de Vidros',           price:100, stock:null },
        ];

        for (const s of servicos) {
            await window.addDoc(window.collection(window.db, 'catalogo'), { ...s, uid: user.uid });
        }
        localStorage.setItem('authon_onboarding_done', 'true');
        Toast.success('Catálogo inicial criado! Edite os preços conforme sua tabela.');
    } catch (e) {
        console.error('Erro onboarding catálogo:', e);
    }
};

console.log('📦 Catálogo carregado');
