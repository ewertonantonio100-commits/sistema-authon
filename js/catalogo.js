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

    filtered.forEach((c, idx) => {
        let stockHtml = '';
        if (c.type === 'servico') {
            stockHtml = '<span class="stock-badge stock-ok" style="background:#e1f5fe;color:#0277bd;">Serviço</span>';
        } else if (window.VERSAO_COM_ESTOQUE && c.stock !== null) {
            const cls = c.stock <= 0 ? 'stock-zero' : (c.stock < 6 ? 'stock-low' : 'stock-ok');
            stockHtml = `<span class="stock-badge ${cls}">Estoque: ${c.stock}</span>`;
        }

        const icon = c.type === 'servico'
            ? '<i class="fas fa-wrench" style="color:#ccc;"></i>'
            : '<i class="fas fa-box" style="color:#ccc;"></i>';

        div.innerHTML += `
        <div class="catalog-item">
            <div style="font-size:13px;">
                ${icon} <strong>${c.name}</strong> <small>(${c.code})</small><br>
                <span style="font-size:10px;background:#f5f5f5;padding:2px 5px;border-radius:4px;">${c.category}</span>
                ${stockHtml}
            </div>
            <div style="display:flex;align-items:center;gap:15px;">
                <strong>R$ ${parseFloat(c.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong>
                <i class="fas fa-edit" style="color:#2980b9;cursor:pointer;" onclick="editCatalogItem(${idx})"></i>
                <i class="fas fa-trash" style="color:var(--primary);cursor:pointer;" onclick="delCatalog(${idx})"></i>
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

