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


// ── Funções migradas do app.html inline ──

        const VERSAO_COM_ESTOQUE = true;
                    // --- BLOCO ATUALIZADO DO PDF ---
            // Pega os dados salvos ou usa um padrão se estiver vazio
            const compName = localStorage.getItem('authon_cfg_name') || "NOME DA SUA OFICINA";
            const compCnpj = localStorage.getItem('authon_cfg_cnpj') || "CNPJ não informado";
            const compAddr = localStorage.getItem('authon_cfg_addr') || "Endereço não informado";
            const compPhone = localStorage.getItem('authon_cfg_phone') || "";

            // Preenche no Papel
            document.getElementById('pdf-comp-name').innerText = compName;
            document.getElementById('pdf-comp-cnpj').innerText = compCnpj;
            
            // Junta endereço e telefone numa linha só ou quebra
            document.getElementById('pdf-comp-addr').innerText = compAddr + (compPhone ? ' | ' + compPhone : '');
            // --- FIM DO BLOCO ---

        // --- SISTEMA SUPER ADMIN (CONTROLE DE CLIENTES) ---
        window.ADMIN_EMAIL = "admin@authon.com"; // ⚠️ ATENÇÃO: COLOQUE SEU E-MAIL REAL DE ACESSO AQUI!

        // --- PAINEL SUPER ADMIN PREMIUM ---
        window._adminData = []; // cache para filtro

        window.openSuperAdmin = async function() {
            const user = auth.currentUser;
            if(!user || user.email !== window.ADMIN_EMAIL) return alert("Acesso restrito.");

            document.getElementById('modal-admin').style.display = 'block';
            document.getElementById('admin-cards-list').innerHTML = `
                <div style="text-align:center; padding:40px; color:rgba(255,255,255,0.3);">
                    <i class="fas fa-spinner fa-spin" style="font-size:28px; margin-bottom:12px; display:block;"></i>
                    Carregando clientes...
                </div>`;

            try {
                const querySnapshot = await window.getDocs(window.collection(window.db, "configuracoes"));
                window._adminData = [];

                let totalAtivos=0, totalBloqueados=0, totalTrial=0, mrr=0;
                const hoje = new Date().toLocaleDateString('en-CA');

                const planoPrecos = { basic:67, pro:97, premium:147 };

                querySnapshot.forEach((docSnap) => {
                    const cfg = docSnap.data();
                    window._adminData.push({ ...cfg, docId: docSnap.id });

                    const st = cfg.status || 'ativo';
                    if(st === 'ativo')      { totalAtivos++;    mrr += planoPrecos[cfg.plano] || 97; }
                    if(st === 'trial')       totalTrial++;
                    if(st === 'bloqueado')   totalBloqueados++;
                });

                document.getElementById('admin-total-users').innerText   = window._adminData.length;
                document.getElementById('admin-total-ativos').innerText  = totalAtivos;
                document.getElementById('admin-total-trial').innerText   = totalTrial;
                document.getElementById('admin-total-blocked').innerText = totalBloqueados;
                document.getElementById('admin-mrr').innerText  = 'R$ ' + mrr.toLocaleString('pt-BR');
                document.getElementById('admin-arr').innerText  = 'R$ ' + (mrr*12).toLocaleString('pt-BR');

                renderAdminCards(window._adminData);

            } catch(e) {
                console.error(e);
                document.getElementById('admin-cards-list').innerHTML = `<div style="color:#e74c3c; text-align:center; padding:30px;">Erro ao carregar clientes.</div>`;
            }
        };

        window.renderAdminCards = function(data) {
            const hoje = new Date().toLocaleDateString('en-CA');
            const list = document.getElementById('admin-cards-list');
            if(!list) return;

            if(data.length === 0) {
                list.innerHTML = `<div style="text-align:center; padding:40px; color:rgba(255,255,255,0.3);">Nenhum cliente encontrado.</div>`;
                return;
            }

            list.innerHTML = data.map(cfg => {
                const st = cfg.status || 'ativo';
                const isAdmin    = st === 'admin';
                const isAtivo    = st === 'ativo';
                const isTrial    = st === 'trial';
                const isBloqueado= st === 'bloqueado';

                // Badge de status
                let badge = '';
                if(isAdmin)     badge = `<span style="background:rgba(240,165,0,0.15); color:#f0a500; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">👑 Admin</span>`;
                if(isAtivo)     badge = `<span style="background:rgba(0,184,148,0.15); color:#00b894; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">✓ Ativo</span>`;
                if(isTrial)     badge = `<span style="background:rgba(243,156,18,0.15); color:#f39c12; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">⏳ Trial</span>`;
                if(isBloqueado) badge = `<span style="background:rgba(231,76,60,0.15); color:#e74c3c; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">🔒 Bloqueado</span>`;

                // Cor da borda
                const borderColor = isAdmin?'#f0a500': isAtivo?'#00b894': isTrial?'#f39c12':'#e74c3c';

                // Vencimento
                const venceEm = cfg.planoExpira || cfg.trialExpira || '—';
                const venceFormatted = venceEm !== '—' ? venceEm.split('-').reverse().join('/') : '—';
                const vencido = venceEm !== '—' && venceEm < hoje;

                // Plano
                const planoNome = (cfg.plano || 'pro').toUpperCase();
                const period = cfg.periodicidade === 'anual' ? 'Anual' : 'Mensal';

                // Último acesso
                const lastAccess = cfg.lastAccess ? cfg.lastAccess.split('-').reverse().join('/') : 'Nunca';

                // Botões de ação
                let acoes = '';
                if(!isAdmin) {
                    if(isBloqueado) {
                        acoes += `<button onclick="adminSetStatus('${cfg.docId}','ativo')" style="flex:1; padding:8px; background:rgba(0,184,148,0.15); color:#00b894; border:1px solid rgba(0,184,148,0.3); border-radius:8px; font-size:11px; font-weight:700; font-family:'Poppins',sans-serif; cursor:pointer;"><i class="fas fa-unlock"></i> Liberar</button>`;
                    } else {
                        acoes += `<button onclick="adminSetStatus('${cfg.docId}','bloqueado')" style="flex:1; padding:8px; background:rgba(231,76,60,0.1); color:#e74c3c; border:1px solid rgba(231,76,60,0.2); border-radius:8px; font-size:11px; font-weight:700; font-family:'Poppins',sans-serif; cursor:pointer;"><i class="fas fa-ban"></i> Bloquear</button>`;
                    }
                    acoes += `<button onclick="adminExtendPlan('${cfg.docId}','${cfg.plano||'pro'}')" style="flex:1; padding:8px; background:rgba(0,184,148,0.15); color:#00b894; border:1px solid rgba(0,184,148,0.3); border-radius:8px; font-size:11px; font-weight:700; font-family:'Poppins',sans-serif; cursor:pointer;"><i class="fas fa-calendar-plus"></i> Renovar</button>`;
                }

                return `
                <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-left:3px solid ${borderColor}; border-radius:14px; padding:16px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <div style="font-size:15px; font-weight:700; color:white; margin-bottom:3px;">${cfg.nomeOficina || cfg.name || 'Sem nome'}</div>
                            <div style="font-size:11px; color:rgba(255,255,255,0.4);">${cfg.email || '—'}</div>
                            <div style="font-size:11px; color:rgba(255,255,255,0.4); margin-top:2px;">${cfg.phone || '—'}</div>
                        </div>
                        <div style="text-align:right; flex-shrink:0; margin-left:10px;">
                            ${badge}
                            <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:6px; font-weight:700;">${planoNome} · ${period}</div>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
                        <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px 10px;">
                            <div style="font-size:9px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Último acesso</div>
                            <div style="font-size:12px; font-weight:700; color:rgba(255,255,255,0.7);">${lastAccess}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px 10px;">
                            <div style="font-size:9px; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Vencimento</div>
                            <div style="font-size:12px; font-weight:700; color:${vencido?'#e74c3c':'rgba(255,255,255,0.7)'};">${venceFormatted} ${vencido?'⚠':''}</div>
                        </div>
                    </div>
                    ${acoes ? `<div style="display:flex; gap:8px;">${acoes}</div>` : ''}
                </div>`;
            }).join('');
        };

        window.filterAdminList = function() {
            const term = document.getElementById('admin-search').value.toLowerCase();
            const filtered = window._adminData.filter(c =>
                (c.nomeOficina||c.name||'').toLowerCase().includes(term) ||
                (c.email||'').toLowerCase().includes(term)
            );
            renderAdminCards(filtered);
        };

        window.adminSetStatus = async function(docId, newStatus) {
            const acao = newStatus === 'bloqueado' ? 'BLOQUEAR' : 'LIBERAR';
            if(!confirm(`Tem certeza que deseja ${acao} esta oficina?`)) return;
            await window.updateDoc(window.doc(window.db, "configuracoes", docId), { status: newStatus });
            window.openSuperAdmin();
        };

        window.adminExtendPlan = async function(docId, plano) {
            const meses = prompt('Renovar por quantos meses?', '1');
            if(!meses || isNaN(meses)) return;
            const hoje = new Date();
            hoje.setMonth(hoje.getMonth() + parseInt(meses));
            const novaData = hoje.toLocaleDateString('en-CA');
            await window.updateDoc(window.doc(window.db, "configuracoes", docId), {
                status: 'ativo',
                plano: plano,
                planoExpira: novaData
            });
            alert(`✅ Plano renovado até ${novaData.split('-').reverse().join('/')}!`);
            window.openSuperAdmin();
        };

        // Mantém compatibilidade com o botão antigo
        window.toggleBlockClient = window.adminSetStatus;

        // --- ONBOARDING AUTOMÁTICO (INJEÇÃO DE CATÁLOGO) ---
        window.injectStarterCatalog = async function(user) {
            // Verifica no celular se já fizemos isso para não rodar duas vezes
            if(localStorage.getItem('authon_onboarding_done') === 'true') return;
            
            try {
                // Pergunta ao banco se o catálogo dessa pessoa realmente está zerado
                const q = window.query(window.collection(window.db, "catalogo"), window.where("uid", "==", user.uid));
                const querySnapshot = await window.getDocs(q);
                
                if (querySnapshot.empty) {
                    console.log("Injetando Catálogo Padrão (Efeito Uau)...");
                    
                    const servicos = [
                        // --- MECÂNICA ---
                        { type: 'servico', code: 'MEC-01', category: 'Mecânica', name: 'Troca de Óleo e Filtro', price: 150, stock: null },
                        { type: 'servico', code: 'MEC-02', category: 'Mecânica', name: 'Alinhamento e Balanceamento', price: 120, stock: null },
                        { type: 'servico', code: 'MEC-03', category: 'Mecânica', name: 'Revisão de Freios', price: 180, stock: null },
                        { type: 'servico', code: 'MEC-04', category: 'Mecânica', name: 'Limpeza de Bicos Injetores', price: 160, stock: null },
                        { type: 'servico', code: 'MEC-05', category: 'Mecânica', name: 'Suspensão / Troca de Amortecedores', price: 250, stock: null },
                        
                        // --- ESTÉTICA AUTOMOTIVA ---
                        { type: 'servico', code: 'EST-01', category: 'Estética', name: 'Lavagem Detalhada / Premium', price: 80, stock: null },
                        { type: 'servico', code: 'EST-02', category: 'Estética', name: 'Polimento Comercial', price: 350, stock: null },
                        { type: 'servico', code: 'EST-03', category: 'Estética', name: 'Higienização Interna (Bancos)', price: 250, stock: null },
                        { type: 'servico', code: 'EST-04', category: 'Estética', name: 'Vitrificação de Pintura', price: 800, stock: null },
                        { type: 'servico', code: 'EST-05', category: 'Estética', name: 'Cristalização de Vidros', price: 100, stock: null }
                    ];

                    // Dispara todos os serviços para a nuvem amarrados ao UID do novo cliente
                    for (let s of servicos) {
                        await window.addDoc(window.collection(window.db, "catalogo"), { ...s, uid: user.uid });
                    }
                }
                
                // Trava a porta do celular para nunca mais tentar injetar isso
                localStorage.setItem('authon_onboarding_done', 'true');
                
            } catch(e) {
                console.error("Erro no Onboarding Automático:", e);
            }
        }

          // --- SISTEMA DE INSPEÇÃO (LAUDO UNIFICADO COM QUANTIDADE) ---
        window.currentChecklist = { fuel: 'Reserva', damages: {} };
        window.checklistPhotos = [];
        window.tempSelectedPart = '';
        window.tempSelectedDamageType = '';
        window.tempDamagePhotoFile = null;
        window.tempDamageQty = 1; // NOVO: Guarda a quantidade

        window.openChecklist = function() {
            document.getElementById('modal-checklist').style.display = 'flex';
            renderCarDamages();
        }
        window.closeChecklist = function() { document.getElementById('modal-checklist').style.display = 'none'; }

        window.selectCarPart = function(partName) {
            window.tempSelectedPart = partName;
            
            // Reseta a quantidade para 1 sempre que abrir uma peça nova
            window.tempDamageQty = 1; 
            document.getElementById('damage-qty-display').innerText = '1';
            
            document.getElementById('damage-part-name').innerText = partName;
            document.getElementById('damage-type-buttons').style.display = 'block';
            document.getElementById('damage-photo-section').style.display = 'none';
            document.getElementById('camera-input').value = '';
            document.getElementById('modal-damage').style.display = 'flex';
        }

        // Ação dos botões + e -
        window.changeDamageQty = function(delta) {
            window.tempDamageQty += delta;
            if(window.tempDamageQty < 1) window.tempDamageQty = 1; // Não deixa ficar negativo ou zero
            document.getElementById('damage-qty-display').innerText = window.tempDamageQty;
        }

        window.saveDamage = function(type) {
            if(type === '') {
                delete window.currentChecklist.damages[window.tempSelectedPart];
                document.getElementById('modal-damage').style.display = 'none';
                renderCarDamages(); updateChecklistSummary();
                return;
            }
            
            // Se tiver mais de 1, adiciona o "3x " na frente do nome
            let finalType = type;
            if(window.tempDamageQty > 1) {
                finalType = `${window.tempDamageQty}x ${type}`;
            }
            
            window.tempSelectedDamageType = finalType;
            document.getElementById('damage-selected-type').innerText = finalType;
            document.getElementById('damage-type-buttons').style.display = 'none';
            document.getElementById('damage-photo-section').style.display = 'block';
            
            document.getElementById('damage-photo-preview').style.display = 'none';
            document.getElementById('btn-save-damage-photo').style.display = 'none';
            window.tempDamagePhotoFile = null;
        }


        window.handleDamagePhoto = function(event) {
            const file = event.target.files[0];
            if(!file) return;
            window.tempDamagePhotoFile = file; // Guarda temporariamente
            
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.getElementById('damage-photo-preview');
                img.src = e.target.result; img.style.display = 'block';
                document.getElementById('btn-save-damage-photo').style.display = 'block';
            }
            reader.readAsDataURL(file);
        }

        window.confirmDamageWithPhoto = function() {
            window.currentChecklist.damages[window.tempSelectedPart] = window.tempSelectedDamageType;
            if(window.tempDamagePhotoFile) {
                window.checklistPhotos.push(window.tempDamagePhotoFile); // Joga a foto na sacola
            }
            finalizeDamageEntry();
        }

        window.confirmDamageWithoutPhoto = function() {
            window.currentChecklist.damages[window.tempSelectedPart] = window.tempSelectedDamageType;
            finalizeDamageEntry();
        }

        function finalizeDamageEntry() {
            document.getElementById('modal-damage').style.display = 'none';
            renderCarDamages(); 
            updateChecklistSummary();
        }

          // A GRANDE ESTRELA: O ENVIO DIRETO E DOWNLOAD DE FOTOS
        window.sendFullReportWhatsApp = async function() {
            const client = document.getElementById('clientName').value || 'Cliente';
            const phone = document.getElementById('phone').value;
            
            // Trava de segurança: Exige o número do cliente
            if(!phone) {
                alert("Por favor, preencha o número de celular (WhatsApp) do cliente na tela de Nova Venda primeiro!");
                return;
            }
            
            const vehicle = document.getElementById('vehicle').value || 'Veículo';
            const plate = document.getElementById('plate').value || '';
            const compName = localStorage.getItem('authon_cfg_name') || "Nossa Oficina";
            
            const damagesKeys = Object.keys(window.currentChecklist.damages);
            if(damagesKeys.length === 0 && window.currentChecklist.fuel === 'Reserva') {
                 return alert("Você ainda não marcou nenhuma avaria ou alterou o combustível para enviar.");
            }

            // Constrói o texto do Laudo
            let text = `*${compName.toUpperCase()}*\n--------------------------------\nOlá *${client}*!\n\nRealizamos a inspeção prévia do seu veículo *${vehicle}* ${plate ? '('+plate.toUpperCase()+')' : ''} ao chegar.\n\n⛽ *Combustível:* ${window.currentChecklist.fuel}\n`;
            
            if(damagesKeys.length > 0) {
                text += `\n⚠️ *Avarias Identificadas na Lataria/Vidros:*\n`;
                damagesKeys.forEach(part => {
                    text += `- ${part}: ${window.currentChecklist.damages[part]}\n`;
                });
            } else {
                text += `\n✅ Nenhuma avaria identificada na lataria.\n`;
            }

            if(window.checklistPhotos.length > 0) {
                text += `\n📸 *As fotos das avarias foram registradas na oficina.* (Enviaremos a seguir caso necessário).\n`;
            }

            text += `\nEstamos cuidando de tudo! 🤝`;

            // --- A MÁGICA NOVA: DOWNLOAD AUTOMÁTICO DAS FOTOS ---
            if(window.checklistPhotos.length > 0) {
                alert("⚠️ O sistema vai baixar as fotos para o seu celular agora.\n\nO WhatsApp vai abrir em seguida. Basta clicar no clipe 📎 na conversa e enviar as fotos que foram salvas (geralmente ficam na pasta Downloads ou Recentes).");
                
                // Salva cada foto da sacola no celular do mecânico
                window.checklistPhotos.forEach((file, index) => {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `Avaria_${plate || 'Carro'}_Foto${index + 1}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                });
            }

            // Abre o Zap direto no número do dono do carro
            const numeroLimpo = phone.replace(/\D/g, ''); 
            window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(text)}`);
            
            // Fecha a janela do carro para o mecânico poder salvar a venda
            document.getElementById('modal-checklist').style.display = 'none';
        }

        window.renderCarDamages = function() {
            document.querySelectorAll('.car-part').forEach(el => {
                const partName = el.id.replace('part-', '');
                if(window.currentChecklist.damages[partName]) el.classList.add('damaged'); else el.classList.remove('damaged');
            });
        }

        window.setFuel = function(level) {
            window.currentChecklist.fuel = level;
            document.querySelectorAll('.btn-fuel').forEach(b => b.classList.remove('active'));
            document.getElementById('fuel-' + level).classList.add('active');
            updateChecklistSummary();
        }

        window.updateChecklistSummary = function() {
            let sum = `⛽ Combust. ${window.currentChecklist.fuel} <br>`;
            const parts = Object.keys(window.currentChecklist.damages);
            if(parts.length > 0) sum += `⚠️ ${parts.length} avaria(s) registrada(s).`; else sum += `✅ Nenhuma avaria na lataria.`;
            const divSummary = document.getElementById('checklist-summary');
            if(divSummary) divSummary.innerHTML = sum;
        }
          // --- SISTEMA DE FOTOS: ANTES E DEPOIS (MÚLTIPLAS FOTOS) ---
        window.ba_clientData = {};
        window.ba_photos = { before: [], after: [] };

        window.openBeforeAfterModal = function(client, vehicle, phone, plate) {
            window.ba_clientData = { client, vehicle, phone, plate };
            window.ba_photos = { before: [], after: [] };
            
            if(document.getElementById('camera-before')) document.getElementById('camera-before').value = '';
            if(document.getElementById('camera-after')) document.getElementById('camera-after').value = '';
            
            const prevBefore = document.getElementById('preview-before-container');
            const prevAfter = document.getElementById('preview-after-container');
            if(prevBefore) prevBefore.innerHTML = '';
            if(prevAfter) prevAfter.innerHTML = '';
            
            document.getElementById('modal-before-after').style.display = 'flex';
        }

        window.closeBeforeAfterModal = function() {
            document.getElementById('modal-before-after').style.display = 'none';
        }

        window.handleBA_Photo = function(event, type) {
            const files = Array.from(event.target.files);
            if(!files.length) return;
            
            window.ba_photos[type] = window.ba_photos[type].concat(files);
            
            const container = document.getElementById(`preview-${type}-container`);
            container.innerHTML = ''; 
            
            window.ba_photos[type].forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.height = '60px';
                    img.style.minWidth = '60px';
                    img.style.borderRadius = '6px';
                    img.style.objectFit = 'cover';
                    img.style.border = '1px solid #ccc';
                    container.appendChild(img);
                }
                reader.readAsDataURL(file);
            });
        }

         window.sendBeforeAfterWhatsApp = async function() {
            const { client, vehicle, phone, plate } = window.ba_clientData;
            const totalPhotos = window.ba_photos.before.length + window.ba_photos.after.length;

            if(!phone) return alert("Este cliente não tem um celular cadastrado para envio!");
            if(totalPhotos === 0) return alert("Você precisa adicionar pelo menos uma foto!");

            const compName = localStorage.getItem('authon_cfg_name') || "Nossa Oficina";
            
            // Texto do laudo
            let text = `*${compName.toUpperCase()}*\n--------------------------------\nOlá *${client}*, tudo bem? 😃\n\nO serviço no seu *${vehicle}* ${plate ? '('+plate.toUpperCase()+')' : ''} teve um resultado incrível!\n\n✨ *Dá uma olhada nas fotos do Antes e Depois.* ✨\n\nQualquer dúvida, estamos à disposição! 🤝`;

            const todasAsFotos = [...window.ba_photos.before, ...window.ba_photos.after];

            // TENTATIVA 1: O Compartilhamento Perfeito (Leva fotos e texto amarrados)
            if (navigator.canShare && navigator.canShare({ files: todasAsFotos })) {
                try {
                    await navigator.share({ text: text, files: todasAsFotos });
                    closeBeforeAfterModal();
                    return; // Sucesso absoluto, sai da função.
                } catch (error) { 
                    console.log('Compartilhamento nativo cancelado ou falhou', error); 
                    // Se o celular der erro, ele continua pro Plano B silenciosamente.
                }
            }

            // PLANO B: Download em Cascata (Engana o bloqueio de segurança do navegador)
            alert(`⚠️ O sistema vai baixar as ${totalPhotos} foto(s) para sua galeria agora.\n\nAguarde uns segundos. O WhatsApp vai abrir direto no cliente logo em seguida.\n\nBasta clicar no clipe 📎 e anexar as fotos salvas!`);
            
            let tempoDeEspera = 0;

            todasAsFotos.forEach((file, index) => {
                // Coloca um atraso (delay) entre cada download para não bloquear
                setTimeout(() => {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `Authon_${plate || 'Veiculo'}_Foto${index+1}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { window.URL.revokeObjectURL(url); }, 1000);
                    document.body.removeChild(a);
                }, tempoDeEspera);
                
                tempoDeEspera += 800; // 800 milissegundos de respiro entre cada foto
            });

            // Só abre o Zap depois que der tempo de baixar todas as fotos
            setTimeout(() => {
                const numeroLimpo = phone.replace(/\D/g, ''); 
                window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(text)}`);
                closeBeforeAfterModal();
            }, tempoDeEspera + 500);
        }
       
                // --- MOTOR DE ASSINATURA DIGITAL NA TELA ---
        let sigCanvas, sigCtx;
        let isDrawing = false;
        window.currentSignatureBase64 = null; // Guarda o texto leve da assinatura

        function initSignatureEngine() {
            sigCanvas = document.getElementById('sigCanvas');
            if(!sigCanvas) return;
            sigCtx = sigCanvas.getContext('2d');
            sigCtx.lineWidth = 3;
            sigCtx.lineCap = 'round';
            sigCtx.strokeStyle = '#2c3e50'; // Cor da tinta (Azul escuro chique)

            // Eventos para Celular (Touch)
            sigCanvas.addEventListener('touchstart', startDrawing, {passive: false});
            sigCanvas.addEventListener('touchmove', drawSignature, {passive: false});
            sigCanvas.addEventListener('touchend', stopDrawing, {passive: false});

            // Eventos para Computador (Mouse)
            sigCanvas.addEventListener('mousedown', startDrawing);
            sigCanvas.addEventListener('mousemove', drawSignature);
            sigCanvas.addEventListener('mouseup', stopDrawing);
            sigCanvas.addEventListener('mouseout', stopDrawing);
        }

        function getPointerPos(e) {
            let rect = sigCanvas.getBoundingClientRect();
            let clientX = e.clientX;
            let clientY = e.clientY;
            
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        function startDrawing(e) {
            e.preventDefault();
            isDrawing = true;
            let pos = getPointerPos(e);
            sigCtx.beginPath();
            sigCtx.moveTo(pos.x, pos.y);
        }

        function drawSignature(e) {
            if (!isDrawing) return;
            e.preventDefault();
            let pos = getPointerPos(e);
            sigCtx.lineTo(pos.x, pos.y);
            sigCtx.stroke();
        }

        function stopDrawing(e) {
            e.preventDefault();
            isDrawing = false;
        }

        window.clearSignature = function() {
            if(sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
            window.currentSignatureBase64 = null;
            document.getElementById('sigPreview').style.display = 'none';
        }

        window.openSignatureModal = function() {
            document.getElementById('signatureModal').style.display = 'flex';
            setTimeout(() => {
                if(!sigCtx) initSignatureEngine(); // Liga o motor na primeira vez
                clearSignature(); // Garante que começa limpo
            }, 100);
        }

           window.confirmSignature = function() {
            // Transforma o desenho no texto super leve (Base64)
            window.currentSignatureBase64 = sigCanvas.toDataURL('image/png');
            
            // Mostra na tela pro mecânico ver que salvou
            let preview = document.getElementById('sigPreview');
            preview.src = window.currentSignatureBase64;
            preview.style.display = 'block';
            
            // O SEGREDO AQUI: O comando correto para esconder a tela
            document.getElementById('signatureModal').style.display = 'none';
        }


               // --- SISTEMA CRM (MÁQUINA DE RETORNO DE CLIENTES) ---
        window.renderCRM = function() {
            const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
            const list = document.getElementById('crm-list');
            const daysFilter = parseInt(document.getElementById('crm-days').value) || 90;
            const compName = localStorage.getItem('authon_cfg_name') || "Nossa Oficina";

            list.innerHTML = '';

            // 1. Agrupar todas as visitas de cada cliente para descobrir a ÚLTIMA visita
            const clientsMap = {};
            const operations = db.filter(x => x.type === 'venda' || x.type === 'orcamento');

            operations.forEach(op => {
                if(!op.client || !op.phone) return;
                
                // Converte a data para comparar
                const opDate = new Date(op.date + 'T12:00:00');
                
                if(!clientsMap[op.client]) {
                    clientsMap[op.client] = { lastDate: opDate, phone: op.phone, vehicle: op.vehicle || 'Veículo', count: 1 };
                } else {
                    clientsMap[op.client].count++;
                    // Se essa data for mais recente, atualiza a última visita
                    if(opDate > clientsMap[op.client].lastDate) {
                        clientsMap[op.client].lastDate = opDate;
                        clientsMap[op.client].vehicle = op.vehicle || clientsMap[op.client].vehicle;
                        clientsMap[op.client].phone = op.phone || clientsMap[op.client].phone;
                    }
                }
            });

            // 2. Descobrir quem sumiu há mais de X dias
            const today = new Date();
            const dormantClients = [];

            for (let clientName in clientsMap) {
                const c = clientsMap[clientName];
                const diffTime = Math.abs(today - c.lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

                if (diffDays >= daysFilter) {
                    dormantClients.push({ name: clientName, ...c, daysAway: diffDays });
                }
            }

            // Ordenar: Quem está sumido há mais tempo aparece primeiro
            dormantClients.sort((a,b) => b.daysAway - a.daysAway);

            if(dormantClients.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:30px; color:#7f8c8d;"><i class="fas fa-glass-cheers" style="font-size:30px; margin-bottom:10px; color:#f1c40f;"></i><br>Nenhum cliente sumido nesse período!<br>A retenção da sua oficina está excelente!</div>';
                return;
            }

               // 3. Desenhar os "Cartões de Resgate" (COM MENSAGEM NEUTRA E VENDEDORA)
            dormantClients.forEach(c => {
                
                // Mensagem inteligente que foca em CUIDADO e não em serviços específicos
                const zapMsg = `Olá *${c.name}*, tudo bem? Aqui é da *${compName.toUpperCase()}*! 😃\n\nNotamos que já faz um tempinho desde a última vez que o seu *${c.vehicle}* passou por aqui.\n\nPassando para lembrar que estamos sempre à disposição para cuidar do seu veículo com a qualidade de sempre. Nossa equipe está pronta para te atender e deixar tudo 100%!\n\nVamos agendar um horário ou fazer um orçamento sem compromisso? É só me chamar aqui! 🤝`;
                
                const zapLink = `https://wa.me/55${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent(zapMsg)}`;
                const dateStr = c.lastDate.toISOString().split('T')[0].split('-').reverse().join('/');

                list.innerHTML += `
                <div class="item-card" style="border-left-color: #e67e22; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                            <strong style="font-size:16px; color:#2c3e50;">${c.name}</strong><br>
                            <small style="color:#7f8c8d; font-size:12px;">🚗 ${c.vehicle} <br>📱 ${c.phone}</small>
                        </div>
                        <span style="background:#fff3e0; color:#e67e22; padding:4px 8px; border-radius:8px; font-size:10px; font-weight:bold; white-space:nowrap; margin-left:10px;">
                            <i class="fas fa-clock"></i> ${c.daysAway} dias
                        </span>
                    </div>
                    
                    <div style="background:#f9f9f9; padding:8px; border-radius:8px; margin-top:10px; font-size:11px; color:#7f8c8d;">
                        <strong>Última visita:</strong> ${dateStr} <br>
                        <strong>Fidelidade:</strong> ${c.count} visita(s) no histórico
                    </div>
                    
                    <button class="btn-action" style="background:#25D366; color:white; font-size:12px; font-weight:bold; padding:12px; margin-top:15px; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);" onclick="window.open('${zapLink}')">
                        <i class="fab fa-whatsapp" style="font-size:16px;"></i> ENVIAR CONVITE DE RETORNO
                    </button>
                </div>`;
            });
        }

 
        
         // --- SISTEMA DE IMPRESSÃO TÉRMICA (MOTOR MATEMÁTICO DE 32 COLUNAS) ---
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
 

        window.onload = function() {
            const date = new Date();
            document.getElementById('date').value = date.toLocaleDateString('en-CA');
            document.getElementById('expDate').value = date.toLocaleDateString('en-CA');
            setDateRange('month');
            if(localStorage.getItem('authon_cfg_name')) document.getElementById('cfgName').value = localStorage.getItem('authon_cfg_name');
            if(localStorage.getItem('authon_cfg_cnpj')) document.getElementById('cfgCnpj').value = localStorage.getItem('authon_cfg_cnpj');
            if(localStorage.getItem('authon_cfg_addr')) document.getElementById('cfgAddr').value = localStorage.getItem('authon_cfg_addr');
            if(localStorage.getItem('authon_cfg_phone')) document.getElementById('cfgPhone').value = localStorage.getItem('authon_cfg_phone');

            if (!VERSAO_COM_ESTOQUE) document.getElementById('div-stock-input').style.display = 'none';

            if(localStorage.getItem('authon_cfg_pix')) document.getElementById('cfgPix').value = localStorage.getItem('authon_cfg_pix');
            if(localStorage.getItem('authon_cfg_warranty')) document.getElementById('cfgWarranty').value = localStorage.getItem('authon_cfg_warranty');

            updateDatalist(); updateClientDatalist(); renderCatalogList(); renderAgenda(); 
            
            // Histórico: inicia com filtro do mês atual
            const _today = new Date();
            const _hs = document.getElementById('histFilterStart');
            const _he = document.getElementById('histFilterEnd');
            if(_hs && _he) {
                _hs.value = new Date(_today.getFullYear(), _today.getMonth(), 1).toISOString().split('T')[0];
                _he.value = new Date(_today.getFullYear(), _today.getMonth()+1, 0).toISOString().split('T')[0];
            }
            // Despesas: inicia com filtro do mês atual
            const _es = document.getElementById('expFilterStart'), _ee = document.getElementById('expFilterEnd');
            if(_es && _ee) {
                _es.value = new Date(_today.getFullYear(), _today.getMonth(), 1).toISOString().split('T')[0];
                _ee.value = new Date(_today.getFullYear(), _today.getMonth()+1, 0).toISOString().split('T')[0];
            }
            renderHistory('all'); 
            updateDashboard(true); renderExpensesList(); addNewItem(); toggleFeeInput();
        };

        // --- FUNÇÕES FIREBASE (SALVAR NA NUVEM) ---
        async function saveToCloud(collectionName, data) {
            try {
                // Adiciona e espera o Google confirmar
                const docRef = await window.addDoc(window.collection(window.db, collectionName), data);
                return docRef.id;
            } catch (e) {
                console.error("Erro ao salvar na nuvem: ", e);
                alert("Erro de conexão! Tente novamente.");
            }
        }
        
        async function updateInCloud(collectionName, docId, data) {
             try {
                const itemRef = window.doc(window.db, collectionName, docId);
                await window.updateDoc(itemRef, data);
            } catch (e) { console.error("Erro ao atualizar: ", e); }
        }

        async function deleteFromCloud(collectionName, docId) {
            try {
                if(confirm("Tem certeza que deseja excluir?")) {
                    await window.deleteDoc(window.doc(window.db, collectionName, docId));
                    alert("Item excluído!");
                }
            } catch (e) { console.error("Erro ao deletar: ", e); }
        }

        // --- LÓGICA DO SISTEMA ---
        function clickNewTab(el) { resetForm(); setOpType('venda'); showTab('new', el); }

        function showTab(tab, el) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('tab-'+tab).classList.add('active');
            if(el) { el.classList.add('active'); } else { if(tab === 'new') document.querySelectorAll('.nav-item')[0].classList.add('active'); }
        }

                function setOpType(type) {
            document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.op-btn.'+type).classList.add('active');
            document.getElementById('opType').value = type;
            const btn = document.querySelector('.btn-gen');
            const divHora = document.getElementById('div-agendamento-info');

            if(type === 'venda') { 
                btn.innerText = 'SALVAR (PENDENTE)'; 
                btn.style.background = 'var(--green-grad)'; 
                if(divHora) divHora.style.display='none'; 
            } 
            else if (type === 'orcamento') { 
                btn.innerText = 'GERAR ORÇAMENTO (PDF)'; 
                btn.style.background = 'var(--orange-grad)'; 
                if(divHora) divHora.style.display='none'; 
            } 
            else { 
                btn.innerText = 'AGENDAR SERVIÇO'; 
                btn.style.background = 'var(--blue-grad)'; 
                if(divHora) divHora.style.display='block'; 
            }
        }


        function toggleFeeInput() {
            const payMethod = document.getElementById('payment').value;
            const divFee = document.getElementById('div-fee');
            if(payMethod.includes('Crédito') || payMethod.includes('Débito')) { divFee.style.display = 'block'; } 
            else { divFee.style.display = 'none'; document.getElementById('cardFee').value = ''; }
        }

        function updateClientDatalist() {
            const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
            const dl = document.getElementById('client-list'); dl.innerHTML = '';
            const uniqueClients = [...new Set(db.map(item => item.client))];
            uniqueClients.forEach(clientName => { if(clientName) { const option = document.createElement('option'); option.value = clientName; dl.appendChild(option); } });
        }

        function fillClientData(input) {
            const name = input.value;
            const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
            const lastRecord = db.find(item => item.client === name);
            if(lastRecord) {
                if(confirm(`Cliente encontrado! Preencher dados do ${lastRecord.vehicle}?`)) {
                    document.getElementById('phone').value = lastRecord.phone || '';
                    document.getElementById('vehicle').value = lastRecord.vehicle || '';
                    document.getElementById('plate').value = lastRecord.plate || '';
                    document.getElementById('color').value = lastRecord.color || '';
                    if(lastRecord.cpf) document.getElementById('clientCpf').value = lastRecord.cpf;
                }
            }
        }

        function setDateRange(type) {
            const today = new Date();
            const startInput = document.getElementById('filterStart'); const endInput = document.getElementById('filterEnd');
            if(type === 'today') { const str = today.toLocaleDateString('en-CA'); startInput.value = str; endInput.value = str; } 
            else if (type === 'month') { 
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                startInput.value = firstDay; endInput.value = lastDay;
            } else { startInput.value = ''; endInput.value = ''; }
            updateDashboard(true);
        }

        // --- SALVAR CONFIGURAÇÕES (SINCRONIZAÇÃO TOTAL EM NUVEM) ---
window.saveSettingsCustom = async function() {
    // 1. Verifica login
    const user = window.auth ? window.auth.currentUser : null;
    if(!user) return alert("Erro: Login não detectado. Recarregue a página.");
    
    const btn = event ? event.target : null;
    const originalText = btn ? btn.innerText : "SALVAR DADOS";
    if(btn) btn.innerText = "Sincronizando Nuvem...";

    // 2. Pega os valores dos campos
    const fees = {
        deb: document.getElementById('feeDeb') ? document.getElementById('feeDeb').value || '0' : '0',
        c1: document.getElementById('feeC1') ? document.getElementById('feeC1').value || '0' : '0',
        c2: document.getElementById('feeC2') ? document.getElementById('feeC2').value || '0' : '0',
        c3: document.getElementById('feeC3') ? document.getElementById('feeC3').value || '0' : '0',
        c4: document.getElementById('feeC4') ? document.getElementById('feeC4').value || '0' : '0',
        c5: document.getElementById('feeC5') ? document.getElementById('feeC5').value || '0' : '0',
        c6: document.getElementById('feeC6') ? document.getElementById('feeC6').value || '0' : '0'
    };

    const cfgData = {
        uid: user.uid,
        name: document.getElementById('cfgName') ? document.getElementById('cfgName').value : '',
        cnpj: document.getElementById('cfgCnpj') ? document.getElementById('cfgCnpj').value : '',
        addr: document.getElementById('cfgAddr') ? document.getElementById('cfgAddr').value : '',
        phone: document.getElementById('cfgPhone') ? document.getElementById('cfgPhone').value : '',
        team: document.getElementById('cfgTeam') ? document.getElementById('cfgTeam').value : '',
        pix: document.getElementById('cfgPix') ? document.getElementById('cfgPix').value : '',
        warranty: document.getElementById('cfgWarranty') ? document.getElementById('cfgWarranty').value : '',
        pin: document.getElementById('cfgPin') ? document.getElementById('cfgPin').value : '',
        logo: localStorage.getItem('oficina_logo') || '',
        feeDeb: fees.deb, feeC1: fees.c1, feeC2: fees.c2, 
        feeC3: fees.c3, feeC4: fees.c4, feeC5: fees.c5, feeC6: fees.c6
    };

    // 3. SALVA NO CELULAR AGORA (Para garantir funcionamento offline rápido)
    if(cfgData.name) localStorage.setItem('authon_cfg_name', cfgData.name);
    if(cfgData.cnpj) localStorage.setItem('authon_cfg_cnpj', cfgData.cnpj);
    if(cfgData.addr) localStorage.setItem('authon_cfg_addr', cfgData.addr);
    if(cfgData.phone) localStorage.setItem('authon_cfg_phone', cfgData.phone);
    if(cfgData.pix) localStorage.setItem('authon_cfg_pix', cfgData.pix);
    if(cfgData.warranty) localStorage.setItem('authon_cfg_warranty', cfgData.warranty);
    if(cfgData.pin) localStorage.setItem('authon_cfg_pin', cfgData.pin);
    if(cfgData.team) localStorage.setItem('authon_cfg_team', cfgData.team);
    
    localStorage.setItem('authon_fee_deb', fees.deb);
    localStorage.setItem('authon_fee_c1', fees.c1);
    localStorage.setItem('authon_fee_c2', fees.c2);
    localStorage.setItem('authon_fee_c3', fees.c3);
    localStorage.setItem('authon_fee_c4', fees.c4);
    localStorage.setItem('authon_fee_c5', fees.c5);
    localStorage.setItem('authon_fee_c6', fees.c6);

    // 4. A MÁGICA: FORÇA A BUSCA NA NUVEM ANTES DE SALVAR
    try {
        // Pergunta ao Firebase se esse usuário JÁ TEM uma configuração salva
        const q = window.query(window.collection(window.db, "configuracoes"), window.where("uid", "==", user.uid));
        const querySnapshot = await window.getDocs(q);

        if (!querySnapshot.empty) {
            // Já existe na nuvem! Pega a ID real de lá e ATUALIZA os dados, sem duplicar.
            const cloudDocId = querySnapshot.docs[0].id;
            await window.updateDoc(window.doc(window.db, "configuracoes", cloudDocId), cfgData);
            
            // Grava a ID no celular novo para ele não precisar perguntar de novo
            localStorage.setItem('authon_config_doc_id', cloudDocId);
        } else {
            // É literalmente a primeira vez que essa oficina está usando o app
            const newDoc = await window.addDoc(window.collection(window.db, "configuracoes"), cfgData);
            localStorage.setItem('authon_config_doc_id', newDoc.id);
        }
        
        alert("✅ Dados salvos e sincronizados em todos os aparelhos da oficina!");
    } catch(e) {
        console.error("Erro config:", e);
        alert("Salvo no celular atual. Sincronizaremos com os outros quando houver internet.");
    }
    
    if(btn) btn.innerText = originalText;
}

window.toggleSettingsSection = function(id) {
    // Fecha todos primeiro (opcional, para ficar estilo "sanfona")
    document.querySelectorAll('.settings-content').forEach(el => {
        if(el.id !== id) el.style.display = 'none';
    });

    // Abre ou fecha o clicado
    const el = document.getElementById(id);
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
}


        function toggleCatType(type) {
            document.getElementById('catType').value = type;
            const divStock = document.getElementById('div-stock-input');
            if(divStock) divStock.style.display = (type === 'produto' && VERSAO_COM_ESTOQUE) ? 'block' : 'none';
            document.getElementById('btn-type-prod').className = type === 'produto' ? 'op-btn active venda' : 'op-btn';
            document.getElementById('btn-type-serv').className = type === 'servico' ? 'op-btn active agendamento' : 'op-btn';
        }
       // --- SALVAR ITEM NO CATÁLOGO (CORRIGIDO COM ID EXCLUSIVO) ---
window.saveCatalogItem = async function() {
    const user = auth.currentUser;
    if(!user) return alert("Erro: Não logado.");

    const type = document.getElementById('catType').value;
    const code = document.getElementById('catCode').value || 'S/N';
    const category = document.getElementById('catCategory').value || 'Geral';
    const name = document.getElementById('catName').value; 
    const price = document.getElementById('catPrice').value;
    const stock = document.getElementById('catStock').value;
    
    // AGORA ELE USA O ID EXCLUSIVO DO ESTOQUE
    const editDocId = document.getElementById('catFirebaseDocId').value; 

    if(!name) return alert('Digite o nome do item');

    const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    if (code && code.toUpperCase() !== 'S/N') {
        const exists = cat.find(item => item.code === code);
        if (exists && exists.docId !== editDocId) {
            return alert(`⛔ ERRO: O código "${code}" já está sendo usado no produto:\n"${exists.name}".\n\nPor favor, use um código diferente.`);
        }
    }

    const finalStock = (typeof VERSAO_COM_ESTOQUE !== 'undefined' && VERSAO_COM_ESTOQUE && type === 'produto' && stock) ? parseInt(stock) : null;
    
    const itemData = { 
        uid: user.uid,
        type, code, category, name, price, stock: finalStock 
    };

    const btn = event.target;
    btn.innerText = "Salvando...";

    try {
        if(editDocId) {
            await updateDoc(doc(db, "catalogo", editDocId), itemData);
            alert('Produto atualizado na nuvem!');
            // LIMPA A CAIXA EXCLUSIVA DEPOIS DE SALVAR
            document.getElementById('catFirebaseDocId').value = ''; 
        } else {
            await addDoc(collection(db, "catalogo"), itemData);
            alert('Novo item salvo na nuvem!');
        }

        document.getElementById('catName').value = ''; 
        document.getElementById('catCode').value = ''; 
        document.getElementById('catPrice').value = ''; 
        document.getElementById('catStock').value = '';
        document.getElementById('catalogEditIdx').value = '';
        
    } catch(e) {
        console.error(e);
        alert("Erro ao salvar: " + e.message);
    }
    btn.innerText = "Salvar no Catálogo";
}

// --- EDITAR ITEM DO CATÁLOGO (CORRIGIDO COM ID EXCLUSIVO) ---
window.editCatalogItem = function(idx) {
    if(localStorage.getItem('authon_mode_locked') === 'true') return alert("⛔ Bloqueado para funcionários.");

    const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const item = cat[idx]; 
    if(!item) return;

    document.getElementById('catType').value = item.type;
    toggleCatType(item.type);
    
    document.getElementById('catCode').value = item.code;
    document.getElementById('catCategory').value = item.category;
    document.getElementById('catName').value = item.name;
    document.getElementById('catPrice').value = item.price;
    document.getElementById('catStock').value = item.stock !== null ? item.stock : '';
    
    // GUARDA O ID DO FIREBASE NA CAIXA NOVA E EXCLUSIVA
    document.getElementById('catFirebaseDocId').value = item.docId; 
    document.getElementById('catalogEditIdx').value = idx;

    document.querySelector('#tab-catalog .container').scrollIntoView({behavior: 'smooth'});
    alert('Editando: ' + item.name + '.\nAltere o que precisar e clique em "Salvar".');
}

                function renderCatalogList() {
            const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]'); 
            const div = document.getElementById('catalog-list'); 
            const searchInput = document.getElementById('catalogSearch'); 
            const term = searchInput ? searchInput.value.toLowerCase() : ''; 
            div.innerHTML = '';

            cat.forEach((c, idx) => { 
                const fullText = `${c.name} ${c.code} ${c.category}`.toLowerCase(); 
                if(term && !fullText.includes(term)) return;
                
                // Define visual do estoque ou serviço
                let stockHtml = '';
                if (c.type === 'servico') {
                    stockHtml = '<span class="stock-badge stock-ok" style="background:#e1f5fe; color:#0277bd">Serviço</span>';
                } else if (VERSAO_COM_ESTOQUE && c.stock !== null) {
                    stockHtml = `<span class="stock-badge ${c.stock <= 0 ? 'stock-zero' : (c.stock < 6 ? 'stock-low' : 'stock-ok')}">Estoque: ${c.stock}</span>`;
                }

                let icon = c.type === 'servico' ? '<i class="fas fa-wrench" style="color:#ccc;"></i>' : '<i class="fas fa-box" style="color:#ccc;"></i>';
                
                // AQUI ESTÁ A MUDANÇA: ADICIONAMOS O ÍCONE DE LÁPIS (fa-edit)
                div.innerHTML += `
                <div class="catalog-item">
                    <div style="font-size:13px;">
                        ${icon} <strong>${c.name}</strong> <small>(${c.code})</small><br>
                        <span style="font-size:10px; background:#f5f5f5; padding:2px 5px; border-radius:4px;">${c.category}</span> ${stockHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <strong>R$ ${c.price}</strong> 
                        <i class="fas fa-edit" style="color:#2980b9; cursor:pointer;" onclick="editCatalogItem(${idx})"></i>
                        <i class="fas fa-trash" style="color:var(--primary); cursor:pointer;" onclick="delCatalog(${idx})"></i>
                    </div>
                </div>`; 
            });
        }

        // --- FUNÇÃO DE EXCLUIR DO ESTOQUE (COM PERGUNTA DE SEGURANÇA) ---
        // Substitua a função delCatalog por esta:
window.delCatalog = async function(idx) {
    if(localStorage.getItem('authon_mode_locked') === 'true') return alert("⛔ Bloqueado para funcionários.");
    
    const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
    const item = cat[idx];
    
    if (item && item.docId && confirm(`Excluir "${item.name}" da nuvem?`)) {
        try {
            await deleteDoc(doc(db, "catalogo", item.docId));
            alert("Item excluído!");
        } catch(e) {
            alert("Erro ao excluir: " + e.message);
        }
    } else if (!item.docId) {
        alert("Erro: Item sem ID da nuvem. Tente recarregar a página.");
    }
}
        function updateDatalist() { const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]'); const dl = document.getElementById('services-datalist'); if(!dl) return; dl.innerHTML = ''; cat.forEach(c => { const opt = document.createElement('option'); opt.value = `${c.code} - ${c.name} (${c.category})`; dl.appendChild(opt); }); }

        function onServiceChange(input) { 
            const row = input.parentElement.parentElement; const valInput = row.querySelector('.val'); const qtyInput = row.querySelector('.qty'); const warningText = row.querySelector('.stock-warning-text'); const cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]'); 
            const found = cat.find(c => `${c.code} - ${c.name} (${c.category})` === input.value); 
            input.classList.remove('input-low-stock'); if(warningText) warningText.style.display = 'none';
            if(found) { 
                row.dataset.unitPrice = found.price; const currentQty = parseFloat(qtyInput.value) || 1; valInput.value = (found.price * currentQty).toFixed(2); calcTotal(); 
                if(VERSAO_COM_ESTOQUE && found.type === 'produto' && found.stock !== null) {
                    row.dataset.stockMax = found.stock;
                    if(found.stock <= 0) { alert(`ESGOTADO: "${found.name}" tem 0 no estoque.`); input.value = ""; valInput.value = ""; calcTotal(); return; }
                    if(found.stock < 6) { input.classList.add('input-low-stock'); if(warningText) { warningText.innerText = `⚠️ RESTAM ${found.stock}!`; warningText.style.display = 'block'; } }
                } else { delete row.dataset.stockMax; }
            } 
        }

        function updateRowTotal(qtyInput) {
            const row = qtyInput.parentElement.parentElement; const valInput = row.querySelector('.val'); let unitPrice = parseFloat(row.dataset.unitPrice);
            if(!isNaN(unitPrice)) {
                const qty = parseFloat(qtyInput.value); 
                if(!isNaN(qty)) { valInput.value = (unitPrice * qty).toFixed(2); calcTotal(); }
                if(VERSAO_COM_ESTOQUE) {
                    const stockMax = row.dataset.stockMax ? parseFloat(row.dataset.stockMax) : null;
                    if(stockMax !== null && qty > stockMax) { alert(`Você só tem ${stockMax} em estoque!`); qtyInput.value = stockMax; valInput.value = (unitPrice * stockMax).toFixed(2); calcTotal(); }
                }
            }
        }

        function addNewItem(desc='', val='', qty=1) { 
            const div = document.createElement('div'); div.className = 'service-row'; 
            div.innerHTML = `<div class="stock-warning-text"></div><div class="input-group"><label>QTD</label><input type="number" class="qty" value="${qty}" min="1" oninput="updateRowTotal(this)"></div><div class="input-group"><label>DESCRIÇÃO</label><input type="text" class="desc" list="services-datalist" placeholder="Buscar..." value="${desc}" onchange="onServiceChange(this)"></div><div class="input-group"><label>TOTAL</label><input type="number" class="val" placeholder="0.00" value="${val}" oninput="calcTotal()"></div><button class="btn-trash" onclick="this.parentElement.remove(); calcTotal()"><i class="fas fa-trash-alt"></i></button>`; 
            const list = document.getElementById('services-list'); if(list) list.appendChild(div); if(val && qty) { div.dataset.unitPrice = (parseFloat(val) / parseFloat(qty)).toFixed(2); }
        }
        
        function calcTotal() { let t = 0; document.querySelectorAll('.val').forEach(i => t += Number(i.value)); const discount = parseFloat(document.getElementById('discount').value) || 0; document.getElementById('display-total').innerText = (t - discount).toLocaleString('pt-BR', {minimumFractionDigits:2}); }
        
                                async function saveOperation() {
            const type = document.getElementById('opType').value; 
            const client = document.getElementById('clientName').value; 
            const totalStr = document.getElementById('display-total').innerText; 
            const totalVal = parseFloat(totalStr.replace('.','').replace(',','.'));
            const discountVal = parseFloat(document.getElementById('discount').value) || 0;
            const km = document.getElementById('currentKm').value; 
            const cpf = document.getElementById('clientCpf').value;
            
            // Validação
            if(!client) return alert("Por favor, preencha o nome do Cliente.");
            if(type !== 'agendamento' && totalVal <= 0) return alert("Adicione serviços ou peças para salvar.");

            const items = []; 
            document.querySelectorAll('.service-row').forEach(r => { 
                const d = r.querySelector('.desc').value; 
                const v = r.querySelector('.val').value; 
                const q = r.querySelector('.qty').value; 
                if(d) items.push({ desc: d, val: v, qty: q });
            });

            // Baixa no Estoque (apenas se for Venda) - CORRIGIDO PARA A NUVEM
            if(type === 'venda' && VERSAO_COM_ESTOQUE) {
                let cat = JSON.parse(localStorage.getItem('catalog_v1') || '[]'); 
                items.forEach(soldItem => {
                    const foundItem = cat.find(c => `${c.code} - ${c.name} (${c.category})` === soldItem.desc);
                    
                    if(foundItem && foundItem.type === 'produto' && foundItem.stock !== null) { 
                        const newStock = foundItem.stock - (parseInt(soldItem.qty) || 1); 
                        
                        // Atualiza direto no Firebase usando o ID real do produto
                        if(foundItem.docId) {
                            updateInCloud("catalogo", foundItem.docId, { stock: newStock });
                        }
                    }
                });
            }

            // Status Inicial
            const initialStatus = (type === 'agendamento') ? 'agendado' : 'pendente';
            
            // --- PACOTE DE DADOS CORRIGIDO COM O CHECKLIST ---
            const data = { 
                id: document.getElementById('editId').value ? Number(document.getElementById('editId').value) : Date.now(), 
                type: type, status: initialStatus,
                date: document.getElementById('date').value,
                client: client, 
                seller: document.getElementById('sellerName').value,
                time: document.getElementById('time').value, 
                phone: document.getElementById('phone').value, 
                vehicle: document.getElementById('vehicle').value, 
                plate: document.getElementById('plate').value, 
                color: document.getElementById('color').value,
                km: km, cpf: cpf, items: items, 
                    signature: window.currentSignatureBase64 || null,

                
                checklist: window.currentChecklist, // <--- A MÁGICA DA INSPEÇÃO ESTÁ AQUI
                
                total: totalVal, netTotal: totalVal, discount: discountVal,
                payment: ''
            };
            
             const docId = document.getElementById('firebaseDocId').value;
            
            if(docId) {
                await updateInCloud("operacoes", docId, data);
            } else {
                await saveToCloud("operacoes", data);
            }
    window.clearSignature(); // Limpa o quadro e a memória

            updateClientDatalist(); 
            
            // --- NOVA LÓGICA DE DIRECIONAMENTO ---
            if (type === 'venda') {
                resetForm(); // Limpa a tela
                // Vai direto para a aba de Histórico automaticamente
                const histTab = document.querySelector('.nav-item[onclick*="history"]');
                showTab('history', histTab);
                
            } else if (type === 'agendamento') {
                alert("Agendamento Salvo com Sucesso!");
                resetForm();
                // Vai direto para a aba de Agenda
                const agendTab = document.querySelector('.nav-item[onclick*="agenda"]');
                showTab('agenda', agendTab);
                
            } else {
                // Se for Orçamento, continua gerando o PDF na hora
                generatePDF(data); 
            }
        }



               // --- SISTEMA (ATENDER/EDITAR) ---
        window.loadToEdit = function(id, forceVenda = false) { 
            // 1. Primeiro buscamos o item para checar o STATUS dele
            const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]'); 
            const item = db.find(x => x.id == id); 
            if(!item) return; 

            // --- TRAVA DE SEGURANÇA INTELIGENTE ---
            // Se o Modo Vendedor estiver ATIVO:
            if(localStorage.getItem('authon_mode_locked') === 'true') {
                // Se a venda JÁ ESTIVER PAGA, bloqueia a edição.
                if(item.status === 'pago' && !forceVenda) {
                    return alert("⛔ AÇÃO BLOQUEADA: Vendas já PAGAS (Finalizadas) não podem ser alteradas pelo vendedor.");
                }
                // Se for "pendente" ou "orçamento", o código passa direto e deixa editar.
            }
            // --------------------------------------
            
            // Carrega IDs para edição na nuvem
            document.getElementById('editId').value = item.id; 
            document.getElementById('firebaseDocId').value = item.docId; 

            document.getElementById('date').value = item.date; 
            document.getElementById('time').value = item.time || ''; 
            document.getElementById('phone').value = item.phone; 
            document.getElementById('clientName').value = item.client;
            // NOVO: Carrega o vendedor se tiver
            if(document.getElementById('sellerName')) document.getElementById('sellerName').value = item.seller || '';
            document.getElementById('vehicle').value = item.vehicle; 
            document.getElementById('plate').value = item.plate; 
            document.getElementById('color').value = item.color || '';
            document.getElementById('currentKm').value = item.km || ''; 
            document.getElementById('clientCpf').value = item.cpf || '';
            
            document.getElementById('services-list').innerHTML = ''; 
            item.items.forEach(i => addNewItem(i.desc, i.val, i.qty)); 
            
            calcTotal(); 
            
            if(forceVenda) { 
                setOpType('venda'); 
                const date = new Date();
                document.getElementById('date').value = date.toLocaleDateString('en-CA');
            } else { 
                setOpType(item.type); 
            }

            showTab('new', document.querySelector('.nav-item')); 
        }


        // --- AGENDA (LEMBRETE NO ZAP TURBINADO) ---
window.renderAgenda = function() {
    const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]'); 
    const list = document.getElementById('agenda-list'); 
    
    // Pega o termo de busca
    const searchInput = document.getElementById('agendaSearch');
    const term = searchInput ? searchInput.value.toLowerCase() : '';

    // Pega o nome da oficina salvo nas configurações
    const compName = localStorage.getItem('authon_cfg_name') || "Nossa Oficina";

    list.innerHTML = '';
    
    const agendas = db.filter(x => x.type === 'agendamento').sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
    
    agendas.forEach(item => { 
        // Filtro de busca
        const fullText = (item.client + ' ' + item.vehicle + ' ' + (item.plate || '') + ' ' + item.date).toLowerCase();
        if(term && !fullText.includes(term)) return;

        // Extrai os serviços para colocar na mensagem do Zap
        let servicosAgendados = "Revisão / Manutenção"; 
        if (item.items && item.items.length > 0) {
            servicosAgendados = item.items.map(i => {
                let desc = i.desc;
                // Limpa o texto (Ex: "001 - Alinhamento" vira só "Alinhamento")
                if(desc.includes(' - ')) {
                    try { desc = desc.split(' - ')[1].split(' (')[0]; } catch(e){}
                }
                return desc;
            }).join(', ');
        }

        // A NOVA MENSAGEM PROFISSIONAL
        const msg = `Olá *${item.client}*, tudo bem? Aqui é da *${compName}*! ⚙️\n\nPassando para confirmar o nosso agendamento para o seu *${item.vehicle}*.\n\n📅 *Data:* ${item.date.split('-').reverse().join('/')}\n⏰ *Horário:* ${item.time}\n🔧 *Serviços:* ${servicosAgendados}\n\nEstamos te esperando! Se houver algum imprevisto, é só nos avisar por aqui. 🤝`;
        
        const link = `https://wa.me/55${item.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
        
        let itensHtml = '<ul style="margin:5px 0 5px 15px; padding:0; font-size:11px; color:#555;">';
        item.items.forEach(i => itensHtml += `<li>${i.desc}</li>`); itensHtml += '</ul>';
        
        const valorHtml = `<div style="font-weight:bold; font-size:15px; color:#2c3e50; margin-top:5px; border-top:1px dashed #eee; padding-top:5px;">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`;

        list.innerHTML += `<div class="item-card st-agenda"><span class="status-badge bg-agenda">AGENDA</span><strong>${item.date.split('-').reverse().join('/')} às ${item.time}</strong><br><span style="font-size:14px">${item.client}</span><br><small style="color:#7f8c8d">${item.vehicle} - ${item.phone}</small>${itensHtml}${valorHtml}<div class="card-actions"><button class="btn-card btn-notify" onclick="window.open('${link}')"><i class="fab fa-whatsapp"></i> LEMBRAR CLIENTE</button><button class="btn-card" style="color:var(--primary); background:#ffebee;" onclick="deleteItem('${item.docId}')"><i class="fas fa-trash"></i></button><button class="btn-card" style="background:#27ae60; color:white" onclick="loadToEdit(${item.id}, true)"><i class="fas fa-check"></i> ATENDER</button></div></div>`; 
    });
}
// ── HISTÓRICO: Renderiza com filtro de status + período ──
window.renderHistory = function(filter) { 
    window.currentHistoryFilter = filter;

    const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]'); 
    const list = document.getElementById('history-list'); 
    
    const term = (document.getElementById('historySearch')?.value || '').toLowerCase();
    const hStart = document.getElementById('histFilterStart')?.value || '';
    const hEnd   = document.getElementById('histFilterEnd')?.value   || '';

    list.innerHTML = ''; 
    const compName = localStorage.getItem('authon_cfg_name') || "SUA OFICINA";

    // Filtro de tipo/status
    let filtered = db.filter(x => x.type !== 'agendamento' && x.type !== 'expense'); 
    if(filter === 'venda')     filtered = filtered.filter(x => x.type === 'venda');
    if(filter === 'orcamento') filtered = filtered.filter(x => x.type === 'orcamento');
    if(filter === 'pendente')  filtered = filtered.filter(x => x.status === 'pendente');
    if(filter === 'pago')      filtered = filtered.filter(x => x.status === 'pago');

    // Filtro de período
    if(hStart) filtered = filtered.filter(x => x.date >= hStart);
    if(hEnd)   filtered = filtered.filter(x => x.date <= hEnd);

    filtered.sort((a,b) => b.id - a.id);
    const savedPix = localStorage.getItem('authon_cfg_pix') || ''; 

    // Animação do botão receber
    if (!document.getElementById('style-soft-pulse')) {
        document.head.insertAdjacentHTML('beforeend', '');
    }

    if(filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#bdc3c7;">
            <i class="fas fa-folder-open" style="font-size:40px; margin-bottom:12px; display:block;"></i>
            <div style="font-size:14px; font-weight:600;">Nenhum registro encontrado</div>
            <div style="font-size:12px; margin-top:5px;">Tente mudar o período ou filtro</div>
        </div>`;
        return;
    }

    filtered.forEach(item => { 
        const fullText = (item.client + ' ' + item.vehicle + ' ' + (item.plate||'') + ' ' + item.total).toLowerCase();
        if(term && !fullText.includes(term)) return;

        let badgeClass = ''; let statusText = item.type.toUpperCase(); 
        let actionBtn = ''; let highlightPayBtn = '';
        
        let priceDisplay = `<div style="font-weight:900; font-size:22px; color:var(--dark);">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`;
        if(item.netTotal && item.netTotal < item.total) {
            priceDisplay = `
                <div style="font-weight:900; font-size:22px; color:var(--dark);">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                <div style="font-size:11px; color:#c0392b; font-weight:700; margin-top:-2px;">Liq: R$ ${item.netTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
            `;
        }

        const escapedName    = item.client  ? item.client.replace(/'/g, "\\'")  : '';
        const escapedVehicle = item.vehicle ? item.vehicle.replace(/'/g, "\\'") : '';
        const escapedPlate   = item.plate   ? item.plate.replace(/'/g, "\\'")   : '';
        
        const btnAntesDepois = `<button class="btn-card" style="background:#7f8c8d; color:white; flex:1; box-shadow:none;" onclick="openBeforeAfterModal('${escapedName}', '${escapedVehicle}', '${item.phone}', '${escapedPlate}')"><i class="fas fa-camera-retro" style="opacity:0.8;"></i> Antes & Depois</button>`;

        if(item.type === 'venda') {
            if(item.status === 'pendente') {
                badgeClass = 'bg-pendente'; statusText = 'PENDENTE';
                let pixText = savedPix ? `\n\n🔑 Chave Pix: ${savedPix}` : '';
                const zapMsg = `*${compName}* \n--------------------------------\nOlá *${item.client}*, boas notícias! 😃\n\nO serviço no seu *${item.vehicle || 'veículo'}* foi finalizado com sucesso! ✨\n\n💰 *Total:* R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}${pixText}\n\nJá está liberado para retirada. Fico no aguardo! 🤝`;
                const zapLink = `https://wa.me/55${item.phone.replace(/\D/g,'')}?text=${encodeURIComponent(zapMsg)}`;
                actionBtn = `${btnAntesDepois}<button class="btn-card btn-notify" onclick="window.open('${zapLink}')" style="flex:1;"><i class="fab fa-whatsapp"></i> AVISAR</button>`;
                highlightPayBtn = `
                <button class="btn-action" style="background:var(--green-grad); display:block; width:80%; max-width:260px; margin: 15px auto 10px auto; font-size:13px; padding:12px; border-radius:12px; animation: softPulse 2.5s infinite;" onclick="window.openPayModal('${item.docId}', ${item.total})">
                    <i class="fas fa-hand-holding-usd" style="font-size:16px; margin-right:8px;"></i> RECEBER PAGAMENTO
                </button>`;
            } else { 
                badgeClass = 'bg-venda'; statusText = 'PAGO'; 
                actionBtn = `${btnAntesDepois}`; 
            }
        } else { 
            badgeClass = 'bg-orcamento'; 
        }

        let itemsHtml = '<ul style="margin:8px 0 8px 18px; padding:0; font-size:12px; color:#555;">';
        if(item.items && item.items.length > 0) {
            item.items.forEach(i => {
                let cleanDesc = i.desc;
                if(cleanDesc.includes(' - ') && cleanDesc.includes('(')) { 
                    try { cleanDesc = cleanDesc.split(' - ')[1].split(' (')[0]; } catch(e) {} 
                }
                itemsHtml += `<li>${i.qty}x ${cleanDesc}</li>`;
            });
        } else { itemsHtml += '<li>(Sem itens descritos)</li>'; }
        itemsHtml += '</ul>';

        const plateInfo    = item.plate ? ` | <span style="font-weight:bold; background:#eee; padding:2px 5px; border-radius:4px;">${item.plate.toUpperCase()}</span>` : '';
        const subInfo      = `${item.vehicle || 'Veículo não inf.'}${plateInfo} <br> ${item.phone}`;
        const dateFormatted = item.date.split('-').reverse().join('/');

        list.innerHTML += `
        <div class="item-card" style="padding: 20px; border-left: 6px solid #ccc; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:16px; margin:0; color:var(--dark); font-weight:800;">${dateFormatted}</h3>
                <span class="status-badge ${badgeClass}" style="position:static;">${statusText}</span>
            </div>
            <div style="margin-bottom:5px;">
                <div style="font-size:16px; font-weight:600; color:#2c3e50;">${item.client}</div>
                <div style="font-size:12px; color:#7f8c8d; margin-top:3px; line-height:1.4;">${subInfo}</div>
            </div>
            ${itemsHtml}
            <hr style="border:0; border-top:1px dashed #eee; margin:10px 0;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px;">
                <div style="flex-shrink:0;">
                    <span style="font-size:11px; color:#7f8c8d; font-weight:bold; text-transform:uppercase;">Valor Total:</span>
                    ${priceDisplay}
                </div>
            </div>
            ${highlightPayBtn}
            <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:space-between; margin-top:10px;">
                <div style="display:flex; gap:5px; flex:1;">${actionBtn}</div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-card" style="background:var(--dark); color:white; min-width:35px;" onclick="generatePDFFromHistory(${item.id})"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-card" style="background:#ecf0f1; color:var(--dark); min-width:35px;" onclick="loadToEdit(${item.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-card" style="color:var(--primary); background:#ffebee; min-width:35px;" onclick="deleteItem('${item.docId}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`; 
    }); 
}



                        // 1. Abre o Modal e já faz o primeiro cálculo
        window.openPayModal = function(docId, totalVal) {
            document.getElementById('modal-pay').style.display = 'flex';
            document.getElementById('modal-pay-value').innerText = "R$ " + totalVal.toLocaleString('pt-BR', {minimumFractionDigits:2});
            document.getElementById('modal-pay-docid').value = docId;
            document.getElementById('modal-pay-total').value = totalVal;
            
            // Reseta para Pix e calcula
            document.getElementById('modal-pay-select').value = "Pix";
            calculateModalNet();
        }

        // Substitua as funções calculateModalNet e confirmPayment por estas:

// Função auxiliar para ler número com vírgula ou ponto
function getFee(key) {
    let val = localStorage.getItem(key) || '0';
    val = val.replace(',', '.'); // Troca vírgula por ponto
    return parseFloat(val) || 0;
}

window.calculateModalNet = function() {
    const total = parseFloat(document.getElementById('modal-pay-total').value);
    const method = document.getElementById('modal-pay-select').value;
    
    let rate = 0;
    if(method === 'Débito') rate = getFee('authon_fee_deb');
    if(method === 'Crédito 1x') rate = getFee('authon_fee_c1');
    if(method === 'Crédito 2x') rate = getFee('authon_fee_c2');
    if(method === 'Crédito 3x') rate = getFee('authon_fee_c3');
    if(method === 'Crédito 4x') rate = getFee('authon_fee_c4');
    if(method === 'Crédito 5x') rate = getFee('authon_fee_c5');
    if(method === 'Crédito 6x') rate = getFee('authon_fee_c6');

    const discount = total * (rate / 100);
    const net = total - discount;

    const netEl = document.getElementById('modal-pay-net');
    
    if(rate > 0) {
        // Mostra a taxa e o desconto
        netEl.innerHTML = `Taxa: <b>${rate}%</b> (- R$ ${discount.toLocaleString('pt-BR', {minimumFractionDigits:2})}) <br> Líquido: <b style="color:#27ae60">R$ ${net.toLocaleString('pt-BR', {minimumFractionDigits:2})}</b>`;
        netEl.style.color = "#c0392b";
    } else {
        netEl.innerHTML = `Taxa: 0% | Líquido: <b>R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}</b>`;
        netEl.style.color = "#7f8c8d";
    }
}

window.confirmPayment = async function() {
    const docId = document.getElementById('modal-pay-docid').value;
    const total = parseFloat(document.getElementById('modal-pay-total').value);
    const method = document.getElementById('modal-pay-select').value;
    
    let rate = 0;
    if(method === 'Débito') rate = getFee('authon_fee_deb');
    if(method === 'Crédito 1x') rate = getFee('authon_fee_c1');
    if(method === 'Crédito 2x') rate = getFee('authon_fee_c2');
    if(method === 'Crédito 3x') rate = getFee('authon_fee_c3');
    if(method === 'Crédito 4x') rate = getFee('authon_fee_c4');
    if(method === 'Crédito 5x') rate = getFee('authon_fee_c5');
    if(method === 'Crédito 6x') rate = getFee('authon_fee_c6');

    const netTotal = total - (total * (rate / 100));

    const btn = event.target;
    btn.innerText = "Salvando...";
    
    await updateInCloud("operacoes", docId, { 
        status: 'pago',
        payment: method,
        netTotal: netTotal,
        feeRate: rate 
    });

    alert(`✅ Recebimento Confirmado!\n\nLíquido: R$ ${netTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    document.getElementById('modal-pay').style.display = 'none';
    btn.innerText = "CONFIRMAR RECEBIMENTO";
    
    if(window.renderHistory) window.renderHistory('all');
    if(window.updateDashboard) window.updateDashboard(true);
}



        // 2. Confirma e Calcula Taxas
        window.confirmPayment = async function() {
            const docId = document.getElementById('modal-pay-docid').value;
            const total = parseFloat(document.getElementById('modal-pay-total').value);
            const method = document.getElementById('modal-pay-select').value;
            
            let rate = 0;
            // Pega a taxa salva na configuração
            if(method === 'Débito') rate = parseFloat(localStorage.getItem('authon_fee_deb')) || 0;
            if(method === 'Crédito 1x') rate = parseFloat(localStorage.getItem('authon_fee_c1')) || 0;
            if(method === 'Crédito 2x') rate = parseFloat(localStorage.getItem('authon_fee_c2')) || 0;
            if(method === 'Crédito 3x') rate = parseFloat(localStorage.getItem('authon_fee_c3')) || 0;
            if(method === 'Crédito 4x') rate = parseFloat(localStorage.getItem('authon_fee_c4')) || 0;
            if(method === 'Crédito 5x') rate = parseFloat(localStorage.getItem('authon_fee_c5')) || 0;
            if(method === 'Crédito 6x') rate = parseFloat(localStorage.getItem('authon_fee_c6')) || 0;

            // Calcula o Líquido
            const discountAmount = total * (rate / 100);
            const netTotal = total - discountAmount;

            // Atualiza na Nuvem
            const btn = event.target;
            btn.innerText = "Processando...";
            
            await updateInCloud("operacoes", docId, { 
                status: 'pago',
                payment: method,
                netTotal: netTotal,
                feeRate: rate // Salva qual taxa foi usada para conferência futura
            });

            alert(`Pagamento Confirmado!\n\nMétodo: ${method}\nTaxa: ${rate}%\nLíquido: R$ ${netTotal.toFixed(2)}`);
            document.getElementById('modal-pay').style.display = 'none';
            btn.innerText = "CONFIRMAR RECEBIMENTO";
        }


        async function deleteItem(docId) { 
    // --- TRAVA DE SEGURANÇA ---
    if(localStorage.getItem('authon_mode_locked') === 'true') {
        return alert("⛔ AÇÃO BLOQUEADA: Funcionários não podem excluir registros.");
    }
    // --------------------------

    // ... o resto do código
            if(docId && docId !== 'undefined') {
                await deleteFromCloud("operacoes", docId);
            } else {
                alert("Erro: Item antigo sem ID da nuvem. Exclua via backup.");
            }
        }

                     function updateDashboard(applyFilter = false) {
            const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
            
            // 1. Filtro de Data
            let start = document.getElementById('filterStart').value; 
            let end = document.getElementById('filterEnd').value;
            let filtered = db; 
            if(applyFilter && start && end) { filtered = db.filter(x => x.date >= start && x.date <= end); }
            
            // 2. Cálculos dos KPIs
            let inc = 0, exp = 0; const payStats = {}; const catExpStats = {};
            
            filtered.forEach(x => { 
                if(x.type === 'venda' && x.status === 'pago') { 
                    const val = x.netTotal !== undefined ? x.netTotal : x.total;
                    inc += val; 
                    let payMethod = x.payment || 'Outros'; payStats[payMethod] = (payStats[payMethod] || 0) + val;
                    // NOVO: Lógica de Ranking de Equipe
                    let seller = x.seller || 'Não Informado';
                    // Se quiser agrupar "Não informado" com "Balcão", pode mudar aqui
                    window.teamStats = window.teamStats || {};
                    window.teamStats[seller] = (window.teamStats[seller] || 0) + val;
                } 
                if(x.type === 'expense') { 
                    exp += x.total; 
                    let cat = x.client || 'Geral'; catExpStats[cat] = (catExpStats[cat] || 0) + x.total; 
                } 
            });
            
            // 3. KPIs principais
            document.getElementById('kpi-inc').innerText = 'R$ ' + inc.toLocaleString('pt-BR',{minimumFractionDigits:2}); 
            document.getElementById('kpi-exp').innerText = 'R$ ' + exp.toLocaleString('pt-BR',{minimumFractionDigits:2}); 
            document.getElementById('kpi-profit').innerText = 'R$ ' + (inc - exp).toLocaleString('pt-BR',{minimumFractionDigits:2});
            const elSub = document.getElementById('fin-profit-sub-label');
            if(elSub) { const l=inc-exp; elSub.innerText = l>0?'▲ Resultado positivo no período':l<0?'▼ Resultado negativo no período':'─ Sem movimentação'; }

            // 4. Barras de Pagamento — Premium
            let payHtml='';
            for(let [key,val] of Object.entries(payStats)) {
                let pct=inc>0?(val/inc)*100:0;
                payHtml+=`<div class="fin-bar-row">
                    <div class="fin-bar-top"><span class="fin-bar-name">${key}</span><span class="fin-bar-val" style="color:#00b894;">R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                    <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#00b894,#00cec9);"></div></div>
                    <div class="fin-bar-pct">${pct.toFixed(0)}% do total</div>
                </div>`;
            }
            document.getElementById('stats-payment').innerHTML = payHtml||'<div style="color:#bdc3c7;text-align:center;padding:15px;font-size:13px;">Sem dados no período</div>';

            // 5. Barras de Despesas — Premium
            let expHtml='';
            Object.entries(catExpStats).sort((a,b)=>b[1]-a[1]).forEach(([key,val])=>{
                let pct=exp>0?(val/exp)*100:0;
                expHtml+=`<div class="fin-bar-row">
                    <div class="fin-bar-top"><span class="fin-bar-name">${key}</span><span class="fin-bar-val" style="color:#e17055;">R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                    <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#e17055,#d63031);"></div></div>
                    <div class="fin-bar-pct">${pct.toFixed(0)}% das saídas</div>
                </div>`;
            });
            document.getElementById('stats-expenses').innerHTML = expHtml||'<div style="color:#bdc3c7;text-align:center;padding:15px;font-size:13px;">Sem despesas no período</div>';

            // 6. Ranking da Equipe — Premium
            let teamHtml='';
            const sortedTeam=Object.entries(window.teamStats||{}).sort((a,b)=>b[1]-a[1]);
            if(sortedTeam.length>0) {
                sortedTeam.forEach(([name,val],i)=>{
                    const medals=['🥇','🥈','🥉'];
                    const pct=inc>0?(val/inc)*100:0;
                    teamHtml+=`<div class="fin-bar-row">
                        <div class="fin-bar-top"><span class="fin-bar-name">${medals[i]||'👤'} ${name}</span><span class="fin-bar-val" style="color:#0984e3;">R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>
                        <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#0984e3,#74b9ff);"></div></div>
                        <div class="fin-bar-pct">${pct.toFixed(0)}% das entradas</div>
                    </div>`;
                });
            } else {
                teamHtml='<div style="color:#bdc3c7;text-align:center;padding:10px;font-size:13px;">Nenhuma venda com vendedor vinculado.</div>';
            }
            const divTeam=document.getElementById('stats-team');
            if(divTeam) divTeam.innerHTML=teamHtml;
            window.teamStats={};

            // 7. KPIs Secundários
            const vendasPagas=filtered.filter(x=>x.type==='venda'&&x.status==='pago');
            const ticket=vendasPagas.length>0?inc/vendasPagas.length:0;
            const elT=document.getElementById('kpi-ticket');
            if(elT) elT.innerText='R$ '+ticket.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

            const dbFull=JSON.parse(localStorage.getItem('oficina_db_master')||'[]');
            const elP=document.getElementById('kpi-pendentes'); if(elP) elP.innerText=dbFull.filter(x=>x.type==='venda'&&x.status==='pendente').length;
            const elO=document.getElementById('kpi-orcamentos'); if(elO) elO.innerText=dbFull.filter(x=>x.type==='orcamento').length;
            const totalOp=filtered.filter(x=>x.type==='orcamento').length+filtered.filter(x=>x.type==='venda').length;
            const elC=document.getElementById('kpi-conversao'); if(elC) elC.innerText=(totalOp>0?Math.round((filtered.filter(x=>x.type==='venda').length/totalOp)*100):0)+'%';
            const hoje2=new Date().toLocaleDateString('en-CA');
            const elH=document.getElementById('kpi-hoje'); if(elH) elH.innerText=dbFull.filter(x=>x.date===hoje2&&x.type!=='expense').length;
            const metaV=parseFloat(localStorage.getItem('authon_meta_mes')||'0');
            const elMP=document.getElementById('kpi-meta-pct'),elMB=document.getElementById('kpi-meta-bar');
            if(elMP&&elMB){
                if(metaV>0){
                    const now2=new Date();
                    const incM=dbFull.filter(x=>{const d=new Date(x.date+'T12:00:00');return x.type==='venda'&&x.status==='pago'&&d.getMonth()===now2.getMonth()&&d.getFullYear()===now2.getFullYear();}).reduce((s,x)=>s+(x.netTotal!==undefined?x.netTotal:x.total),0);
                    const pct=Math.min(Math.round((incM/metaV)*100),100);
                    elMP.innerText=pct+'%'; elMB.style.width=pct+'%';
                    elMB.style.background=pct>=100?'#00b894':pct>=60?'#fdcb6e':'#e74c3c';
                } else { elMP.innerText='Definir'; elMB.style.width='0%'; }
            }

            try { renderSixMonthChart(); renderAnnualBalance(); } catch(e){ console.error(e); }
        }
          

        function generatePDF(data) {
            document.getElementById('pdf-overlay').style.display = 'block';
            // A LINHA QUE FALTAVA PARA A IMPRESSORA FUNCIONAR:
            window.currentReceiptData = data;
            
            // 1. DATA DO DOCUMENTO
            document.getElementById('pdf-date').innerText = new Date().toLocaleDateString();
            
            // 2. DADOS DA EMPRESA (Busca do LocalStorage, não mais do CONFIG_CLIENTE)
            const compName = localStorage.getItem('authon_cfg_name') || "SUA OFICINA";
            const compCnpj = localStorage.getItem('authon_cfg_cnpj') || "CNPJ não informado";
            const compAddr = localStorage.getItem('authon_cfg_addr') || "Endereço não informado";
            const compPhone = localStorage.getItem('authon_cfg_phone') || "";

            document.getElementById('pdf-comp-name').innerText = compName;
            document.getElementById('pdf-comp-cnpj').innerText = compCnpj;
            document.getElementById('pdf-comp-addr').innerText = compAddr + (compPhone ? ' | ' + compPhone : '');
            
            // 3. DADOS DO CLIENTE E VEÍCULO
            let clientText = data.client + (data.phone ? ` - ${data.phone}` : ''); 
            if(data.cpf) clientText += `<br>CPF/CNPJ: ${data.cpf}`; 
            document.getElementById('pdf-client').innerHTML = clientText;
            
            const plateUpper = data.plate ? data.plate.toUpperCase() : ''; 
            document.getElementById('pdf-vehicle').innerText = `${data.vehicle || ''} ${plateUpper} ${data.color || ''}`;
            
            if(data.km) { 
                const interval = parseInt(localStorage.getItem('authon_cfg_km')) || 5000; 
                const nextRev = parseInt(data.km) + interval; 
                document.getElementById('pdf-km-info').innerHTML = `<br><strong>KM Atual:</strong> ${data.km} | <strong>Próxima Revisão:</strong> ${nextRev} km`; 
            } else { 
                document.getElementById('pdf-km-info').innerHTML = ''; 
            }
            // --- IMPRIME A INSPEÇÃO NO PDF ---
            const chk = data.checklist;
            // Só imprime no PDF se houver alguma avaria anotada OU se o combustível for diferente do padrão (Reserva)
            if(chk && (Object.keys(chk.damages).length > 0 || (chk.fuel && chk.fuel !== 'Reserva'))) {
                let dmgText = "Nenhuma avaria na lataria/vidros.";
                const dmgKeys = Object.keys(chk.damages);
                if(dmgKeys.length > 0) {
                    dmgText = dmgKeys.map(k => `<b>${k}:</b> ${chk.damages[k]}`).join(' | ');
                }
                document.getElementById('pdf-km-info').innerHTML += `<div style="margin-top:10px; padding:10px; background:#fff; border:1px solid #ddd; border-radius:5px; font-size:12px; line-height:1.6;"><strong>📝 INSPEÇÃO PRÉVIA:</strong><br>⛽ Combustível: ${chk.fuel || 'Não inf.'}<br>🚗 Avarias: ${dmgText}</div>`;
            }

            // 4. LISTA DE ITENS
            const tbody = document.getElementById('pdf-tbody'); 
            tbody.innerHTML = ''; 
            
            if(data.items && data.items.length > 0) {
                data.items.forEach(i => { 
                    const qtyStr = i.qty > 1 ? `<strong>${i.qty}x</strong> ` : ''; 
                    let cleanDesc = i.desc; 
                    if(cleanDesc.includes(' - ') && cleanDesc.includes('(')) { 
                        try { cleanDesc = cleanDesc.split(' - ')[1].split(' (')[0]; } catch(e) {} 
                    } 
                    tbody.innerHTML += `<tr><td>${qtyStr}${cleanDesc}</td><td>R$ ${parseFloat(i.val).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`; 
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:20px; color:#999;">Nenhum item adicionado</td></tr>`;
            }

            // 5. TOTAIS E PAGAMENTO
            if(data.discount && data.discount > 0) { 
                document.getElementById('pdf-discount-row').style.display = 'block'; 
                document.getElementById('pdf-discount-val').innerText = "R$ " + parseFloat(data.discount).toLocaleString('pt-BR',{minimumFractionDigits:2}); 
            } else { 
                document.getElementById('pdf-discount-row').style.display = 'none'; 
            }

            const savedPix = localStorage.getItem('authon_cfg_pix'); 
            if(savedPix) { 
                document.getElementById('pdf-pix-row').style.display = 'block'; 
                document.getElementById('pdf-pix-key').innerText = savedPix; 
            } else { 
                document.getElementById('pdf-pix-row').style.display = 'none'; 
            }

            const savedWarranty = localStorage.getItem('authon_cfg_warranty'); 
            if(savedWarranty) { 
                document.getElementById('pdf-warranty-text').style.display = 'block'; 
                document.getElementById('pdf-warranty-text').innerText = savedWarranty; 
            } else { 
                document.getElementById('pdf-warranty-text').style.display = 'none'; 
            }

            // Total Final
            document.getElementById('pdf-total').innerText = "R$ " + data.total.toLocaleString('pt-BR',{minimumFractionDigits:2}); 
            document.getElementById('pdf-payment-method').innerText = data.payment || "À Combinar"; 
            
            let pdfTitle = 'RECIBO / PEDIDO';
            if(data.type === 'orcamento') pdfTitle = 'ORÇAMENTO';
            if(data.type === 'agendamento') pdfTitle = 'AGENDAMENTO';
            document.getElementById('pdf-title').innerText = pdfTitle;
               // --- INÍCIO: ASSINATURA DIGITAL NO PDF ---
            let sigContainer = document.getElementById('pdf-signature-container');
            // Se o espaço da assinatura não existir no HTML, o sistema cria um magicamente
            if (!sigContainer) {
                sigContainer = document.createElement('div');
                sigContainer.id = 'pdf-signature-container';
                sigContainer.style.textAlign = 'center';
                sigContainer.style.marginTop = '30px';
                
                // Joga a assinatura lá pro final do recibo
                const warrantyEl = document.getElementById('pdf-warranty-text');
                if(warrantyEl && warrantyEl.parentNode) {
                    warrantyEl.parentNode.appendChild(sigContainer);
                }
            }

            // Se o cliente assinou, desenha a linha e a imagem
            if (data.signature) {
                sigContainer.innerHTML = `
                    <img src="${data.signature}" style="max-width: 250px; max-height: 100px; display: block; margin: 0 auto; mix-blend-mode: multiply;">
                    <div style="border-top: 1px solid #333; width: 80%; margin: 0 auto; padding-top: 5px; font-size: 14px; font-weight: bold; color: #333;">
                        Assinatura do Cliente
                    </div>
                `;
                sigContainer.style.display = 'block';
            } else {
                sigContainer.style.display = 'none'; // Esconde se não tiver assinatura
            }
            // --- FIM: ASSINATURA DIGITAL NO PDF ---


            // Logotipo
            const savedLogo = localStorage.getItem('oficina_logo'); 
            const imgEl = document.getElementById('pdf-logo'); 
            if(savedLogo) { imgEl.src = savedLogo; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }

            // 6. MENSAGEM DO ZAP (Corrigida também)
            let text = `*${compName}* \n--------------------------------\nOlá *${data.client}*, segue o detalhamento do serviço no *${data.vehicle}*:\n\n`;
            if(data.items) {
                data.items.forEach(i => { 
                    const qtyStr = i.qty > 1 ? `${i.qty}x ` : ''; 
                    let cleanDesc = i.desc; if(cleanDesc.includes(' - ') && cleanDesc.includes('(')) { try { cleanDesc = cleanDesc.split(' - ')[1].split(' (')[0]; } catch(e) {} } 
                    text += `✅ ${qtyStr}${cleanDesc} - R$ ${i.val}\n`; 
                });
            }
            if(data.discount > 0) text += `\n🎁 Desconto: - R$ ${data.discount.toLocaleString('pt-BR',{minimumFractionDigits:2})}`; 
            text += `\n--------------------------------\n💰 *TOTAL: R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}*\n\nObrigado pela preferência! 🤝`;
            
            document.getElementById('btn-whatsapp-send').onclick = function() { 
                window.open(`https://wa.me/55${data.phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`); 
            };
        }
window.exportToExcel = function() {
    const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const start = document.getElementById('filterStart').value;
    const end = document.getElementById('filterEnd').value;

    if(!start || !end) return alert("Selecione o período no filtro para exportar.");

    // Filtra os dados 
    const filtered = db.filter(x => {
        const isPeriod = x.date >= start && x.date <= end;
        const isPaidVenda = x.type === 'venda' && x.status === 'pago';
        const isExpense = x.type === 'expense';
        return isPeriod && (isPaidVenda || isExpense);
    }).sort((a, b) => a.date.localeCompare(b.date));

    if(filtered.length === 0) return alert("Sem dados para exportar neste período.");

    // FUNÇÃO MÁGICA: Limpa acentos e caracteres que quebram o Excel
    const limparTexto = (str) => {
        if (!str) return "-";
        return str.toString()
                  .normalize("NFD") // Separa o acento da letra
                  .replace(/[\u0300-\u036f]/g, "") // Remove o acento
                  .replace(/;/g, ','); // Troca ponto-e-vírgula por vírgula normal
    };

    let csvContent = "Data;Tipo;Cliente_Fornecedor;CPF_CNPJ;Placa;Itens_Servicos_Despesas;Metodo_Pagamento;Valor_Bruto;Taxa_Maquininha;Valor_Liquido\n";

    filtered.forEach(item => {
        const isVenda = item.type === 'venda';
        const dataFormatada = item.date.split('-').reverse().join('/');
        const tipo = isVenda ? "ENTRADA" : "SAIDA";
        
        const clienteFornecedor = isVenda ? item.client : (item.client || "Geral"); 
        const cpfCnpj = (isVenda && item.cpf) ? item.cpf : "-";
        const placa = (isVenda && item.plate) ? item.plate.toUpperCase() : "-";
        
        let itensDetalhados = "-";
        if (isVenda && item.items && item.items.length > 0) {
            itensDetalhados = item.items.map(i => `${i.qty}x ${i.desc}`).join(', '); 
        } else if (!isVenda) {
            itensDetalhados = item.vehicle ? item.vehicle : "Despesa nao detalhada"; 
        }

        const metodo = isVenda ? (item.payment || "Nao inf.") : "Saida";
        
        const valorBruto = isVenda ? item.total : item.total;
        const valorLiquido = isVenda ? (item.netTotal || item.total) : item.total;
        const valorTaxa = isVenda ? (valorBruto - valorLiquido) : 0;
        
        const fBruto = valorBruto.toFixed(2).replace('.', ',');
        const fTaxa = valorTaxa.toFixed(2).replace('.', ',');
        const fLiquido = valorLiquido.toFixed(2).replace('.', ',');

        // Aplica a limpeza de texto em todas as colunas de texto
        csvContent += `${dataFormatada};${tipo};${limparTexto(clienteFornecedor)};${limparTexto(cpfCnpj)};${limparTexto(placa)};${limparTexto(itensDetalhados)};${limparTexto(metodo)};${fBruto};${fTaxa};${fLiquido}\n`;
    });

    // Removido o \ufeff (BOM) que estava sujando o cabeçalho no celular
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Contabil_${start}_a_${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}



        // ATENÇÃO: Cole isso com cuidado para não quebrar o código vizinho
window.downloadCurrentPDF = function() {
    // 1. Identificar os elementos
    const element = document.getElementById('invoice-paper');
    const originalParent = element.parentNode;
    const nextSibling = element.nextSibling;
    const originalStyle = element.getAttribute('style');

    // 2. Container Seguro (Fundo Branco)
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-safe';
    printContainer.style.position = 'fixed';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.width = '794px'; // Largura A4
    printContainer.style.height = '100%';
    printContainer.style.backgroundColor = 'white';
    printContainer.style.zIndex = '999999999';
    printContainer.style.overflow = 'hidden';
    
    document.body.appendChild(printContainer);

    // 3. Movemos o recibo para o container
    printContainer.appendChild(element);

    // 4. AJUSTE DE POSIÇÃO (Abaixando mais o conteúdo)
    element.style.width = '100%';
    
    // Centraliza na horizontal
    element.style.marginLeft = '0'; 
    element.style.marginRight = '0';
    
    // --- AQUI ESTÁ O AJUSTE PARA ABAIXAR ---
    // Mudei o primeiro valor de 50px para 80px (Topo)
    element.style.padding = '80px 20px 20px 20px'; 
    // ----------------------------------------

    element.style.boxShadow = 'none';
    element.style.border = 'none';
    element.style.maxWidth = 'none';

    // Função de Restauração (Destrava a tela)
    function restoreScreen() {
        if (printContainer.contains(element)) {
            if (nextSibling) originalParent.insertBefore(element, nextSibling);
            else originalParent.appendChild(element);
        }
        if (originalStyle) element.setAttribute('style', originalStyle);
        else element.removeAttribute('style');

        const container = document.getElementById('print-container-safe');
        if (container) document.body.removeChild(container);
    }

    // 5. Configuração PDF
    const opt = {
        margin: 0,
        filename: 'recibo_authon.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            scrollY: 0, 
            windowWidth: 794,
            width: 794,
            x: 0, 
            y: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Timer de Segurança (Evita travar se der erro)
    const safetyTimer = setTimeout(() => { restoreScreen(); }, 3500);

    // 6. Gerar
    setTimeout(() => {
        html2pdf().set(opt).from(element).save()
        .then(() => {
            clearTimeout(safetyTimer);
            restoreScreen();
        })
        .catch(err => {
            console.error(err);
            clearTimeout(safetyTimer);
            restoreScreen();
        });
    }, 100);
};


        function generatePDFFromHistory(id) { const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]'); const item = db.find(x => x.id == id); if(item) generatePDF(item); }
        function closePDF() { document.getElementById('pdf-overlay').style.display = 'none'; resetForm(); }
        
        // Substitua a função resetForm por esta versão corrigida:
function resetForm() { 
    document.getElementById('editId').value = ''; 
    document.getElementById('firebaseDocId').value = ''; 
    document.getElementById('clientName').value = ''; 
    document.getElementById('clientCpf').value = ''; 
    document.getElementById('vehicle').value = ''; 
    document.getElementById('plate').value = ''; 
    document.getElementById('color').value = ''; 
    document.getElementById('phone').value = ''; 
    document.getElementById('currentKm').value = ''; 
    
    // Limpa a lista de serviços
    document.getElementById('services-list').innerHTML = ''; 
    
    // Zera totais
    document.getElementById('display-total').innerText = '0,00'; 
    document.getElementById('discount').value = ''; 
    
    // Adiciona um item vazio para começar
    addNewItem(); 
}

        
        function openModal() { document.getElementById('modal-config').style.display = 'flex'; }
        function closeModal() { document.getElementById('modal-config').style.display = 'none'; }
        // --- CORREÇÃO: ADICIONADO 'window.' PARA A LOGO ---
window.saveLogo = function(event) { 
    const file = event.target.files[0];
    if(!file) return;

    // Verifica tamanho (Máximo 700KB para não travar o Firebase)
    if(file.size > 700000) {
        alert("A imagem é muito grande! Tente uma menor ou tire um print dela.");
        return;
    }

    const reader = new FileReader(); 
    reader.onload = function(){ 
        const base64 = reader.result;
        localStorage.setItem('oficina_logo', base64); 
        
        // Mostra um aviso rápido
        alert("Logo selecionada! Agora clique em 'SALVAR CONFIGURAÇÕES' para enviar."); 
        
        // Fecha o modal
        closeModal(); 
    }; 
    reader.readAsDataURL(file); 
}

        function backupSystem() { const data = { db: localStorage.getItem('oficina_db_master'), cat: localStorage.getItem('catalog_v1'), logo: localStorage.getItem('oficina_logo'), pix: localStorage.getItem('authon_cfg_pix'), war: localStorage.getItem('authon_cfg_warranty'), km: localStorage.getItem('authon_cfg_km') }; const blob = new Blob([JSON.stringify(data)], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'backup_authon.json'; a.click(); }
        function restoreSystem(event) { const reader = new FileReader(); reader.onload = function(e) { try { const data = JSON.parse(e.target.result); if(data.db) localStorage.setItem('oficina_db_master', data.db); if(data.cat) localStorage.setItem('catalog_v1', data.cat); if(data.logo) localStorage.setItem('oficina_logo', data.logo); if(data.pix) localStorage.setItem('authon_cfg_pix', data.pix); if(data.war) localStorage.setItem('authon_cfg_warranty', data.war); if(data.km) localStorage.setItem('authon_cfg_km', data.km); alert("Sistema restaurado!"); location.reload(); } catch(err) { alert("Erro ao ler arquivo."); } }; reader.readAsText(event.target.files[0]); }
        
        async function saveExpense() { 
            const date = document.getElementById('expDate').value;
            const cat  = document.getElementById('expCat').value;
            const desc = document.getElementById('expDesc').value;
            const val  = parseFloat(document.getElementById('expVal').value);
            const expStatus = window._expStatus || 'pago';
            const venc = expStatus === 'pendente' ? (document.getElementById('expVenc').value || '') : '';
            const obs  = document.getElementById('expObs').value || '';

            if(!desc || !val) return alert("Preencha a descrição e valor.");

            const item = {
                id: Date.now(), type: 'expense', date, client: cat,
                vehicle: desc, total: val,
                status: expStatus,
                vencimento: venc,
                obs: obs,
                items: []
            };
            await saveToCloud("operacoes", item);
            document.getElementById('expDesc').value = '';
            document.getElementById('expVal').value = '';
            document.getElementById('expObs').value = '';
            document.getElementById('expVenc').value = '';
            setExpStatus('pago');
            toggleExpForm(true);
            alert("Despesa salva!");
        }
        
        // ── DESPESAS: Render com filtro de período, status e visual premium ──
window.renderExpensesList = function() {
    const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list = document.getElementById('expense-list-mini');
    if(!list) return;

    const term     = (document.getElementById('expenseSearch')?.value || '').toLowerCase();
    const eStart   = document.getElementById('expFilterStart')?.value || '';
    const eEnd     = document.getElementById('expFilterEnd')?.value   || '';
    const statusF  = window._expFilterStatus || 'all';
    const hoje     = new Date().toLocaleDateString('en-CA');

    let filtered = db.filter(x => x.type === 'expense');

    // Filtro de período
    if(eStart) filtered = filtered.filter(x => x.date >= eStart);
    if(eEnd)   filtered = filtered.filter(x => x.date <= eEnd);

    // Filtro de status
    if(statusF === 'pago')     filtered = filtered.filter(x => x.status === 'pago' || !x.status);
    if(statusF === 'pendente') filtered = filtered.filter(x => x.status === 'pendente' && (!x.vencimento || x.vencimento >= hoje));
    if(statusF === 'vencida')  filtered = filtered.filter(x => x.status === 'pendente' && x.vencimento && x.vencimento < hoje);

    // Filtro de busca
    if(term) filtered = filtered.filter(x => (x.vehicle+' '+(x.client||'')+' '+x.date).toLowerCase().includes(term));

    filtered.sort((a,b) => b.id - a.id);

    // Total do período
    const total = filtered.reduce((s,x) => s + x.total, 0);

    if(filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#bdc3c7;">
            <i class="fas fa-folder-open" style="font-size:40px; margin-bottom:12px; display:block;"></i>
            <div style="font-size:14px; font-weight:600;">Nenhuma despesa encontrada</div>
            <div style="font-size:12px; margin-top:5px;">Tente mudar o período ou filtro</div>
        </div>`;
        return;
    }

    let html = `<div style="margin:12px 15px; background:white; border-radius:14px; padding:14px 16px; box-shadow:0 4px 16px rgba(0,0,0,0.06); display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#95a5a6;">${filtered.length} despesa${filtered.length>1?'s':''} no período</div>
        <div style="font-size:16px; font-weight:800; color:#e17055;">- R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
    </div>`;

    filtered.forEach(x => {
        const isPago    = !x.status || x.status === 'pago';
        const isVencida = x.status === 'pendente' && x.vencimento && x.vencimento < hoje;
        const isPendente= x.status === 'pendente' && !isVencida;

        let badgeHtml = '';
        let borderColor = '#e17055';
        if(isPago)     { badgeHtml = `<span style="background:#e8faf4; color:#00b894; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">✓ Pago</span>`; borderColor='#00b894'; }
        if(isPendente) { badgeHtml = `<span style="background:#fff8e8; color:#f39c12; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">⏳ Pendente</span>`; borderColor='#f39c12'; }
        if(isVencida)  { badgeHtml = `<span style="background:#fff0f0; color:#e74c3c; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">⚠ Vencida</span>`; borderColor='#e74c3c'; }

        const vencInfo = x.vencimento ? `<div style="font-size:11px; color:${isVencida?'#e74c3c':'#95a5a6'}; margin-top:2px;"><i class="fas fa-calendar-xmark" style="margin-right:4px;"></i>Vence: ${x.vencimento.split('-').reverse().join('/')}</div>` : '';
        const obsInfo  = x.obs ? `<div style="font-size:11px; color:#95a5a6; margin-top:2px; font-style:italic;"><i class="fas fa-comment-dots" style="margin-right:4px;"></i>${x.obs}</div>` : '';

        html += `
        <div style="margin:0 15px 10px; background:white; border-radius:14px; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border-left:4px solid ${borderColor}; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                    <div style="font-size:15px; font-weight:700; color:#2d3436;">${x.vehicle}</div>
                    <div style="font-size:11px; color:#95a5a6; margin-top:2px;">
                        <i class="fas fa-tag" style="margin-right:4px;"></i>${x.client || 'Geral'}
                        &nbsp;·&nbsp;
                        <i class="fas fa-calendar" style="margin-right:4px;"></i>${x.date.split('-').reverse().join('/')}
                    </div>
                    ${vencInfo}
                    ${obsInfo}
                </div>
                <div style="text-align:right; flex-shrink:0; margin-left:10px;">
                    <div style="font-size:17px; font-weight:800; color:#e17055;">- R$ ${x.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                    <div style="margin-top:5px;">${badgeHtml}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; border-top:1px solid #f5f6fa; padding-top:10px;">
                ${!isPago ? `<button onclick="markExpensePaid('${x.docId}')" style="flex:1; padding:8px; background:#e8faf4; color:#00b894; border:none; border-radius:8px; font-size:11px; font-weight:700; font-family:'Poppins',sans-serif; cursor:pointer;"><i class="fas fa-check"></i> Marcar como Pago</button>` : ''}
                <button onclick="deleteItem('${x.docId}')" style="padding:8px 14px; background:#fff0f0; color:#e74c3c; border:none; border-radius:8px; font-size:11px; font-weight:700; font-family:'Poppins',sans-serif; cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    });

    list.innerHTML = html;
}

               // --- FUNÇÕES QUE ESTAVAM FALTANDO NESTA PARTE DO CÓDIGO ---

    function renderSixMonthChart() {
        const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        const ctx = document.getElementById('financeChart');
        if(!ctx) return;
        
        const labels = []; const dataInc = []; const dataExp = [];
        const today = new Date();
        
        for(let i=5; i>=0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthName = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
            const year = d.getFullYear(); const month = d.getMonth();
            
            labels.push(`${monthName}/${year.toString().substr(2)}`);
            
            let mInc = 0; let mExp = 0;
            db.forEach(x => {
                const xDate = new Date(x.date + 'T12:00:00');
                if(xDate.getMonth() === month && xDate.getFullYear() === year) {
                    if(x.type === 'venda' && x.status === 'pago') { mInc += (x.netTotal !== undefined ? x.netTotal : x.total); }
                    if(x.type === 'expense') { mExp += x.total; }
                }
            });
            dataInc.push(mInc); dataExp.push(mExp);
        }
        
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Entradas', data: dataInc, backgroundColor: '#27ae60', borderRadius:4 },
                    { label: 'Saídas', data: dataExp, backgroundColor: '#c0392b', borderRadius:4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } },
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function renderAnnualBalance() {
        const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        const list = document.getElementById('annual-list');
        const yearSpan = document.getElementById('annual-year');
        const currentYear = new Date().getFullYear();
        
        if(yearSpan) yearSpan.innerText = currentYear;
        if(!list) return;
        
        list.innerHTML = '';
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        let totalYInc = 0; let totalYExp = 0;

        months.forEach((name, idx) => {
            let mInc = 0; let mExp = 0;
            db.forEach(x => {
                const xDate = new Date(x.date + 'T12:00:00');
                if(xDate.getMonth() === idx && xDate.getFullYear() === currentYear) {
                    if(x.type === 'venda' && x.status === 'pago') { mInc += (x.netTotal !== undefined ? x.netTotal : x.total); }
                    if(x.type === 'expense') mExp += x.total;
                }
            });

            const profit = mInc - mExp;
            const color = profit >= 0 ? '#27ae60' : '#c0392b';
            
            list.innerHTML += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; color:#2c3e50; font-weight:600;">${name.substring(0,3)}</td>
                    <td style="padding:10px; text-align:right; color:#27ae60; font-size:11px;">${mInc > 0 ? 'R$ '+mInc.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '-'}</td>
                    <td style="padding:10px; text-align:right; color:#c0392b; font-size:11px;">${mExp > 0 ? 'R$ '+mExp.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '-'}</td>
                    <td style="padding:10px; text-align:right; font-weight:bold; color:${color}; font-size:11px;">R$ ${profit.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                </tr>`;
            
            totalYInc += mInc; totalYExp += mExp;
        });
    }

    // ── HISTÓRICO: controle de período e status ──

    // Botões de período rápido do Histórico
    window.histPeriod = function(btn, range) {
        document.querySelectorAll('.hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const today = new Date();
        const s = document.getElementById('histFilterStart');
        const e = document.getElementById('histFilterEnd');
        if(range === 'today') {
            const str = today.toLocaleDateString('en-CA');
            s.value = str; e.value = str;
        } else if(range === 'month') {
            s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            e.value = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
        } else {
            s.value = ''; e.value = '';
        }
        renderHistory(window.currentHistoryFilter || 'all');
    };

    // Botões de status do Histórico
    window.histStatus = function(btn, filter) {
        document.querySelectorAll('.hist-status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHistory(filter);
    };

    // Inicializa o período padrão do Histórico (mês atual)
    (function initHistoryPeriod() {
        const today = new Date();
        const s = document.getElementById('histFilterStart');
        const e = document.getElementById('histFilterEnd');
        if(s && e && !s.value) {
            s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            e.value = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
        }
    })();

    // ── DESPESAS: funções auxiliares ──

    window._expStatus       = 'pago';
    window._expFilterStatus = 'all';

    window.toggleExpForm = function(forceClose) {
        const wrapper = document.getElementById('exp-form-wrapper');
        const icon    = document.getElementById('exp-new-icon');
        const isOpen  = wrapper.style.display !== 'none';
        if(forceClose || isOpen) {
            wrapper.style.display = 'none';
            icon.className = 'fas fa-plus';
        } else {
            wrapper.style.display = 'block';
            icon.className = 'fas fa-times';
        }
    };

    window.setExpStatus = function(status) {
        window._expStatus = status;
        document.getElementById('expTogglePago').classList.toggle('active',    status === 'pago');
        document.getElementById('expTogglePendente').classList.toggle('active', status === 'pendente');
        document.getElementById('expVencWrapper').style.display = status === 'pendente' ? 'block' : 'none';
    };

    window.expPeriod = function(btn, range) {
        document.querySelectorAll('.exp-header .hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const today = new Date();
        const s = document.getElementById('expFilterStart');
        const e = document.getElementById('expFilterEnd');
        if(range === 'today')      { const str = today.toLocaleDateString('en-CA'); s.value = str; e.value = str; }
        else if(range === 'month') { s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; e.value = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0]; }
        else                       { s.value = ''; e.value = ''; }
        renderExpensesList();
    };

    window.expStatus = function(btn, status) {
        document.querySelectorAll('#tab-expenses .hist-status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window._expFilterStatus = status;
        renderExpensesList();
    };

    window.markExpensePaid = async function(docId) {
        if(!docId) return;
        try {
            await window.updateDoc(window.doc(window.db, "operacoes", docId), { status: 'pago', vencimento: '' });
            alert("Despesa marcada como paga!");
        } catch(e) { console.error(e); }
    };

    // ── FINANCEIRO: período rápido ──
    window.finPeriod = function(btn, range) {
        document.querySelectorAll('.fin-period-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        setDateRange(range);
    };

    // ── META MENSAL ──
    window.openMetaModal = function() {
        const i=document.getElementById('meta-input'); if(i) i.value=localStorage.getItem('authon_meta_mes')||'';
        document.getElementById('modal-meta').style.display='flex';
    };
    window.saveMeta = function() {
        const val=parseFloat(document.getElementById('meta-input').value);
        if(!val||val<=0) return alert("Informe um valor válido para a meta.");
        localStorage.setItem('authon_meta_mes',val);
        document.getElementById('modal-meta').style.display='none';
        updateDashboard(true);
    };

    // ── HISTÓRICO: período e status ──
    window.histPeriod = function(btn, range) {
        document.querySelectorAll('.hist-period-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const today=new Date(), s=document.getElementById('histFilterStart'), e=document.getElementById('histFilterEnd');
        if(range==='today'){ const str=today.toLocaleDateString('en-CA'); s.value=str; e.value=str; }
        else if(range==='month'){ s.value=new Date(today.getFullYear(),today.getMonth(),1).toISOString().split('T')[0]; e.value=new Date(today.getFullYear(),today.getMonth()+1,0).toISOString().split('T')[0]; }
        else { s.value=''; e.value=''; }
        renderHistory(window.currentHistoryFilter||'all');
    };
    window.histStatus = function(btn, filter) {
        document.querySelectorAll('.hist-status-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        renderHistory(filter);
    };

    // --- CONEXÕES FINAIS ---
    window.renderExpensesList = renderExpensesList;
    window.renderSixMonthChart = renderSixMonthChart;
    window.renderAnnualBalance = renderAnnualBalance;
    window.updateDashboard = updateDashboard;


    
