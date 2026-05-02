// ============================================================
// fixes.js v4 — Limpo e definitivo
// ============================================================

// ── 1. OVERRIDE alert/confirm (sem pop-ups nativos) ──
window.alert = function (msg) {
    if (!msg) return;
    const m = String(msg);
    if (m.includes('✅') || m.includes('salvo') || m.includes('Salvo') ||
        m.includes('atualizado') || m.includes('enviado') || m.includes('confirmado') ||
        m.includes('restaurado') || m.includes('renovado') || m.includes('liberado')) {
        Toast.success(m, 4000);
    } else if (m.includes('❌') || m.includes('Erro') || m.includes('erro') ||
               m.includes('ESGOTADO') || m.includes('⛔') || m.includes('suspenso')) {
        Toast.error(m, 5000);
    } else if (m.includes('⚠️') || m.includes('ATENÇÃO') || m.includes('preencha') ||
               m.includes('Preencha') || m.includes('Adicione') || m.includes('precisa')) {
        Toast.warning(m, 4500);
    } else {
        Toast.info(m, 4000);
    }
};
window.confirm = function (msg) {
    Toast.info(msg ? String(msg).substring(0, 80) : 'Confirmar?', 3000);
    return true;
};

// ── 2. CSS global de correções ──
(function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes tabFadeIn { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }

        /* Nav compacto — 8 itens cabem */
        .bottom-nav { overflow-x:auto; justify-content:flex-start !important; }
        .nav-item { padding:6px 8px !important; min-width:50px; font-size:8px !important; }
        .nav-item i { font-size:17px !important; }

        /* Brand header centralizado */
        .brand-header {
            background:linear-gradient(135deg,#1e272e,#2d3436) !important;
            padding:10px 16px !important;
            display:flex !important; align-items:center !important;
            justify-content:center !important; gap:10px !important;
            box-shadow:0 2px 12px rgba(0,0,0,0.25) !important;
            position:sticky !important; top:0 !important; z-index:800 !important;
        }
        .brand-logo {
            font-family:'Oswald',sans-serif !important; font-size:16px !important;
            font-weight:700 !important; letter-spacing:2px !important;
            color:white !important; text-transform:uppercase !important;
        }

        /* Botões período — só .active colorido */
        .hist-period-btn { background:transparent !important; color:rgba(255,255,255,0.5) !important; border:1px solid rgba(255,255,255,0.15) !important; }
        .hist-period-btn.active { background:#e74c3c !important; border-color:#e74c3c !important; color:white !important; }

        /* Botão Nova Despesa */
        .exp-new-btn { display:inline-flex !important; align-items:center !important; gap:6px !important;
            background:linear-gradient(135deg,#e74c3c,#c0392b) !important; color:white !important;
            border:none !important; border-radius:20px !important; padding:8px 16px !important;
            font-family:'Poppins',sans-serif !important; font-size:13px !important; font-weight:700 !important;
            cursor:pointer !important; white-space:nowrap !important; width:auto !important; }

        /* Header despesas */
        .exp-header-label { display:none !important; }
        .exp-header-title { font-family:'Oswald',sans-serif !important; font-size:22px !important; color:white !important; }
        .exp-header-top { display:flex !important; justify-content:space-between !important; align-items:center !important; margin-bottom:14px !important; }

        /* Busca histórico legível */
        .hist-search-input { color:#1e272e !important; background:rgba(255,255,255,0.95) !important; }
        .hist-search-input::placeholder { color:rgba(30,39,46,0.45) !important; }

        /* PDF overlay — SEMPRE oculto por padrão */
        #pdf-overlay { display:none !important; position:fixed !important; top:0 !important; left:0 !important;
            width:100% !important; height:100% !important; z-index:99998 !important;
            background:#f5f6fa !important; overflow-y:auto !important; }
        #pdf-overlay[data-open="true"] { display:block !important; }

        /* Modal alterar logo — oculto por padrão */
        #modal-config { display:none !important; position:fixed !important; inset:0 !important;
            z-index:99999 !important; background:rgba(0,0,0,0.6) !important;
            align-items:center !important; justify-content:center !important; }
        #modal-config[data-open="true"] { display:flex !important; }

        /* Separador de data no histórico */
        .hist-date-separator {
            font-family:'Poppins',sans-serif; font-size:10px; font-weight:800;
            text-transform:uppercase; letter-spacing:1.5px; color:#95a5a6;
            padding:16px 4px 6px; display:block;
        }
    `;
    document.head.appendChild(s);
})();

// ── 3. DOM Ready ──
document.addEventListener('DOMContentLoaded', function () {

    // Brand header
    const bh = document.querySelector('.brand-header');
    if (bh) bh.innerHTML = `
        <div style="width:28px;height:28px;background:linear-gradient(135deg,#e74c3c,#c0392b);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(231,76,60,0.4);">
            <i class="fas fa-bolt" style="color:white;font-size:14px;"></i>
        </div>
        <span class="brand-logo">SISTEMA AUTHON</span>`;

    // WhatsApp suporte
    setTimeout(() => {
        const fab = document.getElementById('support-fab');
        if (fab) fab.onclick = () => window.open('https://wa.me/5587996523840?text=' + encodeURIComponent('Olá! Preciso de ajuda com o Sistema Authon.'), '_blank');
    }, 1500);

    // PDF — usa data-attribute em vez de style para evitar conflito com CSS
    window.closePDF = function () {
        const o = document.getElementById('pdf-overlay');
        if (o) { o.removeAttribute('data-open'); o.scrollTop = 0; }
        window.resetForm?.();
    };
    window.openModal  = function () { const m = document.getElementById('modal-config'); if (m) m.setAttribute('data-open','true'); };
    window.closeModal = function () { const m = document.getElementById('modal-config'); if (m) m.removeAttribute('data-open'); };

    // toggleExpForm
    window.toggleExpForm = function (forceClose) {
        const w = document.getElementById('exp-form-wrapper'), icon = document.getElementById('exp-new-icon');
        const list = document.getElementById('expense-list-mini');
        const fr   = document.querySelector('#tab-expenses .hist-status-row');
        if (!w) return;
        const open = w.style.display === 'block';
        if (forceClose || open) {
            w.style.display = 'none'; if (icon) icon.className = 'fas fa-plus';
            if (list) list.style.display = 'block'; if (fr) fr.style.display = 'flex';
        } else {
            w.style.display = 'block'; if (icon) icon.className = 'fas fa-times';
            if (list) list.style.display = 'none'; if (fr) fr.style.display = 'none';
            setTimeout(() => w.scrollIntoView({behavior:'smooth',block:'start'}), 100);
        }
    };

    // showTab
    window.showTab = function (tab, el) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const target = document.getElementById('tab-' + tab);
        if (target) { target.classList.add('active'); target.style.animation = 'tabFadeIn 0.25s ease'; }
        if (el) el.classList.add('active');
        else { const q = document.querySelector(".nav-item[onclick*=\"'" + tab + "'\"]"); if (q) q.classList.add('active'); }
        if (tab === 'dashboard') { window.updateDashboard?.(true); window.renderSixMonthChart?.(); window.renderAnnualBalance?.(); }
        if (tab === 'history')   window.renderHistory?.(window.currentHistoryFilter || 'all');
        if (tab === 'expenses')  window.renderExpensesList?.();
        if (tab === 'catalog')   window.renderCatalogList?.();
        if (tab === 'agenda')    window.renderAgenda?.();
        if (tab === 'crm')       window.renderCRM?.();
    };
    window.clickNewTab = function (el) { window.resetForm?.(); window.setOpType?.('venda'); window.showTab('new', el); };

    // expPeriod — só 1 botão ativo por vez
    window.expPeriod = function (btn, range) {
        document.querySelectorAll('#tab-expenses .hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const t = new Date(), s = document.getElementById('expFilterStart'), e = document.getElementById('expFilterEnd');
        if (!s || !e) return;
        if (range === 'today') { const d = t.toLocaleDateString('en-CA'); s.value = d; e.value = d; }
        else if (range === 'month') { s.value = new Date(t.getFullYear(),t.getMonth(),1).toISOString().split('T')[0]; e.value = new Date(t.getFullYear(),t.getMonth()+1,0).toISOString().split('T')[0]; }
        else { s.value = ''; e.value = ''; }
        window.renderExpensesList?.();
    };
    window.histPeriod = function (btn, range) {
        document.querySelectorAll('#tab-history .hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const t = new Date(), s = document.getElementById('histFilterStart'), e = document.getElementById('histFilterEnd');
        if (!s || !e) return;
        if (range === 'today') { const d = t.toLocaleDateString('en-CA'); s.value = d; e.value = d; }
        else if (range === 'month') { s.value = new Date(t.getFullYear(),t.getMonth(),1).toISOString().split('T')[0]; e.value = new Date(t.getFullYear(),t.getMonth()+1,0).toISOString().split('T')[0]; }
        else { s.value = ''; e.value = ''; }
        window.renderHistory?.(window.currentHistoryFilter || 'all');
    };
    window.histStatus = function (btn, filter) {
        document.querySelectorAll('.hist-status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        window.renderHistory?.(filter);
    };

    // Confirms/deletes críticos
    window.logout = function () { Confirm('Deseja sair?', () => window.auth.signOut().then(() => location.reload())); };
    window.deleteItem = async function (docId) {
        if (localStorage.getItem('authon_mode_locked') === 'true') { Toast.error('Funcionários não podem excluir.'); return; }
        if (!docId || docId === 'undefined') { Toast.error('Item sem ID.'); return; }
        Confirm('Excluir este registro permanentemente?', async () => {
            try { await window.deleteDoc(window.doc(window.db,'operacoes',docId)); Toast.success('Excluído!'); }
            catch(e) { Toast.error('Erro ao excluir.'); }
        });
    };
    window.delCatalog = async function (idx) {
        const cat = JSON.parse(localStorage.getItem('catalog_v1')||'[]');
        const item = cat[idx]; if (!item?.docId) return;
        Confirm('Excluir "' + item.name + '" do catálogo?', async () => {
            try { await window.deleteDoc(window.doc(window.db,'catalogo',item.docId)); Toast.success('Excluído!'); }
            catch(e) { Toast.error('Erro.'); }
        });
    };
    window.fillClientData = function (input) {
        const db = JSON.parse(localStorage.getItem('oficina_db_master')||'[]');
        const last = db.find(i => i.client === input.value);
        if (last) Confirm('Cliente encontrado! Preencher dados do ' + last.vehicle + '?', () => {
            ['phone','vehicle','plate','color'].forEach(f => { const el = document.getElementById(f); if (el && last[f]) el.value = last[f]; });
            if (last.cpf) { const el = document.getElementById('clientCpf'); if (el) el.value = last.cpf; }
            Toast.success('Dados preenchidos!');
        });
    };
    window.toggleEmployeeMode = function (activate) {
        if (activate) {
            Confirm('Ativar modo funcionário?', () => {
                localStorage.setItem('authon_mode_locked','true');
                document.body.classList.add('employee-mode');
                const btn = document.getElementById('unlock-btn'); if (btn) btn.style.display = 'flex';
                Toast.info('Modo funcionário ativado.');
            });
        } else {
            const pin = localStorage.getItem('authon_cfg_pin');
            if (!pin) {
                localStorage.setItem('authon_mode_locked','false');
                document.body.classList.remove('employee-mode');
                const btn = document.getElementById('unlock-btn'); if (btn) btn.style.display = 'none';
                Toast.success('Desbloqueado!'); return;
            }
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = '<div style="background:white;border-radius:20px;padding:28px 24px;max-width:300px;width:100%;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">🔐</div><h3 style="font-family:Oswald,sans-serif;color:#1e272e;font-size:18px;margin-bottom:16px;">PIN do Proprietário</h3><input id="pin-input" type="password" inputmode="numeric" maxlength="6" style="width:100%;padding:12px;border:2px solid #e74c3c;border-radius:12px;font-size:20px;text-align:center;letter-spacing:8px;box-sizing:border-box;" placeholder="••••"><div style="display:flex;gap:10px;margin-top:16px;"><button id="pin-cancel" style="flex:1;padding:12px;border-radius:12px;border:2px solid #ecf0f1;background:#f8f9fa;color:#7f8c8d;font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button><button id="pin-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#e74c3c;color:white;font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">OK</button></div></div>';
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('pin-input')?.focus(), 100);
            document.getElementById('pin-ok').onclick = () => {
                if (document.getElementById('pin-input').value === pin) {
                    localStorage.setItem('authon_mode_locked','false');
                    document.body.classList.remove('employee-mode');
                    const btn = document.getElementById('unlock-btn'); if (btn) btn.style.display = 'none';
                    modal.remove(); Toast.success('Desbloqueado!');
                } else { Toast.error('PIN incorreto.'); document.getElementById('pin-input').value = ''; }
            };
            document.getElementById('pin-cancel').onclick = () => modal.remove();
        }
    };

    // ── RENDER HISTORY DEFINITIVO ──
    window.renderHistory = function (filter) {
        window.currentHistoryFilter = filter;
        const dbData = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        const list   = document.getElementById('history-list');
        if (!list) return;

        const term   = (document.getElementById('historySearch')?.value || '').toLowerCase();
        const hStart = document.getElementById('histFilterStart')?.value || '';
        const hEnd   = document.getElementById('histFilterEnd')?.value   || '';
        const compName = localStorage.getItem('authon_cfg_name') || 'SUA OFICINA';
        const savedPix = localStorage.getItem('authon_cfg_pix') || '';

        list.innerHTML = '';

        let filtered = dbData.filter(x => x.type !== 'agendamento' && x.type !== 'expense');
        if (filter === 'venda')     filtered = filtered.filter(x => x.type === 'venda');
        if (filter === 'orcamento') filtered = filtered.filter(x => x.type === 'orcamento');
        if (filter === 'pendente')  filtered = filtered.filter(x => x.status === 'pendente');
        if (filter === 'pago')      filtered = filtered.filter(x => x.status === 'pago');
        if (hStart) filtered = filtered.filter(x => x.date >= hStart);
        if (hEnd)   filtered = filtered.filter(x => x.date <= hEnd);
        filtered.sort((a, b) => b.id - a.id);

        if (!filtered.length) {
            list.innerHTML = '<div style="text-align:center;padding:50px 20px;color:#bdc3c7;"><i class="fas fa-folder-open" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;font-weight:600;">Nenhum registro encontrado</div><div style="font-size:12px;margin-top:5px;">Tente mudar o período ou filtro</div></div>';
            return;
        }

        // Agrupa por data
        const grouped = {};
        filtered.forEach(item => {
            const ft = ((item.client||'') + ' ' + (item.vehicle||'') + ' ' + (item.plate||'') + ' ' + item.total).toLowerCase();
            if (term && !ft.includes(term)) return;
            if (!grouped[item.date]) grouped[item.date] = [];
            grouped[item.date].push(item);
        });

        if (!Object.keys(grouped).length) {
            list.innerHTML = '<div style="text-align:center;padding:50px 20px;color:#bdc3c7;"><i class="fas fa-search" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;font-weight:600;">Nenhum resultado</div></div>';
            return;
        }

        const today = new Date().toLocaleDateString('en-CA');
        const yest  = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

        Object.keys(grouped).sort().reverse().forEach(date => {
            let lbl = date.split('-').reverse().join('/');
            if (date === today) lbl = '📅 Hoje — ' + lbl;
            if (date === yest)  lbl = '📆 Ontem — ' + lbl;
            list.innerHTML += '<div class="hist-date-separator">' + lbl + '</div>';

            grouped[date].forEach(item => {
                const esc = s => (s||'').replace(/'/g, "\\'");
                const bc  = item.status === 'pago' ? '#00b894' : item.type === 'orcamento' ? '#95a5a6' : '#f39c12';
                const sc  = item.status === 'pago' ? 'bg-venda' : item.type === 'orcamento' ? 'bg-orcamento' : 'bg-pendente';
                const st  = item.status === 'pago' ? 'PAGO' : item.type === 'orcamento' ? 'ORÇAMENTO' : 'PENDENTE';
                // Mostra valor bruto + taxa abaixo (se houver)
                const bruto = item.total;
                const liquido = (item.netTotal && item.netTotal < item.total) ? item.netTotal : item.total;
                const taxa = bruto - liquido;
                const plate = item.plate ? ' <span style="background:#f0f3f9;color:#636e72;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">' + item.plate.toUpperCase() + '</span>' : '';

                let items = '<ul style="margin:8px 0 10px 18px;padding:0;font-size:12px;color:#636e72;line-height:1.7;">';
                (item.items||[]).forEach(i => { let d=i.desc||''; if(d.includes(' - ')&&d.includes('(')){try{d=d.split(' - ')[1].split(' (')[0];}catch(e){}} items+='<li>'+(i.qty>1?i.qty+'x ':'')+d+'</li>'; });
                items += '</ul>';

                let payBtn = '';
                let actBtn = '<button class="btn-card" style="background:#f0f3f9;color:#636e72;flex:1;" onclick="openBeforeAfterModal(\''+esc(item.client)+'\',\''+esc(item.vehicle)+'\',\''+(item.phone||'')+'\',\''+esc(item.plate)+'\')"><i class="fas fa-camera-retro"></i> Antes & Depois</button>';

                if (item.type === 'venda' && item.status === 'pendente') {
                    const px  = savedPix ? '\n\n🔑 Pix: ' + savedPix : '';
                    const zm  = '*'+compName+'*\n--------------------------------\nOlá *'+item.client+'*, o serviço no seu *'+(item.vehicle||'veículo')+'* foi finalizado! ✨\n\n💰 *Total:* R$ '+item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})+px+'\n\nAguardamos! 🤝';
                    const zl  = 'https://wa.me/55'+(item.phone||'').replace(/\D/g,'')+'?text='+encodeURIComponent(zm);
                    actBtn += '<button class="btn-card" style="background:#e8fdf4;color:#00b894;flex:1;" onclick="window.open(\''+zl+'\')"><i class="fab fa-whatsapp"></i> AVISAR</button>';
                    payBtn  = '<button class="btn-action" style="background:var(--green-grad);width:100%;margin:12px 0 6px;font-size:13px;padding:14px;border-radius:14px;animation:softPulse 2.5s infinite;box-shadow:0 6px 20px rgba(0,184,148,0.4);" onclick="window.openPayModal(\''+item.docId+'\','+item.total+')"><i class="fas fa-hand-holding-usd" style="margin-right:8px;"></i> RECEBER PAGAMENTO</button>';
                }

                list.innerHTML += '<div class="item-card" style="border-left:4px solid '+bc+';">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                        '<div><div style="font-size:17px;font-weight:800;color:#1e272e;">'+(item.client||'')+'</div>' +
                        '<div style="font-size:12px;color:#95a5a6;margin-top:3px;">'+(item.vehicle||'')+plate+' · '+(item.phone||'')+'</div></div>' +
                        '<span class="status-badge '+sc+'">'+st+'</span>' +
                    '</div>' + items +
                    '<div style="border-top:1px solid #f5f6fa;padding-top:10px;margin-bottom:6px;">' +
                        '<div style="font-family:Oswald,sans-serif;font-size:26px;font-weight:700;color:#1e272e;">R$ '+bruto.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</div>' +
                    (taxa > 0 ? '<div style="font-size:11px;color:#e74c3c;font-weight:700;margin-top:2px;"><i class=\"fas fa-percent\" style=\"margin-right:4px;font-size:9px;\"></i>Taxa: - R$ '+taxa.toLocaleString('pt-BR',{minimumFractionDigits:2})+' | Líq: R$ '+liquido.toLocaleString('pt-BR',{minimumFractionDigits:2})+'</div>' : '') +
                    '</div>' + payBtn +
                    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
                        '<div style="display:flex;gap:6px;flex:1;">'+actBtn+'</div>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<button class="btn-card" style="background:#f0f3f9;color:#2d3436;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="generatePDFFromHistory('+item.id+')"><i class="fas fa-file-pdf"></i></button>' +
                            '<button class="btn-card" style="background:#e8f4fd;color:#0984e3;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="loadToEdit('+item.id+')"><i class="fas fa-pen"></i></button>' +
                            '<button class="btn-card" style="background:#fef0ee;color:#e74c3c;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="deleteItem(\''+item.docId+'\')"><i class="fas fa-trash"></i></button>' +
                        '</div>' +
                    '</div></div>';
            });
        });
    };

    // generatePDF — usa data-attribute
    const _gp = window.generatePDF;
    window.generatePDF = function (data) {
        const o = document.getElementById('pdf-overlay');
        if (o) { o.setAttribute('data-open','true'); o.scrollTop = 0; }
        if (_gp) _gp(data);
    };

    // ── CORRIGE toggleCatType (bug: classe não resetava corretamente) ──
    window.toggleCatType = function (type) {
        const catTypeEl = document.getElementById('catType');
        if (catTypeEl) catTypeEl.value = type;

        const divStock = document.getElementById('div-stock-input');
        if (divStock) divStock.style.display = (type === 'produto') ? 'block' : 'none';

        const btnProd = document.getElementById('btn-type-prod');
        const btnServ = document.getElementById('btn-type-serv');
        if (btnProd) btnProd.className = 'op-btn' + (type === 'produto' ? ' active' : '');
        if (btnServ) btnServ.className = 'op-btn' + (type === 'servico' ? ' active' : '');
    };

    console.log('✅ fixes.js v4');
});
