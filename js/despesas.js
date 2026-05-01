// ============================================================
// despesas.js — Despesas, Filtros, Marcar como Pago
// ============================================================

// ── TOGGLE FORMULÁRIO ──
window.toggleExpForm = function (forceClose = false) {
    const form = document.getElementById('exp-form-card');
    if (!form) return;
    if (forceClose) { form.style.display = 'none'; return; }
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
    if (form.style.display === 'block') form.scrollIntoView({ behavior: 'smooth' });
};

// ── STATUS PAGO/PENDENTE ──
window._expStatus = 'pago';
window.setExpStatus = function (status) {
    window._expStatus = status;
    const btnPago     = document.getElementById('expTogglePago');
    const btnPendente = document.getElementById('expTogglePendente');
    const divVenc     = document.getElementById('div-exp-venc');

    if (btnPago)     btnPago.classList.toggle('active',     status === 'pago');
    if (btnPendente) btnPendente.classList.toggle('active', status === 'pendente');
    if (divVenc)     divVenc.style.display = status === 'pendente' ? 'block' : 'none';
};

// ── SALVAR DESPESA ──
window.saveExpense = async function () {
    const date      = document.getElementById('expDate')?.value;
    const cat       = document.getElementById('expCat')?.value;
    const desc      = document.getElementById('expDesc')?.value?.trim();
    const val       = parseFloat(document.getElementById('expVal')?.value);
    const expStatus = window._expStatus || 'pago';
    const venc      = expStatus === 'pendente' ? (document.getElementById('expVenc')?.value || '') : '';
    const obs       = document.getElementById('expObs')?.value || '';

    if (!desc || !val || val <= 0) {
        Toast.warning('Preencha a descrição e o valor da despesa.');
        return;
    }

    const item = {
        id: Date.now(), type: 'expense',
        date, client: cat,
        vehicle: desc, total: val,
        status: expStatus,
        vencimento: venc,
        obs,
        items: []
    };

    const btn = document.getElementById('btn-save-expense');
    if (btn) window.setLoading(btn, true, 'Salvando...');

    await window.saveToCloud('operacoes', item);

    ['expDesc','expVal','expObs','expVenc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    window.setExpStatus('pago');
    window.toggleExpForm(true);
    Toast.success('Despesa salva com sucesso!');

    if (btn) window.setLoading(btn, false, 'SALVAR DESPESA');
};

// ── MARCAR COMO PAGO ──
window.markExpensePaid = async function (docId) {
    if (!docId) return;
    await window.updateInCloud('operacoes', docId, { status: 'pago', vencimento: '' });
    Toast.success('Despesa marcada como paga!');
};

// ── FILTRO DE STATUS ──
window._expFilterStatus = 'all';
window.setExpFilter = function (btn, status) {
    document.querySelectorAll('.exp-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._expFilterStatus = status;
    window.renderExpensesList();
};

// ── PERÍODO RÁPIDO ──
window.expPeriod = function (btn, range) {
    document.querySelectorAll('.exp-period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const today = new Date();
    const s = document.getElementById('expFilterStart');
    const e = document.getElementById('expFilterEnd');
    if (!s || !e) return;
    if (range === 'today') {
        const str = today.toLocaleDateString('en-CA'); s.value = str; e.value = str;
    } else if (range === 'month') {
        s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        e.value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    } else { s.value = ''; e.value = ''; }
    window.renderExpensesList();
};

// ── RENDER LISTA ──
window.renderExpensesList = function () {
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list = document.getElementById('expense-list-mini');
    if (!list) return;

    const term    = (document.getElementById('expenseSearch')?.value || '').toLowerCase();
    const eStart  = document.getElementById('expFilterStart')?.value || '';
    const eEnd    = document.getElementById('expFilterEnd')?.value   || '';
    const statusF = window._expFilterStatus || 'all';
    const hoje    = new Date().toLocaleDateString('en-CA');

    let filtered = db.filter(x => x.type === 'expense');
    if (eStart) filtered = filtered.filter(x => x.date >= eStart);
    if (eEnd)   filtered = filtered.filter(x => x.date <= eEnd);
    if (statusF === 'pago')     filtered = filtered.filter(x => !x.status || x.status === 'pago');
    if (statusF === 'pendente') filtered = filtered.filter(x => x.status === 'pendente' && (!x.vencimento || x.vencimento >= hoje));
    if (statusF === 'vencida')  filtered = filtered.filter(x => x.status === 'pendente' && x.vencimento && x.vencimento < hoje);
    if (term) filtered = filtered.filter(x => (x.vehicle + ' ' + (x.client||'') + ' ' + x.date).toLowerCase().includes(term));
    filtered.sort((a, b) => b.id - a.id);

    const total = filtered.reduce((s, x) => s + x.total, 0);

    if (!filtered.length) {
        list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
            <i class="fas fa-folder-open" style="font-size:40px;margin-bottom:12px;display:block;"></i>
            <div style="font-size:14px;font-weight:600;">Nenhuma despesa encontrada</div>
            <div style="font-size:12px;margin-top:5px;">Tente mudar o período ou filtro</div>
        </div>`;
        return;
    }

    let html = `<div style="margin:12px 15px;background:white;border-radius:14px;padding:14px 16px;
        box-shadow:0 4px 16px rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#95a5a6;">
            ${filtered.length} despesa${filtered.length > 1 ? 's' : ''} no período
        </div>
        <div style="font-size:16px;font-weight:800;color:#e17055;">
            - R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
    </div>`;

    filtered.forEach(x => {
        const isPago     = !x.status || x.status === 'pago';
        const isVencida  = x.status === 'pendente' && x.vencimento && x.vencimento < hoje;
        const isPendente = x.status === 'pendente' && !isVencida;

        let badgeHtml = '', borderColor = '#e17055';
        if (isPago)     { badgeHtml = `<span style="background:#e8faf4;color:#00b894;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;">✓ Pago</span>`;         borderColor = '#00b894'; }
        if (isPendente) { badgeHtml = `<span style="background:#fff8e8;color:#f39c12;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;">⏳ Pendente</span>`;    borderColor = '#f39c12'; }
        if (isVencida)  { badgeHtml = `<span style="background:#fff0f0;color:#e74c3c;font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;">⚠ Vencida</span>`;     borderColor = '#e74c3c'; }

        const vencInfo = x.vencimento ? `<div style="font-size:11px;color:${isVencida ? '#e74c3c' : '#95a5a6'};margin-top:2px;"><i class="fas fa-calendar-xmark" style="margin-right:4px;"></i>Vence: ${x.vencimento.split('-').reverse().join('/')}</div>` : '';
        const obsInfo  = x.obs ? `<div style="font-size:11px;color:#95a5a6;margin-top:2px;font-style:italic;"><i class="fas fa-comment-dots" style="margin-right:4px;"></i>${x.obs}</div>` : '';

        html += `
        <div style="margin:0 15px 10px;background:white;border-radius:14px;padding:16px;
            box-shadow:0 4px 16px rgba(0,0,0,0.05);border-left:4px solid ${borderColor};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div>
                    <div style="font-size:15px;font-weight:700;color:#2d3436;">${x.vehicle}</div>
                    <div style="font-size:11px;color:#95a5a6;margin-top:2px;">
                        <i class="fas fa-tag" style="margin-right:4px;"></i>${x.client || 'Geral'}
                        &nbsp;·&nbsp;
                        <i class="fas fa-calendar" style="margin-right:4px;"></i>${x.date.split('-').reverse().join('/')}
                    </div>
                    ${vencInfo}${obsInfo}
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:10px;">
                    <div style="font-size:17px;font-weight:800;color:#e17055;">- R$ ${x.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                    <div style="margin-top:5px;">${badgeHtml}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;border-top:1px solid #f5f6fa;padding-top:10px;">
                ${!isPago ? `<button onclick="markExpensePaid('${x.docId}')" style="flex:1;padding:8px;background:#e8faf4;color:#00b894;border:none;border-radius:8px;font-size:11px;font-weight:700;font-family:'Poppins',sans-serif;cursor:pointer;"><i class="fas fa-check"></i> Marcar como Pago</button>` : ''}
                <button onclick="deleteItem('${x.docId}')" style="padding:8px 14px;background:#fff0f0;color:#e74c3c;border:none;border-radius:8px;font-size:11px;font-weight:700;font-family:'Poppins',sans-serif;cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    });

    list.innerHTML = html;
};

console.log('💸 Despesas carregado');
