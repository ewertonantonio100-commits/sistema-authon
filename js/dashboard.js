// ============================================================
// dashboard.js — Financeiro, KPIs, Gráficos, Balanço Anual
// ============================================================

// ── GRÁFICO 6 MESES ──
window.renderSixMonthChart = function () {
    const db  = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    const labels = [], dataInc = [], dataExp = [];
    const today  = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        labels.push(d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase() + '/' + d.getFullYear().toString().substr(2));
        let mInc = 0, mExp = 0;
        db.forEach(x => {
            const xd = new Date(x.date + 'T12:00:00');
            if (xd.getMonth() === d.getMonth() && xd.getFullYear() === d.getFullYear()) {
                if (x.type === 'venda' && x.status === 'pago') mInc += (x.netTotal !== undefined ? x.netTotal : x.total);
                if (x.type === 'expense') mExp += x.total;
            }
        });
        dataInc.push(mInc); dataExp.push(mExp);
    }

    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Entradas', data: dataInc, backgroundColor: 'rgba(0,184,148,0.85)', borderRadius: 8, borderSkipped: false, barPercentage: 0.55 },
                { label: 'Saídas',   data: dataExp, backgroundColor: 'rgba(225,112,85,0.85)',  borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                     ticks: { font: { family: 'Poppins', size: 9 }, color: '#95a5a6',
                              callback: v => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v } },
                x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 9, weight: '600' }, color: '#7f8c8d' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e272e', titleFont: { family: 'Poppins', size: 11, weight: '700' },
                           bodyFont: { family: 'Poppins', size: 11 }, padding: 12, cornerRadius: 10,
                           callbacks: { label: c => ' R$ ' + c.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) } }
            }
        }
    });
};


// ── BALANÇO ANUAL ──
window.renderAnnualBalance = function () {
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list = document.getElementById('annual-list');
    const yearSpan = document.getElementById('annual-year');
    const currentYear = new Date().getFullYear();
    if (yearSpan) yearSpan.innerText = currentYear;
    if (!list) return;
    list.innerHTML = '';

    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    let totalYInc = 0, totalYExp = 0;

    months.forEach((name, idx) => {
        let mInc = 0, mExp = 0;
        db.forEach(x => {
            const xd = new Date(x.date + 'T12:00:00');
            if (xd.getMonth() === idx && xd.getFullYear() === currentYear) {
                if (x.type === 'venda' && x.status === 'pago') mInc += (x.netTotal !== undefined ? x.netTotal : x.total);
                if (x.type === 'expense') mExp += x.total;
            }
        });
        const profit = mInc - mExp;
        const pc = profit >= 0 ? '#00b894' : '#e17055';
        list.innerHTML += `<tr>
            <td>${name.substring(0, 3).toUpperCase()}</td>
            <td style="color:#00b894;font-weight:700;">${mInc > 0 ? 'R$&nbsp;' + mInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '<span style="color:#dfe6e9">—</span>'}</td>
            <td style="color:#e17055;font-weight:700;">${mExp > 0 ? 'R$&nbsp;' + mExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '<span style="color:#dfe6e9">—</span>'}</td>
            <td style="color:${pc};font-weight:800;">R$&nbsp;${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>`;
        totalYInc += mInc; totalYExp += mExp;
    });

    const tp = totalYInc - totalYExp;
    list.innerHTML += `<tr>
        <td style="font-size:10px;letter-spacing:1px;">TOTAL</td>
        <td style="color:#00b894;">R$&nbsp;${totalYInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="color:#e17055;">R$&nbsp;${totalYExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="color:${tp >= 0 ? '#00b894' : '#e17055'};">R$&nbsp;${tp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>`;
};


// ── DASHBOARD / KPIs ──
window.updateDashboard = function (applyFilter = false) {
    const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');

    let start = document.getElementById('filterStart')?.value || '';
    let end   = document.getElementById('filterEnd')?.value   || '';
    let filtered = db;
    if (applyFilter && start && end) filtered = db.filter(x => x.date >= start && x.date <= end);

    let inc = 0, exp = 0;
    const payStats = {}, catExpStats = {};
    window.teamStats = {};

    filtered.forEach(x => {
        if (x.type === 'venda' && x.status === 'pago') {
            const val = x.netTotal !== undefined ? x.netTotal : x.total;
            inc += val;
            const pay = x.payment || 'Outros';
            payStats[pay] = (payStats[pay] || 0) + val;
            const seller = x.seller || 'Não Informado';
            window.teamStats[seller] = (window.teamStats[seller] || 0) + val;
        }
        if (x.type === 'expense') {
            exp += x.total;
            const cat = x.client || 'Geral';
            catExpStats[cat] = (catExpStats[cat] || 0) + x.total;
        }
    });

    // KPIs principais
    const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('kpi-inc')?.setAttribute('innerText',    fmt(inc));
    if (document.getElementById('kpi-inc'))    document.getElementById('kpi-inc').innerText    = fmt(inc);
    if (document.getElementById('kpi-exp'))    document.getElementById('kpi-exp').innerText    = fmt(exp);
    if (document.getElementById('kpi-profit')) document.getElementById('kpi-profit').innerText = fmt(inc - exp);

    const elSub = document.getElementById('fin-profit-sub-label');
    if (elSub) {
        const l = inc - exp;
        elSub.innerText = l > 0 ? '▲ Resultado positivo no período' : l < 0 ? '▼ Resultado negativo no período' : '─ Sem movimentação';
    }

    // Barras de pagamento
    let payHtml = '';
    for (const [key, val] of Object.entries(payStats)) {
        const pct = inc > 0 ? (val / inc) * 100 : 0;
        payHtml += `<div class="fin-bar-row">
            <div class="fin-bar-top"><span class="fin-bar-name">${key}</span><span class="fin-bar-val" style="color:#00b894;">${fmt(val)}</span></div>
            <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#00b894,#00cec9);"></div></div>
            <div class="fin-bar-pct">${pct.toFixed(0)}% do total</div>
        </div>`;
    }
    const spEl = document.getElementById('stats-payment');
    if (spEl) spEl.innerHTML = payHtml || '<div style="color:#bdc3c7;text-align:center;padding:15px;font-size:13px;">Sem dados no período</div>';

    // Barras de despesas
    let expHtml = '';
    Object.entries(catExpStats).sort((a, b) => b[1] - a[1]).forEach(([key, val]) => {
        const pct = exp > 0 ? (val / exp) * 100 : 0;
        expHtml += `<div class="fin-bar-row">
            <div class="fin-bar-top"><span class="fin-bar-name">${key}</span><span class="fin-bar-val" style="color:#e17055;">${fmt(val)}</span></div>
            <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#e17055,#d63031);"></div></div>
            <div class="fin-bar-pct">${pct.toFixed(0)}% das saídas</div>
        </div>`;
    });
    const seEl = document.getElementById('stats-expenses');
    if (seEl) seEl.innerHTML = expHtml || '<div style="color:#bdc3c7;text-align:center;padding:15px;font-size:13px;">Sem despesas no período</div>';

    // Ranking da equipe
    let teamHtml = '';
    const sortedTeam = Object.entries(window.teamStats).sort((a, b) => b[1] - a[1]);
    if (sortedTeam.length > 0) {
        sortedTeam.forEach(([name, val], i) => {
            const medals = ['🥇','🥈','🥉'];
            const pct = inc > 0 ? (val / inc) * 100 : 0;
            teamHtml += `<div class="fin-bar-row">
                <div class="fin-bar-top"><span class="fin-bar-name">${medals[i] || '👤'} ${name}</span><span class="fin-bar-val" style="color:#0984e3;">${fmt(val)}</span></div>
                <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#0984e3,#74b9ff);"></div></div>
                <div class="fin-bar-pct">${pct.toFixed(0)}% das entradas</div>
            </div>`;
        });
    } else {
        teamHtml = '<div style="color:#bdc3c7;text-align:center;padding:10px;font-size:13px;">Nenhuma venda com vendedor vinculado.</div>';
    }
    const stEl = document.getElementById('stats-team');
    if (stEl) stEl.innerHTML = teamHtml;
    window.teamStats = {};

    // KPIs secundários
    const vendasPagas = filtered.filter(x => x.type === 'venda' && x.status === 'pago');
    const ticket = vendasPagas.length > 0 ? inc / vendasPagas.length : 0;
    const elT = document.getElementById('kpi-ticket'); if (elT) elT.innerText = fmt(ticket);

    const dbFull = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const elP = document.getElementById('kpi-pendentes');   if (elP) elP.innerText = dbFull.filter(x => x.type === 'venda' && x.status === 'pendente').length;
    const elO = document.getElementById('kpi-orcamentos'); if (elO) elO.innerText = dbFull.filter(x => x.type === 'orcamento').length;
    const totalOp = filtered.filter(x => x.type === 'orcamento').length + filtered.filter(x => x.type === 'venda').length;
    const elC = document.getElementById('kpi-conversao');  if (elC) elC.innerText = (totalOp > 0 ? Math.round((filtered.filter(x => x.type === 'venda').length / totalOp) * 100) : 0) + '%';
    const hoje2 = new Date().toLocaleDateString('en-CA');
    const elH = document.getElementById('kpi-hoje');       if (elH) elH.innerText = dbFull.filter(x => x.date === hoje2 && x.type !== 'expense').length;

    // Meta mensal
    const metaV  = parseFloat(localStorage.getItem('authon_meta_mes') || '0');
    const elMP   = document.getElementById('kpi-meta-pct');
    const elMB   = document.getElementById('kpi-meta-bar');
    if (elMP && elMB) {
        if (metaV > 0) {
            const now2 = new Date();
            const incM = dbFull.filter(x => {
                const d = new Date(x.date + 'T12:00:00');
                return x.type === 'venda' && x.status === 'pago' && d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
            }).reduce((s, x) => s + (x.netTotal !== undefined ? x.netTotal : x.total), 0);
            const pct = Math.min(Math.round((incM / metaV) * 100), 100);
            elMP.innerText = pct + '%';
            elMB.style.width = pct + '%';
            elMB.style.background = pct >= 100 ? '#00b894' : pct >= 60 ? '#fdcb6e' : '#e74c3c';
        } else {
            elMP.innerText = 'Definir'; elMB.style.width = '0%';
        }
    }

    try { window.renderSixMonthChart(); window.renderAnnualBalance(); } catch (e) { console.error(e); }
};


// ── PERÍODO RÁPIDO ──
window.finPeriod = function (btn, range) {
    document.querySelectorAll('.fin-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _setDateRange(range);
};

function _setDateRange(type) {
    const today = new Date();
    const s = document.getElementById('filterStart');
    const e = document.getElementById('filterEnd');
    if (!s || !e) return;
    if (type === 'today') { const str = today.toLocaleDateString('en-CA'); s.value = str; e.value = str; }
    else if (type === 'month') {
        s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        e.value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    } else { s.value = ''; e.value = ''; }
    window.updateDashboard(true);
}
window.setDateRange = _setDateRange;


// ── META MENSAL ──
window.openMetaModal = function () {
    const i = document.getElementById('meta-input');
    if (i) i.value = localStorage.getItem('authon_meta_mes') || '';
    document.getElementById('modal-meta').style.display = 'flex';
};
window.saveMeta = function () {
    const val = parseFloat(document.getElementById('meta-input').value);
    if (!val || val <= 0) { Toast.warning('Informe um valor válido para a meta.'); return; }
    localStorage.setItem('authon_meta_mes', val);
    document.getElementById('modal-meta').style.display = 'none';
    window.updateDashboard(true);
    Toast.success('Meta definida com sucesso!');
};


// ── EXPORTAR CSV PARA CONTADOR ──
window.exportToExcel = function () {
    const db    = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const start = document.getElementById('filterStart')?.value || '';
    const end   = document.getElementById('filterEnd')?.value   || '';

    if (!start || !end) { Toast.warning('Selecione o período no filtro para exportar.'); return; }

    const filtered = db.filter(x => {
        const isPeriod    = x.date >= start && x.date <= end;
        const isPaidVenda = x.type === 'venda' && x.status === 'pago';
        const isExpense   = x.type === 'expense';
        return isPeriod && (isPaidVenda || isExpense);
    }).sort((a, b) => a.date.localeCompare(b.date));

    if (!filtered.length) { Toast.warning('Sem dados para exportar neste período.'); return; }

    const limpar = (str) => {
        if (!str) return '-';
        return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/;/g, ',');
    };

    let csv = 'Data;Tipo;Cliente_Fornecedor;CPF_CNPJ;Placa;Itens_Servicos_Despesas;Metodo_Pagamento;Valor_Bruto;Taxa_Maquininha;Valor_Liquido\n';

    filtered.forEach(item => {
        const isVenda    = item.type === 'venda';
        const data       = item.date.split('-').reverse().join('/');
        const tipo       = isVenda ? 'ENTRADA' : 'SAIDA';
        const cliente    = isVenda ? item.client : (item.client || 'Geral');
        const cpf        = isVenda && item.cpf ? item.cpf : '-';
        const placa      = isVenda && item.plate ? item.plate.toUpperCase() : '-';
        let itens        = '-';
        if (isVenda && item.items?.length > 0) itens = item.items.map(i => `${i.qty}x ${i.desc}`).join(', ');
        else if (!isVenda) itens = item.vehicle || 'Despesa';
        const metodo     = isVenda ? (item.payment || 'Nao inf.') : 'Saida';
        const bruto      = item.total;
        const liquido    = isVenda ? (item.netTotal || item.total) : item.total;
        const taxa       = isVenda ? (bruto - liquido) : 0;
        csv += `${data};${tipo};${limpar(cliente)};${limpar(cpf)};${limpar(placa)};${limpar(itens)};${limpar(metodo)};${bruto.toFixed(2).replace('.',',')};${taxa.toFixed(2).replace('.',',')};${liquido.toFixed(2).replace('.',',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Relatorio_Contabil_${start}_a_${end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    Toast.success('Relatório exportado com sucesso!');
};


// ── MENU: esconde no foco de input ──
(function initMenuBehavior() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (!bottomNav) return;
    bottomNav.style.display = 'flex';
    bottomNav.style.zIndex  = '9999';

    document.addEventListener('focusin', e => {
        if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
            if (bottomNav) bottomNav.style.display = 'none';
        }
    });
    document.addEventListener('focusout', () => {
        setTimeout(() => {
            const ae = document.activeElement?.tagName;
            if (ae !== 'INPUT' && ae !== 'TEXTAREA' && ae !== 'SELECT') {
                if (bottomNav) bottomNav.style.display = 'flex';
            }
        }, 150);
    });
})();

console.log('📊 Dashboard carregado');
