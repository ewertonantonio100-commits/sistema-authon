// ============================================================
// operacoes.js — Vendas, Orçamentos, Histórico, PDF, Pagamento, CRM
// ============================================================

// ── VERSÃO COM ESTOQUE ──
const VERSAO_COM_ESTOQUE = true;

// ── HELPERS LOCAIS ──
async function saveToCloud(col, data) { return window.saveToCloud(col, data); }
async function updateInCloud(col, id, data) { return window.updateInCloud(col, id, data); }

// ── FORMULÁRIO: ITENS ──
window.updateDatalist = function () {
    const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const dl  = document.getElementById('services-datalist');
    if (!dl) return;
    dl.innerHTML = '';
    cat.forEach(c => {
        const opt = document.createElement('option');
        opt.value = `${c.code} - ${c.name} (${c.category})`;
        dl.appendChild(opt);
    });
};

window.onServiceChange = function (input) {
    const row         = input.parentElement.parentElement;
    const valInput    = row.querySelector('.val');
    const qtyInput    = row.querySelector('.qty');
    const warningText = row.querySelector('.stock-warning-text');
    const cat         = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const found       = cat.find(c => `${c.code} - ${c.name} (${c.category})` === input.value);

    input.classList.remove('input-low-stock');
    if (warningText) warningText.style.display = 'none';

    if (found) {
        row.dataset.unitPrice = found.price;
        const qty = parseFloat(qtyInput.value) || 1;
        valInput.value = (found.price * qty).toFixed(2);
        window.calcTotal();

        if (VERSAO_COM_ESTOQUE && found.type === 'produto' && found.stock !== null) {
            row.dataset.stockMax = found.stock;
            if (found.stock <= 0) {
                Toast.error(`ESGOTADO: "${found.name}" tem 0 no estoque.`);
                input.value = ''; valInput.value = ''; window.calcTotal(); return;
            }
            if (found.stock < 6) {
                input.classList.add('input-low-stock');
                if (warningText) { warningText.innerText = `⚠️ RESTAM ${found.stock}!`; warningText.style.display = 'block'; }
            }
        } else { delete row.dataset.stockMax; }
    }
};

window.updateRowTotal = function (qtyInput) {
    const row      = qtyInput.parentElement.parentElement;
    const valInput = row.querySelector('.val');
    const unitPrice = parseFloat(row.dataset.unitPrice);
    if (!isNaN(unitPrice)) {
        const qty = parseFloat(qtyInput.value);
        if (!isNaN(qty)) { valInput.value = (unitPrice * qty).toFixed(2); window.calcTotal(); }
        if (VERSAO_COM_ESTOQUE) {
            const stockMax = row.dataset.stockMax ? parseFloat(row.dataset.stockMax) : null;
            if (stockMax !== null && qty > stockMax) {
                Toast.warning(`Você só tem ${stockMax} em estoque!`);
                qtyInput.value = stockMax;
                valInput.value = (unitPrice * stockMax).toFixed(2);
                window.calcTotal();
            }
        }
    }
};

window.addNewItem = function (desc = '', val = '', qty = 1) {
    const div = document.createElement('div');
    div.className = 'service-row';
    div.innerHTML = `
        <div class="stock-warning-text"></div>
        <div class="input-group"><label>QTD</label><input type="number" class="qty" value="${qty}" min="1" oninput="updateRowTotal(this)"></div>
        <div class="input-group"><label>DESCRIÇÃO</label><input type="text" class="desc" list="services-datalist" placeholder="Buscar..." value="${desc}" onchange="onServiceChange(this)"></div>
        <div class="input-group"><label>TOTAL</label><input type="number" class="val" placeholder="0.00" value="${val}" oninput="calcTotal()"></div>
        <button class="btn-trash" onclick="this.parentElement.remove(); calcTotal()"><i class="fas fa-trash-alt"></i></button>`;
    const list = document.getElementById('services-list');
    if (list) list.appendChild(div);
    if (val && qty) div.dataset.unitPrice = (parseFloat(val) / parseFloat(qty)).toFixed(2);
};

window.calcTotal = function () {
    let t = 0;
    document.querySelectorAll('.val').forEach(i => t += Number(i.value));
    const discount = parseFloat(document.getElementById('discount')?.value) || 0;
    const el = document.getElementById('display-total');
    if (el) el.innerText = (t - discount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};


// ── SALVAR OPERAÇÃO ──
window.saveOperation = async function () {
    const type      = document.getElementById('opType').value;
    const client    = document.getElementById('clientName').value?.trim();
    const totalStr  = document.getElementById('display-total').innerText;
    const totalVal  = parseFloat(totalStr.replace('.', '').replace(',', '.'));
    const discountVal = parseFloat(document.getElementById('discount')?.value) || 0;

    if (!client) { Toast.warning('Preencha o nome do Cliente.'); return; }
    if (type !== 'agendamento' && totalVal <= 0) { Toast.warning('Adicione serviços ou peças para salvar.'); return; }

    const items = [];
    document.querySelectorAll('.service-row').forEach(r => {
        const d = r.querySelector('.desc').value;
        const v = r.querySelector('.val').value;
        const q = r.querySelector('.qty').value;
        if (d) items.push({ desc: d, val: v, qty: q });
    });

    // Baixa no estoque
    if (type === 'venda' && VERSAO_COM_ESTOQUE) {
        const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
        items.forEach(soldItem => {
            const found = cat.find(c => `${c.code} - ${c.name} (${c.category})` === soldItem.desc);
            if (found && found.type === 'produto' && found.stock !== null && found.docId) {
                updateInCloud('catalogo', found.docId, { stock: found.stock - (parseInt(soldItem.qty) || 1) });
            }
        });
    }

    const data = {
        id:        document.getElementById('editId')?.value ? Number(document.getElementById('editId').value) : Date.now(),
        type,
        status:    type === 'agendamento' ? 'agendado' : 'pendente',
        date:      document.getElementById('date')?.value,
        client,
        seller:    document.getElementById('sellerName')?.value || '',
        time:      document.getElementById('time')?.value || '',
        phone:     document.getElementById('phone')?.value || '',
        vehicle:   document.getElementById('vehicle')?.value || '',
        plate:     document.getElementById('plate')?.value || '',
        color:     document.getElementById('color')?.value || '',
        km:        document.getElementById('currentKm')?.value || '',
        cpf:       document.getElementById('clientCpf')?.value || '',
        items,
        signature: window.currentSignatureBase64 || null,
        checklist: window.currentChecklist || { fuel: 'Reserva', damages: {} },
        total:     totalVal, netTotal: totalVal, discount: discountVal,
        payment:   ''
    };

    const btn = document.getElementById('btn-save-op');
    if (btn) window.setLoading(btn, true, 'Salvando...');

    const docId = document.getElementById('firebaseDocId')?.value;
    if (docId) await updateInCloud('operacoes', docId, data);
    else       await saveToCloud('operacoes', data);

    if (window.clearSignature) window.clearSignature();
    window.updateClientDatalist();

    if (type === 'venda') {
        resetForm();
        window.showTab('history');
        Toast.success('Venda salva! Redirecionando para o histórico.');
    } else if (type === 'agendamento') {
        Toast.success('Agendamento salvo com sucesso!');
        resetForm();
        window.showTab('agenda');
    } else {
        generatePDF(data);
    }

    if (btn) window.setLoading(btn, false, 'SALVAR');
};


// ── SET OP TYPE ──
window.setOpType = function (type) {
    document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.op-btn.${type}`);
    if (activeBtn) activeBtn.classList.add('active');
    const opTypeEl = document.getElementById('opType');
    if (opTypeEl) opTypeEl.value = type;
    const btn    = document.querySelector('.btn-gen');
    const divHora = document.getElementById('div-agendamento-info');
    if (type === 'venda')       { if (btn) btn.innerText = 'SALVAR (PENDENTE)';      if (btn) btn.style.background = 'var(--green-grad)';  if (divHora) divHora.style.display = 'none'; }
    else if (type === 'orcamento') { if (btn) btn.innerText = 'GERAR ORÇAMENTO (PDF)';  if (btn) btn.style.background = 'var(--orange-grad)'; if (divHora) divHora.style.display = 'none'; }
    else                        { if (btn) btn.innerText = 'AGENDAR SERVIÇO';        if (btn) btn.style.background = 'var(--blue-grad)';   if (divHora) divHora.style.display = 'block'; }
};

window.toggleFeeInput = function () {
    const payMethod = document.getElementById('payment')?.value || '';
    const divFee    = document.getElementById('div-fee');
    if (!divFee) return;
    if (payMethod.includes('Crédito') || payMethod.includes('Débito')) divFee.style.display = 'block';
    else { divFee.style.display = 'none'; const cf = document.getElementById('cardFee'); if (cf) cf.value = ''; }
};

window.updateClientDatalist = function () {
    const db  = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const dl  = document.getElementById('client-list');
    if (!dl) return;
    dl.innerHTML = '';
    [...new Set(db.map(i => i.client))].forEach(name => {
        if (name) { const opt = document.createElement('option'); opt.value = name; dl.appendChild(opt); }
    });
};

window.fillClientData = function (input) {
    const name = input.value;
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const last = db.find(i => i.client === name);
    if (last) {
        Confirm(`Cliente encontrado! Preencher dados do ${last.vehicle}?`, () => {
            if (document.getElementById('phone'))   document.getElementById('phone').value   = last.phone   || '';
            if (document.getElementById('vehicle')) document.getElementById('vehicle').value = last.vehicle || '';
            if (document.getElementById('plate'))   document.getElementById('plate').value   = last.plate   || '';
            if (document.getElementById('color'))   document.getElementById('color').value   = last.color   || '';
            if (last.cpf && document.getElementById('clientCpf')) document.getElementById('clientCpf').value = last.cpf;
        });
    }
};


// ── RESET FORM ──
window.resetForm = function () {
    ['editId','firebaseDocId','clientName','clientCpf','vehicle','plate','color','phone','currentKm'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const sl = document.getElementById('services-list');
    if (sl) sl.innerHTML = '';
    const dt = document.getElementById('display-total');
    if (dt) dt.innerText = '0,00';
    const disc = document.getElementById('discount');
    if (disc) disc.value = '';
    window.addNewItem();
};


// ── CARREGAR PARA EDITAR ──
window.loadToEdit = function (id, forceVenda = false) {
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const item = db.find(x => x.id == id);
    if (!item) return;

    if (localStorage.getItem('authon_mode_locked') === 'true') {
        if (item.status === 'pago' && !forceVenda) {
            Toast.error('Vendas já PAGAS não podem ser alteradas pelo vendedor.');
            return;
        }
    }

    document.getElementById('editId').value        = item.id;
    document.getElementById('firebaseDocId').value = item.docId;
    document.getElementById('date').value          = item.date;
    document.getElementById('time').value          = item.time || '';
    document.getElementById('phone').value         = item.phone;
    document.getElementById('clientName').value    = item.client;
    if (document.getElementById('sellerName')) document.getElementById('sellerName').value = item.seller || '';
    document.getElementById('vehicle').value       = item.vehicle;
    document.getElementById('plate').value         = item.plate;
    document.getElementById('color').value         = item.color || '';
    document.getElementById('currentKm').value     = item.km   || '';
    document.getElementById('clientCpf').value     = item.cpf  || '';

    document.getElementById('services-list').innerHTML = '';
    item.items?.forEach(i => window.addNewItem(i.desc, i.val, i.qty));
    window.calcTotal();

    if (forceVenda) {
        window.setOpType('venda');
        document.getElementById('date').value = new Date().toLocaleDateString('en-CA');
    } else {
        window.setOpType(item.type);
    }

    window.showTab('new');
};


// ── HISTÓRICO ──
window.renderHistory = function (filter) {
    window.currentHistoryFilter = filter;
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list = document.getElementById('history-list');
    if (!list) return;

    const term   = (document.getElementById('historySearch')?.value || '').toLowerCase();
    const hStart = document.getElementById('histFilterStart')?.value || '';
    const hEnd   = document.getElementById('histFilterEnd')?.value   || '';

    list.innerHTML = '';
    const compName  = localStorage.getItem('authon_cfg_name') || 'SUA OFICINA';
    const savedPix  = localStorage.getItem('authon_cfg_pix') || '';

    let filtered = db.filter(x => x.type !== 'agendamento' && x.type !== 'expense');
    if (filter === 'venda')     filtered = filtered.filter(x => x.type === 'venda');
    if (filter === 'orcamento') filtered = filtered.filter(x => x.type === 'orcamento');
    if (filter === 'pendente')  filtered = filtered.filter(x => x.status === 'pendente');
    if (filter === 'pago')      filtered = filtered.filter(x => x.status === 'pago');
    if (hStart) filtered = filtered.filter(x => x.date >= hStart);
    if (hEnd)   filtered = filtered.filter(x => x.date <= hEnd);
    filtered.sort((a, b) => b.id - a.id);

    if (!document.getElementById('style-soft-pulse')) {
        document.head.insertAdjacentHTML('beforeend', '<style id="style-soft-pulse">@keyframes softPulse{0%{transform:scale(1);box-shadow:0 4px 10px rgba(39,174,96,0.2);}50%{transform:scale(1.02);box-shadow:0 6px 15px rgba(39,174,96,0.6);}100%{transform:scale(1);box-shadow:0 4px 10px rgba(39,174,96,0.2);}}</style>');
    }

    if (!filtered.length) {
        list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
            <i class="fas fa-folder-open" style="font-size:40px;margin-bottom:12px;display:block;"></i>
            <div style="font-size:14px;font-weight:600;">Nenhum registro encontrado</div>
            <div style="font-size:12px;margin-top:5px;">Tente mudar o período ou filtro</div>
        </div>`;
        return;
    }

    filtered.forEach(item => {
        const fullText = (item.client + ' ' + item.vehicle + ' ' + (item.plate || '') + ' ' + item.total).toLowerCase();
        if (term && !fullText.includes(term)) return;

        let badgeClass = '', statusText = item.type.toUpperCase();
        let actionBtn = '', highlightPayBtn = '';

        let priceDisplay = `<div style="font-weight:900;font-size:22px;color:var(--dark);">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`;
        if (item.netTotal && item.netTotal < item.total) {
            priceDisplay = `<div style="font-weight:900;font-size:22px;color:var(--dark);">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                <div style="font-size:11px;color:#c0392b;font-weight:700;margin-top:-2px;">Liq: R$ ${item.netTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`;
        }

        const esc = s => (s || '').replace(/'/g, "\\'");
        const btnAntesDepois = `<button class="btn-card" style="background:#7f8c8d;color:white;flex:1;box-shadow:none;" onclick="openBeforeAfterModal('${esc(item.client)}','${esc(item.vehicle)}','${item.phone}','${esc(item.plate)}')"><i class="fas fa-camera-retro" style="opacity:0.8;"></i> Antes & Depois</button>`;

        if (item.type === 'venda') {
            if (item.status === 'pendente') {
                badgeClass = 'bg-pendente'; statusText = 'PENDENTE';
                let pixText = savedPix ? `\n\n🔑 Chave Pix: ${savedPix}` : '';
                const zapMsg  = `*${compName}* \n--------------------------------\nOlá *${item.client}*, boas notícias! 😃\n\nO serviço no seu *${item.vehicle || 'veículo'}* foi finalizado! ✨\n\n💰 *Total:* R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}${pixText}\n\nJá está liberado para retirada. Fico no aguardo! 🤝`;
                const zapLink = `https://wa.me/55${(item.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(zapMsg)}`;
                actionBtn = `${btnAntesDepois}<button class="btn-card btn-notify" onclick="window.open('${zapLink}')" style="flex:1;"><i class="fab fa-whatsapp"></i> AVISAR</button>`;
                highlightPayBtn = `<button class="btn-action" style="background:var(--green-grad);display:block;width:80%;max-width:260px;margin:15px auto 10px;font-size:13px;padding:12px;border-radius:12px;animation:softPulse 2.5s infinite;" onclick="window.openPayModal('${item.docId}',${item.total})"><i class="fas fa-hand-holding-usd" style="font-size:16px;margin-right:8px;"></i> RECEBER PAGAMENTO</button>`;
            } else {
                badgeClass = 'bg-venda'; statusText = 'PAGO';
                actionBtn = `${btnAntesDepois}`;
            }
        } else { badgeClass = 'bg-orcamento'; }

        let itemsHtml = '<ul style="margin:8px 0 8px 18px;padding:0;font-size:12px;color:#555;">';
        if (item.items?.length > 0) {
            item.items.forEach(i => {
                let d = i.desc;
                if (d.includes(' - ') && d.includes('(')) { try { d = d.split(' - ')[1].split(' (')[0]; } catch(e){} }
                itemsHtml += `<li>${i.qty}x ${d}</li>`;
            });
        } else { itemsHtml += '<li>(Sem itens)</li>'; }
        itemsHtml += '</ul>';

        const plateInfo     = item.plate ? ` | <span style="font-weight:bold;background:#eee;padding:2px 5px;border-radius:4px;">${item.plate.toUpperCase()}</span>` : '';
        const dateFormatted = item.date.split('-').reverse().join('/');

        list.innerHTML += `
        <div class="item-card" style="padding:20px;border-left:6px solid #ccc;position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="font-size:16px;margin:0;color:var(--dark);font-weight:800;">${dateFormatted}</h3>
                <span class="status-badge ${badgeClass}" style="position:static;">${statusText}</span>
            </div>
            <div style="margin-bottom:5px;">
                <div style="font-size:16px;font-weight:600;color:#2c3e50;">${item.client}</div>
                <div style="font-size:12px;color:#7f8c8d;margin-top:3px;line-height:1.4;">${item.vehicle || ''}${plateInfo}<br>${item.phone || ''}</div>
            </div>
            ${itemsHtml}
            <hr style="border:0;border-top:1px dashed #eee;margin:10px 0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;">
                <div style="flex-shrink:0;"><span style="font-size:11px;color:#7f8c8d;font-weight:bold;text-transform:uppercase;">Valor Total:</span>${priceDisplay}</div>
            </div>
            ${highlightPayBtn}
            <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:space-between;margin-top:10px;">
                <div style="display:flex;gap:5px;flex:1;">${actionBtn}</div>
                <div style="display:flex;gap:5px;">
                    <button class="btn-card" style="background:var(--dark);color:white;min-width:35px;" onclick="generatePDFFromHistory(${item.id})"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-card" style="background:#ecf0f1;color:var(--dark);min-width:35px;" onclick="loadToEdit(${item.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-card" style="color:var(--primary);background:#ffebee;min-width:35px;" onclick="deleteItem('${item.docId}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <style>.item-card:has(.bg-venda){border-left-color:#27ae60!important;}.item-card:has(.bg-pendente){border-left-color:#f1c40f!important;}.item-card:has(.bg-orcamento){border-left-color:#95a5a6!important;}</style>
        </div>`;
    });
};

// Filtros histórico
window.histPeriod = function (btn, range) {
    document.querySelectorAll('.hist-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const today = new Date(), s = document.getElementById('histFilterStart'), e = document.getElementById('histFilterEnd');
    if (range === 'today')  { const str = today.toLocaleDateString('en-CA'); s.value = str; e.value = str; }
    else if (range === 'month') { s.value = new Date(today.getFullYear(),today.getMonth(),1).toISOString().split('T')[0]; e.value = new Date(today.getFullYear(),today.getMonth()+1,0).toISOString().split('T')[0]; }
    else { s.value = ''; e.value = ''; }
    window.renderHistory(window.currentHistoryFilter || 'all');
};
window.histStatus = function (btn, filter) {
    document.querySelectorAll('.hist-status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window.renderHistory(filter);
};


// ── EXCLUIR ITEM ──
window.deleteItem = async function (docId) {
    if (localStorage.getItem('authon_mode_locked') === 'true') {
        Toast.error('Funcionários não podem excluir registros.');
        return;
    }
    if (!docId || docId === 'undefined') { Toast.error('Item sem ID. Recarregue a página.'); return; }
    await window.deleteFromCloud('operacoes', docId);
};


// ── MODAL DE PAGAMENTO ──
window.openPayModal = function (docId, totalVal) {
    document.getElementById('modal-pay').style.display = 'flex';
    document.getElementById('modal-pay-value').innerText = 'R$ ' + totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('modal-pay-docid').value  = docId;
    document.getElementById('modal-pay-total').value  = totalVal;
    document.getElementById('modal-pay-select').value = 'Pix';
    window.calculateModalNet();
};

function getFee(key) {
    let val = localStorage.getItem(key) || '0';
    return parseFloat(val.replace(',', '.')) || 0;
}

window.calculateModalNet = function () {
    const total  = parseFloat(document.getElementById('modal-pay-total').value);
    const method = document.getElementById('modal-pay-select').value;
    let rate = 0;
    if (method === 'Débito')     rate = getFee('authon_fee_deb');
    if (method === 'Crédito 1x') rate = getFee('authon_fee_c1');
    if (method === 'Crédito 2x') rate = getFee('authon_fee_c2');
    if (method === 'Crédito 3x') rate = getFee('authon_fee_c3');
    if (method === 'Crédito 4x') rate = getFee('authon_fee_c4');
    if (method === 'Crédito 5x') rate = getFee('authon_fee_c5');
    if (method === 'Crédito 6x') rate = getFee('authon_fee_c6');
    const discount = total * (rate / 100);
    const net      = total - discount;
    const netEl    = document.getElementById('modal-pay-net');
    if (rate > 0) {
        netEl.innerHTML = `Taxa: <b>${rate}%</b> (- R$ ${discount.toLocaleString('pt-BR',{minimumFractionDigits:2})}) <br> Líquido: <b style="color:#27ae60">R$ ${net.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b>`;
        netEl.style.color = '#c0392b';
    } else {
        netEl.innerHTML = `Taxa: 0% | Líquido: <b>R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</b>`;
        netEl.style.color = '#7f8c8d';
    }
};

window.confirmPayment = async function () {
    const docId  = document.getElementById('modal-pay-docid').value;
    const total  = parseFloat(document.getElementById('modal-pay-total').value);
    const method = document.getElementById('modal-pay-select').value;
    let rate = 0;
    if (method === 'Débito')     rate = getFee('authon_fee_deb');
    if (method === 'Crédito 1x') rate = getFee('authon_fee_c1');
    if (method === 'Crédito 2x') rate = getFee('authon_fee_c2');
    if (method === 'Crédito 3x') rate = getFee('authon_fee_c3');
    if (method === 'Crédito 4x') rate = getFee('authon_fee_c4');
    if (method === 'Crédito 5x') rate = getFee('authon_fee_c5');
    if (method === 'Crédito 6x') rate = getFee('authon_fee_c6');
    const netTotal = total - (total * (rate / 100));
    const btn = event?.target;
    if (btn) window.setLoading(btn, true, 'Salvando...');
    await updateInCloud('operacoes', docId, { status: 'pago', payment: method, netTotal, feeRate: rate });
    Toast.success(`Recebimento confirmado! Líquido: R$ ${netTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
    document.getElementById('modal-pay').style.display = 'none';
    if (btn) window.setLoading(btn, false, 'CONFIRMAR RECEBIMENTO');
    window.renderHistory('all');
    window.updateDashboard(true);
};


// ── GERAR PDF ──
window.generatePDF = function (data) {
    document.getElementById('pdf-overlay').style.display = 'block';
    window.currentReceiptData = data;
    document.getElementById('pdf-date').innerText = new Date().toLocaleDateString();

    const compName  = localStorage.getItem('authon_cfg_name')  || 'SUA OFICINA';
    const compCnpj  = localStorage.getItem('authon_cfg_cnpj')  || 'CNPJ não informado';
    const compAddr  = localStorage.getItem('authon_cfg_addr')  || 'Endereço não informado';
    const compPhone = localStorage.getItem('authon_cfg_phone') || '';

    document.getElementById('pdf-comp-name').innerText = compName;
    document.getElementById('pdf-comp-cnpj').innerText = compCnpj;
    document.getElementById('pdf-comp-addr').innerText = compAddr + (compPhone ? ' | ' + compPhone : '');

    let clientText = data.client + (data.phone ? ` - ${data.phone}` : '');
    if (data.cpf) clientText += `<br>CPF/CNPJ: ${data.cpf}`;
    document.getElementById('pdf-client').innerHTML = clientText;
    document.getElementById('pdf-vehicle').innerText = `${data.vehicle || ''} ${data.plate ? data.plate.toUpperCase() : ''} ${data.color || ''}`;

    if (data.km) {
        const interval = parseInt(localStorage.getItem('authon_cfg_km')) || 5000;
        document.getElementById('pdf-km-info').innerHTML = `<br><strong>KM Atual:</strong> ${data.km} | <strong>Próxima Revisão:</strong> ${parseInt(data.km)+interval} km`;
    } else { document.getElementById('pdf-km-info').innerHTML = ''; }

    const chk = data.checklist;
    if (chk && (Object.keys(chk.damages).length > 0 || (chk.fuel && chk.fuel !== 'Reserva'))) {
        let dmgText = 'Nenhuma avaria na lataria/vidros.';
        const dmgKeys = Object.keys(chk.damages);
        if (dmgKeys.length > 0) dmgText = dmgKeys.map(k => `<b>${k}:</b> ${chk.damages[k]}`).join(' | ');
        document.getElementById('pdf-km-info').innerHTML += `<div style="margin-top:10px;padding:10px;background:#fff;border:1px solid #ddd;border-radius:5px;font-size:12px;line-height:1.6;"><strong>📝 INSPEÇÃO PRÉVIA:</strong><br>⛽ Combustível: ${chk.fuel || 'Não inf.'}<br>🚗 Avarias: ${dmgText}</div>`;
    }

    const tbody = document.getElementById('pdf-tbody');
    tbody.innerHTML = '';
    if (data.items?.length > 0) {
        data.items.forEach(i => {
            const qtyStr = i.qty > 1 ? `<strong>${i.qty}x</strong> ` : '';
            let d = i.desc;
            if (d.includes(' - ') && d.includes('(')) { try { d = d.split(' - ')[1].split(' (')[0]; } catch(e){} }
            tbody.innerHTML += `<tr><td>${qtyStr}${d}</td><td>R$ ${parseFloat(i.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`;
        });
    } else { tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:20px;color:#999;">Nenhum item adicionado</td></tr>`; }

    const discEl = document.getElementById('pdf-discount-row');
    const discVal = document.getElementById('pdf-discount-val');
    if (data.discount && data.discount > 0) { discEl.style.display='block'; discVal.innerText='R$ '+parseFloat(data.discount).toLocaleString('pt-BR',{minimumFractionDigits:2}); }
    else { discEl.style.display='none'; }

    const savedPix = localStorage.getItem('authon_cfg_pix');
    const pixRow   = document.getElementById('pdf-pix-row');
    const pixKey   = document.getElementById('pdf-pix-key');
    if (savedPix) { pixRow.style.display='block'; pixKey.innerText=savedPix; } else { pixRow.style.display='none'; }

    const savedWarranty = localStorage.getItem('authon_cfg_warranty');
    const warEl = document.getElementById('pdf-warranty-text');
    if (savedWarranty) { warEl.style.display='block'; warEl.innerText=savedWarranty; } else { warEl.style.display='none'; }

    document.getElementById('pdf-total').innerText          = 'R$ ' + data.total.toLocaleString('pt-BR',{minimumFractionDigits:2});
    document.getElementById('pdf-payment-method').innerText = data.payment || 'À Combinar';
    document.getElementById('pdf-title').innerText = data.type === 'orcamento' ? 'ORÇAMENTO' : data.type === 'agendamento' ? 'AGENDAMENTO' : 'RECIBO / PEDIDO';

    let sigContainer = document.getElementById('pdf-signature-container');
    if (!sigContainer) {
        sigContainer = document.createElement('div');
        sigContainer.id = 'pdf-signature-container';
        sigContainer.style.textAlign = 'center';
        sigContainer.style.marginTop = '30px';
        const warEl2 = document.getElementById('pdf-warranty-text');
        if (warEl2?.parentNode) warEl2.parentNode.appendChild(sigContainer);
    }
    if (data.signature) {
        sigContainer.innerHTML = `<img src="${data.signature}" style="max-width:250px;max-height:100px;display:block;margin:0 auto;mix-blend-mode:multiply;"><div style="border-top:1px solid #333;width:80%;margin:0 auto;padding-top:5px;font-size:14px;font-weight:bold;color:#333;">Assinatura do Cliente</div>`;
        sigContainer.style.display = 'block';
    } else { sigContainer.style.display = 'none'; }

    const savedLogo = localStorage.getItem('oficina_logo');
    const imgEl = document.getElementById('pdf-logo');
    if (savedLogo) { imgEl.src=savedLogo; imgEl.style.display='block'; } else { imgEl.style.display='none'; }

    let text = `*${compName}* \n--------------------------------\nOlá *${data.client}*, segue o detalhamento:\n\n`;
    data.items?.forEach(i => { let d=i.desc; if(d.includes(' - ')&&d.includes('(')){ try{d=d.split(' - ')[1].split(' (')[0];}catch(e){} } text+=`✅ ${i.qty>1?i.qty+'x ':''}${d} - R$ ${i.val}\n`; });
    if (data.discount > 0) text += `\n🎁 Desconto: - R$ ${data.discount.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
    text += `\n--------------------------------\n💰 *TOTAL: R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n\nObrigado pela preferência! 🤝`;
    const btnZap = document.getElementById('btn-whatsapp-send');
    if (btnZap) btnZap.onclick = () => window.open(`https://wa.me/55${(data.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`);
};

window.generatePDFFromHistory = function (id) {
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const item = db.find(x => x.id == id);
    if (item) window.generatePDF(item);
};

window.closePDF = function () {
    document.getElementById('pdf-overlay').style.display = 'none';
    window.resetForm();
};

window.downloadCurrentPDF = function () {
    const element      = document.getElementById('invoice-paper');
    const originalParent = element.parentNode;
    const nextSibling  = element.nextSibling;
    const originalStyle = element.getAttribute('style');
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-safe';
    Object.assign(printContainer.style, { position:'fixed', top:'0', left:'0', width:'794px', height:'100%', backgroundColor:'white', zIndex:'999999999', overflow:'hidden' });
    document.body.appendChild(printContainer);
    printContainer.appendChild(element);
    Object.assign(element.style, { width:'100%', marginLeft:'0', marginRight:'0', padding:'80px 20px 20px 20px', boxShadow:'none', border:'none', maxWidth:'none' });

    function restoreScreen() {
        if (printContainer.contains(element)) {
            if (nextSibling) originalParent.insertBefore(element, nextSibling);
            else originalParent.appendChild(element);
        }
        if (originalStyle) element.setAttribute('style', originalStyle);
        else element.removeAttribute('style');
        const c = document.getElementById('print-container-safe');
        if (c) document.body.removeChild(c);
    }

    const opt = { margin:0, filename:'recibo_authon.pdf', image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true,scrollY:0,windowWidth:794,width:794,x:0,y:0}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} };
    const safetyTimer = setTimeout(() => restoreScreen(), 3500);
    setTimeout(() => {
        html2pdf().set(opt).from(element).save()
            .then(() => { clearTimeout(safetyTimer); restoreScreen(); })
            .catch(err => { console.error(err); clearTimeout(safetyTimer); restoreScreen(); });
    }, 100);
};


// ── IMPRESSORA TÉRMICA ──
window.printThermal = function () {
    const data = window.currentReceiptData;
    if (!data) { Toast.error('Dados do recibo não encontrados.'); return; }
    const compName  = localStorage.getItem('authon_cfg_name')  || 'Nossa Oficina';
    const compCnpj  = localStorage.getItem('authon_cfg_cnpj')  || '';
    const compPhone = localStorage.getItem('authon_cfg_phone') || '';
    const W = 32;
    const center = s => { let t=s.substring(0,W); return ' '.repeat(Math.max(0,Math.floor((W-t.length)/2)))+t+'\n'; };
    const split  = (l,r) => { let lp=l.substring(0,W-r.length-1); return lp+' '.repeat(Math.max(1,W-lp.length-r.length))+r+'\n'; };
    const line   = '-'.repeat(W)+'\n';
    let p = center(compName.toUpperCase());
    if (compCnpj)  p += center(compCnpj);
    if (compPhone) p += center(compPhone);
    p += line + center('RECIBO / '+data.type.toUpperCase()) + line;
    p += 'Data: '+data.date.split('-').reverse().join('/')+'\n';
    p += 'Cliente: '+data.client.substring(0,23)+'\n';
    p += 'Veiculo: '+((data.vehicle||'')+(data.plate?' '+data.plate.toUpperCase():'')).substring(0,23)+'\n';
    p += line + split('QTD DESC','VALOR') + line;
    data.items?.forEach(i => {
        let d=i.desc; if(d.includes(' - ')&&d.includes('(')){ try{d=d.split(' - ')[1].split(' (')[0];}catch(e){} }
        p += split(`${i.qty}x ${d}`,`R$ ${parseFloat(i.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
    });
    p += line;
    if (data.discount>0) p += split('Desconto:',`-R$ ${data.discount.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
    p += split('TOTAL:',`R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`)+line;
    p += center(`Pgto: ${data.payment||'A Combinar'}`);
    const px = localStorage.getItem('authon_cfg_pix');
    if (px && data.status==='pendente') p += '\n'+center(`Pix: ${px}`);
    p += '\n\n'+center('__________________________')+center('Assinatura do Cliente')+'\n\n'+center('Gerado pelo Sistema Authon')+'\n\n';
    try { window.location.href = 'intent:'+encodeURIComponent(p)+'#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;'; }
    catch(e) { window.print(); }
};


// ── CRM ──
window.renderCRM = function () {
    const db         = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list       = document.getElementById('crm-list');
    const daysFilter = parseInt(document.getElementById('crm-days')?.value) || 90;
    const compName   = localStorage.getItem('authon_cfg_name') || 'Nossa Oficina';
    if (!list) return;
    list.innerHTML   = '';

    const clientsMap = {};
    db.filter(x => x.type === 'venda' || x.type === 'orcamento').forEach(op => {
        if (!op.client || !op.phone) return;
        const d = new Date(op.date + 'T12:00:00');
        if (!clientsMap[op.client]) clientsMap[op.client] = { lastDate: d, phone: op.phone, vehicle: op.vehicle || 'Veículo', count: 1 };
        else { if (d > clientsMap[op.client].lastDate) { clientsMap[op.client].lastDate = d; clientsMap[op.client].phone = op.phone; } clientsMap[op.client].count++; }
    });

    const today = new Date();
    const inactive = Object.entries(clientsMap)
        .filter(([, c]) => Math.floor((today - c.lastDate) / 86400000) >= daysFilter)
        .sort((a, b) => a[1].lastDate - b[1].lastDate);

    if (!inactive.length) { list.innerHTML = `<div style="text-align:center;padding:40px;color:#bdc3c7;"><i class="fas fa-smile-beam" style="font-size:40px;display:block;margin-bottom:10px;"></i><div style="font-size:14px;font-weight:600;">Nenhum cliente inativo</div><div style="font-size:12px;margin-top:5px;">Todos retornaram nos últimos ${daysFilter} dias!</div></div>`; return; }

    inactive.forEach(([name, c]) => {
        const days = Math.floor((today - c.lastDate) / 86400000);
        const msg  = `Olá *${name}*! 👋\n\nFaz um tempo que você não nos visita.\n\nQue tal agendar uma revisão para o seu *${c.vehicle}*? Temos ofertas especiais para clientes fiéis! 😊\n\n*${compName}*`;
        const link = `https://wa.me/55${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
        list.innerHTML += `<div class="item-card" style="border-left:4px solid #f39c12;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div><div style="font-size:15px;font-weight:700;color:var(--dark);">${name}</div><div style="font-size:12px;color:#95a5a6;">${c.vehicle} · ${c.count} visita${c.count>1?'s':''}</div></div>
                <span style="background:#fff8e8;color:#f39c12;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;">${days} dias</span>
            </div>
            <button class="btn-action" style="background:#25D366;margin-top:8px;font-size:13px;" onclick="window.open('${link}')"><i class="fab fa-whatsapp"></i> CHAMAR DE VOLTA</button>
        </div>`;
    });
};


// ── INIT ──
window.addEventListener('load', function () {
    const date = new Date();
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.value = date.toLocaleDateString('en-CA');
    const expDateEl = document.getElementById('expDate');
    if (expDateEl) expDateEl.value = date.toLocaleDateString('en-CA');

    window.setDateRange?.('month');
    window.updateDatalist?.();
    window.updateClientDatalist?.();
    window.renderCatalogList?.();
    window.renderAgenda?.();

    const _today = new Date();
    const _hs = document.getElementById('histFilterStart'), _he = document.getElementById('histFilterEnd');
    if (_hs && _he) { _hs.value = new Date(_today.getFullYear(),_today.getMonth(),1).toISOString().split('T')[0]; _he.value = new Date(_today.getFullYear(),_today.getMonth()+1,0).toISOString().split('T')[0]; }
    const _es = document.getElementById('expFilterStart'), _ee = document.getElementById('expFilterEnd');
    if (_es && _ee) { _es.value = new Date(_today.getFullYear(),_today.getMonth(),1).toISOString().split('T')[0]; _ee.value = new Date(_today.getFullYear(),_today.getMonth()+1,0).toISOString().split('T')[0]; }

    window.renderHistory?.('all');
    window.updateDashboard?.(true);
    window.renderExpensesList?.();
    window.addNewItem?.();
    window.toggleFeeInput?.();

    if (typeof VERSAO_COM_ESTOQUE !== 'undefined' && !VERSAO_COM_ESTOQUE) {
        const dsi = document.getElementById('div-stock-input');
        if (dsi) dsi.style.display = 'none';
    }
});

window.clickNewTab = function (el) { window.resetForm(); window.setOpType('venda'); window.showTab('new'); if (el) { document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); el.classList.add('active'); } };
window.openModal  = function () { document.getElementById('modal-config').style.display = 'flex'; };
window.closeModal = function () { document.getElementById('modal-config').style.display = 'none'; };
window.saveLogo   = function (event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 700000) { Toast.warning('Imagem muito grande! Use uma menor ou tire um print.'); return; }
    const reader = new FileReader();
    reader.onload = () => { localStorage.setItem('oficina_logo', reader.result); Toast.success('Logo carregada! Clique em Salvar Configurações.'); window.closeModal(); };
    reader.readAsDataURL(file);
};
window.backupSystem  = function () { const data={db:localStorage.getItem('oficina_db_master'),cat:localStorage.getItem('catalog_v1'),logo:localStorage.getItem('oficina_logo'),pix:localStorage.getItem('authon_cfg_pix'),war:localStorage.getItem('authon_cfg_warranty')}; const blob=new Blob([JSON.stringify(data)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup_authon.json'; a.click(); };
window.restoreSystem = function (event) { const reader=new FileReader(); reader.onload=e=>{ try{const d=JSON.parse(e.target.result); if(d.db)localStorage.setItem('oficina_db_master',d.db); if(d.cat)localStorage.setItem('catalog_v1',d.cat); if(d.logo)localStorage.setItem('oficina_logo',d.logo); if(d.pix)localStorage.setItem('authon_cfg_pix',d.pix); if(d.war)localStorage.setItem('authon_cfg_warranty',d.war); Toast.success('Sistema restaurado!'); setTimeout(()=>location.reload(),1500); }catch(err){Toast.error('Erro ao ler arquivo.');} }; reader.readAsText(event.target.files[0]); };

console.log('📋 Operações carregado');

