// ============================================================
// admin.js — Painel Admin com MRR Real, Churn, Alertas
// ============================================================

// ── PREÇOS REAIS DOS PLANOS ──
const PLANO_PRECOS = {
    basic:   { mensal: 67,  anual: Math.round(67  * 12 * 0.8 / 12) }, // 20% desconto anual
    pro:     { mensal: 97,  anual: Math.round(97  * 12 * 0.8 / 12) },
    premium: { mensal: 147, anual: Math.round(147 * 12 * 0.8 / 12) },
};

function getPlanoPreco(plano, periodicidade) {
    const p = PLANO_PRECOS[plano] || PLANO_PRECOS.pro;
    return periodicidade === 'anual' ? p.anual : p.mensal;
}

// ── ABRIR PAINEL ADMIN ──
window.openSuperAdmin = async function () {
    const user = window.auth?.currentUser;
    if (!user || user.email !== window.ADMIN_EMAIL) {
        Toast.error('Acesso restrito.');
        return;
    }

    const modal = document.getElementById('modal-admin');
    if (!modal) return;
    modal.style.display = 'block';

    const listEl = document.getElementById('admin-cards-list');
    if (listEl) listEl.innerHTML = `
        <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">
            <i class="fas fa-spinner fa-spin" style="font-size:28px;margin-bottom:12px;display:block;"></i>
            Carregando dados...
        </div>`;

    try {
        const qs = await window.getDocs(window.collection(window.db, 'configuracoes'));
        window._adminData = [];
        const hoje = new Date();
        const hojeStr = hoje.toLocaleDateString('en-CA');

        // ── MÉTRICAS ──
        let totalAtivos = 0, totalTrial = 0, totalBloqueados = 0, totalPendente = 0;
        let mrr = 0, arr = 0;
        let trialsExpirando = []; // trial expira em <= 2 dias
        let vencendoHoje    = []; // plano vence hoje ou já venceu
        let semAcesso7dias  = []; // último acesso há mais de 7 dias

        qs.forEach(docSnap => {
            const cfg = { ...docSnap.data(), docId: docSnap.id };
            window._adminData.push(cfg);

            const st = cfg.status || 'ativo';

            // Contadores
            if (st === 'ativo')      totalAtivos++;
            if (st === 'trial')      totalTrial++;
            if (st === 'bloqueado')  totalBloqueados++;
            if (st === 'pendente')   totalPendente++;

            // MRR — só conta ativos com plano
            if (st === 'ativo') {
                const preco = getPlanoPreco(cfg.plano || 'pro', cfg.periodicidade || 'mensal');
                if (cfg.periodicidade === 'anual') {
                    mrr += preco; // já é o equivalente mensal
                    arr += preco * 12;
                } else {
                    mrr += preco;
                    arr += preco * 12;
                }
            }

            // Alertas: trial expirando
            if (st === 'trial' && cfg.criadoEm) {
                const criado   = new Date(cfg.criadoEm);
                const diasTrial = Math.floor((hoje - criado) / 86400000);
                const restantes = 7 - diasTrial;
                if (restantes >= 0 && restantes <= 2) {
                    trialsExpirando.push({ ...cfg, diasRestantes: restantes });
                }
            }

            // Alertas: plano vencendo
            if (st === 'ativo' && cfg.planoExpira && cfg.planoExpira <= hojeStr) {
                vencendoHoje.push(cfg);
            }

            // Alertas: sem acesso há 7+ dias (risco de churn)
            if (st === 'ativo' && cfg.lastAccess) {
                const ultimo = new Date(cfg.lastAccess);
                const diasSemAcesso = Math.floor((hoje - ultimo) / 86400000);
                if (diasSemAcesso >= 7) {
                    semAcesso7dias.push({ ...cfg, diasSemAcesso });
                }
            }
        });

        // ── ATUALIZA KPIs ──
        _setEl('admin-total-users',   window._adminData.length);
        _setEl('admin-total-ativos',  totalAtivos);
        _setEl('admin-total-trial',   totalTrial);
        _setEl('admin-total-blocked', totalBloqueados);
        _setEl('admin-mrr', 'R$ ' + mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        _setEl('admin-arr', 'R$ ' + arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

        // ── ALERTAS NO TOPO ──
        _renderAlertas(trialsExpirando, vencendoHoje, semAcesso7dias, totalPendente);

        // ── RENDERIZA CARDS ──
        window.renderAdminCards(window._adminData);

    } catch (e) {
        console.error(e);
        const listEl = document.getElementById('admin-cards-list');
        if (listEl) listEl.innerHTML = `<div style="color:#e74c3c;text-align:center;padding:30px;">Erro ao carregar dados.</div>`;
    }
};

function _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// ── ALERTAS ──
function _renderAlertas(trialsExpirando, vencendoHoje, semAcesso7dias, totalPendente) {
    // Remove alertas antigos
    document.getElementById('admin-alertas')?.remove();

    const alertas = [];

    if (trialsExpirando.length > 0) {
        alertas.push({
            cor: '#f39c12',
            icon: 'fa-hourglass-half',
            texto: `${trialsExpirando.length} trial${trialsExpirando.length > 1 ? 's' : ''} expira${trialsExpirando.length > 1 ? 'm' : ''} em até 2 dias`,
            nomes: trialsExpirando.map(c => (c.nomeOficina || c.name || c.email || '?') + ` (${c.diasRestantes}d)`).join(', ')
        });
    }
    if (vencendoHoje.length > 0) {
        alertas.push({
            cor: '#e74c3c',
            icon: 'fa-calendar-xmark',
            texto: `${vencendoHoje.length} plano${vencendoHoje.length > 1 ? 's' : ''} vencido${vencendoHoje.length > 1 ? 's' : ''} hoje`,
            nomes: vencendoHoje.map(c => c.nomeOficina || c.name || c.email || '?').join(', ')
        });
    }
    if (totalPendente > 0) {
        alertas.push({
            cor: '#e67e22',
            icon: 'fa-clock',
            texto: `${totalPendente} conta${totalPendente > 1 ? 's' : ''} aguardando pagamento`,
            nomes: ''
        });
    }
    if (semAcesso7dias.length > 0) {
        alertas.push({
            cor: '#6c5ce7',
            icon: 'fa-user-clock',
            texto: `${semAcesso7dias.length} cliente${semAcesso7dias.length > 1 ? 's' : ''} sem acesso há 7+ dias (risco churn)`,
            nomes: semAcesso7dias.map(c => (c.nomeOficina || c.name || '?') + ` (${c.diasSemAcesso}d)`).join(', ')
        });
    }

    if (!alertas.length) return;

    const div = document.createElement('div');
    div.id = 'admin-alertas';
    div.style.cssText = 'padding:14px 15px 0;';
    div.innerHTML = alertas.map(a => `
        <div style="background:${a.cor}18;border:1px solid ${a.cor}40;border-radius:12px;
                    padding:12px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;">
            <i class="fas ${a.icon}" style="color:${a.cor};font-size:14px;margin-top:2px;flex-shrink:0;"></i>
            <div>
                <div style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:700;color:${a.cor};">
                    ${a.texto}
                </div>
                ${a.nomes ? `<div style="font-family:'Poppins',sans-serif;font-size:10px;color:rgba(255,255,255,0.4);margin-top:3px;">${a.nomes}</div>` : ''}
            </div>
        </div>`).join('');

    // Insere após o card de MRR
    const mrrCard = document.querySelector('#modal-admin [id="admin-arr"]')?.closest('div[style*="margin:12px"]');
    const searchDiv = document.querySelector('#modal-admin [id="admin-search"]')?.parentElement;
    if (searchDiv) searchDiv.parentElement.insertBefore(div, searchDiv);
}


// ── RENDER CARDS ──
window.renderAdminCards = function (data) {
    const hoje  = new Date().toLocaleDateString('en-CA');
    const listEl = document.getElementById('admin-cards-list');
    if (!listEl) return;

    if (!data.length) {
        listEl.innerHTML = `<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">Nenhum cliente encontrado.</div>`;
        return;
    }

    // Ordena: vencidos primeiro, depois trial, depois ativos, depois bloqueados
    const ordem = { ativo: 1, trial: 2, pendente: 3, bloqueado: 4, admin: 0 };
    data.sort((a, b) => (ordem[a.status] || 5) - (ordem[b.status] || 5));

    listEl.innerHTML = data.map(cfg => {
        const st          = cfg.status || 'ativo';
        const isAdmin     = st === 'admin';
        const isAtivo     = st === 'ativo';
        const isTrial     = st === 'trial';
        const isBloqueado = st === 'bloqueado';
        const isPendente  = st === 'pendente';

        const corStatus = { admin:'#f0a500', ativo:'#00b894', trial:'#f39c12', bloqueado:'#e74c3c', pendente:'#e67e22' };
        const borderColor = corStatus[st] || '#7f8c8d';

        const labelStatus = { admin:'👑 Admin', ativo:'✓ Ativo', trial:'⏳ Trial', bloqueado:'🔒 Bloqueado', pendente:'⌛ Pendente' };
        const badge = `<span style="background:${borderColor}22;color:${borderColor};font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:0.5px;">${labelStatus[st] || st}</span>`;

        const venceEm        = cfg.planoExpira || cfg.trialExpira || '—';
        const venceFormatted = venceEm !== '—' ? venceEm.split('-').reverse().join('/') : '—';
        const vencido        = venceEm !== '—' && venceEm < hoje;
        const planoNome      = (cfg.plano || 'pro').toUpperCase();
        const period         = cfg.periodicidade === 'anual' ? 'Anual' : 'Mensal';
        const lastAccess     = cfg.lastAccess ? cfg.lastAccess.split('-').reverse().join('/') : 'Nunca';
        const preco          = isAtivo ? getPlanoPreco(cfg.plano || 'pro', cfg.periodicidade || 'mensal') : 0;

        // Dias sem acesso
        let diasSemAcessoHtml = '';
        if (cfg.lastAccess && isAtivo) {
            const dias = Math.floor((new Date() - new Date(cfg.lastAccess)) / 86400000);
            if (dias >= 7) diasSemAcessoHtml = `<span style="color:#e74c3c;font-size:10px;font-weight:700;"> ⚠ ${dias}d sem acesso</span>`;
        }

        // Trial: dias restantes
        let trialHtml = '';
        if (isTrial && cfg.criadoEm) {
            const diasTrial  = Math.floor((new Date() - new Date(cfg.criadoEm)) / 86400000);
            const restantes  = 7 - diasTrial;
            const cor        = restantes <= 1 ? '#e74c3c' : restantes <= 2 ? '#f39c12' : '#00b894';
            trialHtml = `<div style="font-size:10px;font-weight:700;color:${cor};margin-top:3px;">${restantes > 0 ? `${restantes}d restantes no trial` : 'Trial expirado'}</div>`;
        }

        // Botões de ação
        let acoes = '';
        if (!isAdmin) {
            if (isBloqueado) {
                acoes += _btn('fas fa-unlock', 'Liberar', '#00b894', `adminSetStatus('${cfg.docId}','ativo')`);
            } else {
                acoes += _btn('fas fa-ban', 'Bloquear', '#e74c3c', `adminSetStatus('${cfg.docId}','bloqueado')`);
            }
            acoes += _btn('fas fa-calendar-plus', 'Renovar', '#0984e3', `adminExtendPlan('${cfg.docId}','${cfg.plano || 'pro'}')`);
            if (isPendente || isTrial) {
                acoes += _btn('fas fa-bolt', 'Ativar', '#00b894', `adminSetStatus('${cfg.docId}','ativo')`);
            }
        }

        return `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);
                    border-left:3px solid ${borderColor};border-radius:14px;padding:16px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:15px;font-weight:700;color:white;margin-bottom:2px;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${cfg.nomeOficina || cfg.name || 'Sem nome'}
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.4);">${cfg.email || '—'}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.35);">${cfg.phone || ''}</div>
                    ${trialHtml}
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:10px;">
                    ${badge}
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:5px;font-weight:700;">
                        ${planoNome} · ${period}
                    </div>
                    ${preco > 0 ? `<div style="font-size:13px;font-weight:800;color:#00b894;margin-top:2px;">R$ ${preco}/mês</div>` : ''}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;">
                    <div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Último acesso</div>
                    <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);">${lastAccess}${diasSemAcessoHtml}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;">
                    <div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Vencimento</div>
                    <div style="font-size:12px;font-weight:700;color:${vencido ? '#e74c3c' : 'rgba(255,255,255,0.7)'};">${venceFormatted}${vencido ? ' ⚠' : ''}</div>
                </div>
            </div>
            ${acoes ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${acoes}</div>` : ''}
        </div>`;
    }).join('');
};

function _btn(icon, label, cor, onclick) {
    return `<button onclick="${onclick}"
        style="flex:1;padding:8px 10px;background:${cor}18;color:${cor};
               border:1px solid ${cor}40;border-radius:8px;font-size:11px;
               font-weight:700;font-family:'Poppins',sans-serif;cursor:pointer;
               display:flex;align-items:center;justify-content:center;gap:5px;min-width:70px;">
        <i class="${icon}"></i> ${label}
    </button>`;
}


// ── FILTRO DE BUSCA ──
window.filterAdminList = function () {
    const term = (document.getElementById('admin-search')?.value || '').toLowerCase();
    const statusFiltro = window._adminStatusFilter || 'all';
    let filtered = window._adminData || [];
    if (term) filtered = filtered.filter(c =>
        (c.nomeOficina || c.name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.plano || '').toLowerCase().includes(term) ||
        (c.status || '').toLowerCase().includes(term)
    );
    if (statusFiltro !== 'all') filtered = filtered.filter(c => c.status === statusFiltro);
    window.renderAdminCards(filtered);
};

// ── FILTRO POR STATUS ──
window.adminFilterStatus = function (btn, status) {
    window._adminStatusFilter = status;
    document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window.filterAdminList();
};


// ── RENOVAR PLANO ──
window.adminExtendPlan = function (docId, plano) {
    // Modal de renovação com seleção de meses
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;
                    padding:28px 24px;max-width:300px;width:100%;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">📅</div>
            <h3 style="font-family:'Oswald',sans-serif;color:white;font-size:18px;margin-bottom:8px;letter-spacing:1px;">RENOVAR PLANO</h3>
            <p style="font-family:'Poppins',sans-serif;font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:20px;">
                Plano: <strong style="color:#00b894;">${(plano||'pro').toUpperCase()}</strong>
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
                ${[1,2,3,6,12].map(m => `
                <button class="renovar-btn" data-meses="${m}"
                    style="padding:12px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);
                           background:rgba(255,255,255,0.05);color:white;font-family:'Poppins',sans-serif;
                           font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;">
                    ${m} ${m === 1 ? 'mês' : 'meses'}
                </button>`).join('')}
            </div>
            <button id="renovar-cancelar"
                style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);
                       background:transparent;color:rgba(255,255,255,0.4);font-family:'Poppins',sans-serif;
                       font-size:13px;font-weight:600;cursor:pointer;">
                Cancelar
            </button>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('.renovar-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(0,184,148,0.15)'; btn.style.borderColor = 'rgba(0,184,148,0.4)'; btn.style.color = '#00b894'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.color = 'white'; });
        btn.addEventListener('click', async () => {
            const meses   = parseInt(btn.dataset.meses);
            const novaData = new Date();
            novaData.setMonth(novaData.getMonth() + meses);
            const novaDataStr = novaData.toLocaleDateString('en-CA');
            modal.remove();
            try {
                await window.updateDoc(window.doc(window.db, 'configuracoes', docId), {
                    status: 'ativo', plano, planoExpira: novaDataStr
                });
                Toast.success(`Plano renovado por ${meses} ${meses === 1 ? 'mês' : 'meses'} — vence em ${novaDataStr.split('-').reverse().join('/')}!`);
                window.openSuperAdmin();
            } catch (e) {
                Toast.error('Erro ao renovar. Tente novamente.');
            }
        });
    });

    document.getElementById('renovar-cancelar').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};


// ── INJETAR FILTROS DE STATUS NO PAINEL ADMIN ──
document.addEventListener('DOMContentLoaded', () => {
    // Aguarda o modal existir no DOM
    setTimeout(() => {
        const searchDiv = document.querySelector('#modal-admin [id="admin-search"]')?.parentElement;
        if (!searchDiv) return;

        const filterBar = document.createElement('div');
        filterBar.style.cssText = 'display:flex;gap:6px;padding:10px 15px 0;overflow-x:auto;';
        filterBar.innerHTML = `
            ${['all','ativo','trial','bloqueado','pendente'].map((s, i) => {
                const labels = { all:'Todos', ativo:'Ativos', trial:'Trial', bloqueado:'Bloqueados', pendente:'Pendentes' };
                const cores  = { all:'#ffffff', ativo:'#00b894', trial:'#f39c12', bloqueado:'#e74c3c', pendente:'#e67e22' };
                return `<button class="admin-filter-btn${i === 0 ? ' active' : ''}"
                    onclick="adminFilterStatus(this,'${s}')"
                    data-status="${s}"
                    style="padding:6px 14px;border-radius:20px;border:1px solid ${cores[s]}40;
                           background:${i === 0 ? cores[s]+'22' : 'transparent'};
                           color:${i === 0 ? cores[s] : 'rgba(255,255,255,0.4)'};
                           font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;
                           cursor:pointer;white-space:nowrap;transition:all 0.2s;">
                    ${labels[s]}
                </button>`;
            }).join('')}
        `;

        // Estilo ativo dos filtros
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .admin-filter-btn.active {
                background: rgba(255,255,255,0.15) !important;
                color: white !important;
                border-color: rgba(255,255,255,0.3) !important;
            }
        `;
        document.head.appendChild(styleEl);
        searchDiv.parentElement.insertBefore(filterBar, searchDiv);
    }, 500);
});

console.log('👑 Admin carregado');

// ── Funções adicionais ──
window.filterAdminList = function() {
            const term = document.getElementById('admin-search').value.toLowerCase();
            const filtered = window._adminData.filter(c =>
                (c.nomeOficina||c.name||'').toLowerCase().includes(term) ||
                (c.email||'').toLowerCase().includes(term)
            );
            renderAdminCards(filtered);
        }

window.printThermalReceipt = function() {
            const data = window.currentReceiptData;
            if(!data) return alert("Erro: Dados do recibo não encontrados.");

            const compName = localStorage.getItem('authon_cfg_name') || "Nossa Oficina";
            const compCnpj = localStorage.getItem('authon_cfg_cnpj') || "";
            const compPhone = localStorage.getItem('authon_cfg_phone') || "";

            const W = 32; // 32 colunas (Padrão exato da maquininha de 58mm)

            // 1. Função que centraliza o texto milimetricamente
            const center = (str) => {
                let s = str.substring(0, W);
                let pad = Math.max(0, Math.floor((W - s.length) / 2));
                return " ".repeat(pad) + s + "\n";
            };

            // 2. Função que joga o texto para a esquerda e o preço para a direita
            const split = (left, right) => {
                let l = left.substring(0, W - right.length - 1);
                let spaces = Math.max(1, W - l.length - right.length);
                return l + " ".repeat(spaces) + right + "\n";
            };

            const line = "-".repeat(W) + "\n";

            let pText = "";
            
            // --- CONSTRUINDO O RECIBO ---
            pText += center(compName.toUpperCase());
            if(compCnpj) pText += center(compCnpj);
            if(compPhone) pText += center(compPhone);
            
            pText += line;
            pText += center("RECIBO / " + data.type.toUpperCase());
            pText += line;
            
            pText += "Data: " + data.date.split('-').reverse().join('/') + "\n";
            pText += "Cliente: " + data.client.substring(0, 23) + "\n";
            let veic = (data.vehicle || '') + (data.plate ? ' ' + data.plate.toUpperCase() : '');
            pText += "Veiculo: " + veic.substring(0, 23) + "\n";
            
            pText += line;
            pText += split("QTD DESC", "VALOR");
            pText += line;

            // Lançando Itens Alinhados
            if(data.items) {
                data.items.forEach(i => {
                    let cleanDesc = i.desc;
                    if(cleanDesc.includes(' - ') && cleanDesc.includes('(')) { 
                        try { cleanDesc = cleanDesc.split(' - ')[1].split(' (')[0]; } catch(e) {} 
                    }
                    let leftStr = `${i.qty}x ${cleanDesc}`;
                    let rightStr = `R$ ${parseFloat(i.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
                    pText += split(leftStr, rightStr);
                });
            }

            pText += line;
            
            // Lançando Totais
            if(data.discount > 0) {
                pText += split("Desconto:", `-R$ ${data.discount.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
            }
            pText += split("TOTAL:", `R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
            pText += line;

            pText += center(`Pgto: ${data.payment || "A Combinar"}`);

            // Pix e Garantia
            const savedPix = localStorage.getItem('authon_cfg_pix');
            if(savedPix && data.status === 'pendente') {
                pText += "\n" + center(`Pix: ${savedPix}`);
            }

            pText += "\n\n" + center("__________________________");
            pText += center("Assinatura do Cliente") + "\n";

            pText += "\n" + center("Gerado pelo Sistema Authon");
            pText += "\n\n";

            // 3. Envia o texto perfeitamente desenhado para a maquininha
            try {
                const intentUrl = "intent:" + encodeURIComponent(pText) + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
                window.location.href = intentUrl;
            } catch(e) {
                window.print();
            }
        }

function initHistoryPeriod() {
        const today = new Date();
        const s = document.getElementById('histFilterStart');
        const e = document.getElementById('histFilterEnd');
        if(s && e && !s.value) {
            s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            e.value = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
        }
    }

// ============================================================
// PAINEL DE AFILIADOS
// ============================================================

// Troca de abas no admin
window.adminTab = function(aba) {
    const clientes  = document.getElementById('admin-area-clientes');
    const afiliados = document.getElementById('admin-area-afiliados');
    const btnC = document.getElementById('admin-tab-clientes');
    const btnA = document.getElementById('admin-tab-afiliados');

    if (aba === 'clientes') {
        clientes.style.display  = 'block';
        afiliados.style.display = 'none';
        btnC.style.cssText = 'flex:1;padding:10px;background:rgba(0,184,148,0.15);border:1px solid rgba(0,184,148,0.4);color:#00b894;border-radius:10px;font-size:12px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.5px;';
        btnA.style.cssText = 'flex:1;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:10px;font-size:12px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.5px;';
    } else {
        clientes.style.display  = 'none';
        afiliados.style.display = 'block';
        btnC.style.cssText = 'flex:1;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:10px;font-size:12px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.5px;';
        btnA.style.cssText = 'flex:1;padding:10px;background:rgba(240,165,0,0.15);border:1px solid rgba(240,165,0,0.4);color:#f0a500;border-radius:10px;font-size:12px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;letter-spacing:0.5px;';
        window.carregarAfiliados();
    }
};

// Gera código único para o afiliado
function gerarCodigo(nome) {
    const prefixo = nome.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    const num = Math.floor(1000 + Math.random() * 9000);
    return prefixo + num;
}

// Carrega lista de afiliados do Firestore
window.carregarAfiliados = async function() {
    const listEl = document.getElementById('admin-afiliados-list');
    if (!listEl) return;

    try {
        const qs = await window.getDocs(window.collection(window.db, 'afiliados'));
        const afiliados = qs.docs.map(d => ({ ...d.data(), docId: d.id }));

        if (afiliados.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:48px;color:rgba(255,255,255,0.3);">
                <i class="fas fa-handshake" style="font-size:36px;margin-bottom:12px;display:block;"></i>
                Nenhum afiliado cadastrado ainda.
            </div>`;
            return;
        }

        // Separa pendentes e ativos
        const pendentes = afiliados.filter(a => a.status === 'pendente' || !a.codigo);
        const ativos    = afiliados.filter(a => a.status === 'ativo' && a.codigo);

        let html = '';

        if (pendentes.length > 0) {
            html += `<div style="font-size:10px;font-weight:700;color:#f0a500;text-transform:uppercase;letter-spacing:1.5px;padding:8px 0 10px;">
                ⏳ Aguardando aprovação (${pendentes.length})
            </div>`;
            pendentes.forEach(af => {
                html += `<div style="background:rgba(240,165,0,0.06);border:1px solid rgba(240,165,0,0.2);border-radius:14px;padding:16px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:white;">${af.nome}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px;">${af.email} · ${af.phone}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4);">${af.cidade} · ${af.canal || '—'}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">Pix: <strong style="color:white;">${af.pix}</strong></div>
                            ${af.bio ? `<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:6px;font-style:italic;">"${af.bio}"</div>` : ''}
                        </div>
                        <span style="background:rgba(240,165,0,0.15);color:#f0a500;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">PENDENTE</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="aprovarAfiliado('${af.docId}','${af.nome}','${af.phone}')"
                            style="flex:1;padding:10px;background:#00b894;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button onclick="rejeitarAfiliado('${af.docId}')"
                            style="padding:10px 16px;background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);border-radius:10px;font-size:13px;font-weight:700;font-family:Poppins,sans-serif;cursor:pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>`;
            });
        }

        if (ativos.length > 0) {
            html += `<div style="font-size:10px;font-weight:700;color:#00b894;text-transform:uppercase;letter-spacing:1.5px;padding:12px 0 10px;">
                ✅ Afiliados ativos (${ativos.length})
            </div>`;
            ativos.forEach(af => {
                html += `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:15px;font-weight:700;color:white;">${af.nome}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4);">${af.email} · ${af.phone}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">
                                Código: <strong style="color:#00b894;letter-spacing:1px;">${af.codigo}</strong>
                                &nbsp;·&nbsp; Pix: <strong style="color:white;">${af.pix}</strong>
                            </div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:3px;">
                                Link: sistemaauthon.com.br?ref=${af.codigo}
                            </div>
                        </div>
                        <span style="background:rgba(0,184,148,0.15);color:#00b894;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">ATIVO</span>
                    </div>
                </div>`;
            });
        }

        listEl.innerHTML = html;

    } catch(e) {
        console.error('Erro afiliados:', e);
        // Se for erro de permissão, mostra mensagem específica
        const msg = e.code === 'permission-denied'
            ? 'Permissão negada. Verifique as regras do Firestore para a coleção "afiliados".'
            : `Erro: ${e.message}`;
        listEl.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px;">${msg}</div>`;
    }
};

// Aprova afiliado e gera código único
window.aprovarAfiliado = async function(docId, nome, phone) {
    if (!confirm(`Aprovar afiliado "${nome}"?`)) return;

    try {
        // Gera código único
        let codigo = gerarCodigo(nome);

        // Garante que o código é único no Firestore
        const existing = await window.getDocs(
            window.query(window.collection(window.db, 'afiliados'),
            window.where('codigo', '==', codigo))
        );
        if (!existing.empty) codigo += Math.floor(10 + Math.random() * 90);

        await window.updateDoc(window.doc(window.db, 'afiliados', docId), {
            status: 'ativo',
            codigo: codigo,
            aprovadoEm: new Date().toISOString()
        });

        Toast.success(`✅ ${nome} aprovado! Código: ${codigo}`);

        // Abre WhatsApp para avisar o afiliado
        const link = `https://sistemaauthon.com.br?ref=${codigo}`;
        const msg = `Olá ${nome}! 🎉\n\nSeu cadastro no programa *Indique e Ganhe* do Sistema Authon foi *aprovado*!\n\n🔗 *Seu link exclusivo:*\n${link}\n\nComece a compartilhar e ganhe comissões mensais recorrentes. Acesse seu painel em:\nhttps://sistemaauthon.com.br/painel-afiliado.html\n\nQualquer dúvida, estamos aqui! 💪`;
        const phoneClean = phone.replace(/\D/g, '');
        setTimeout(() => {
            window.open(`https://wa.me/55${phoneClean}?text=${encodeURIComponent(msg)}`);
        }, 500);

        // Recarrega lista
        await window.carregarAfiliados();

    } catch(e) {
        console.error(e);
        Toast.error('Erro ao aprovar afiliado.');
    }
};

// Rejeita/remove afiliado
window.rejeitarAfiliado = async function(docId) {
    if (!confirm('Rejeitar e remover este cadastro?')) return;
    try {
        await window.deleteDoc(window.doc(window.db, 'afiliados', docId));
        Toast.success('Cadastro removido.');
        await window.carregarAfiliados();
    } catch(e) {
        Toast.error('Erro ao remover.');
    }
};
