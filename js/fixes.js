// ============================================================
// fixes.js v3 — Todas as correções
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ══════════════════════════════════════════════════════
    // OVERRIDE GLOBAL: Substitui alert() e confirm() nativos
    // pelo sistema visual Toast/Confirm do Authon
    // Resolve os "pop-ups bloqueados" do Chrome mobile
    // ══════════════════════════════════════════════════════
    window.alert = function (msg) {
        if (!msg) return;
        const m = String(msg);
        // Detecta tipo pelo conteúdo
        if (m.includes('✅') || m.includes('salvo') || m.includes('Salvo') ||
            m.includes('atualizado') || m.includes('enviado') || m.includes('confirmado') ||
            m.includes('restaurado') || m.includes('renovado') || m.includes('Pago') ||
            m.includes('liberado') || m.includes('bloqueado') || m.includes('ativado')) {
            Toast.success(m, 4000);
        } else if (m.includes('❌') || m.includes('Erro') || m.includes('erro') ||
                   m.includes('ESGOTADO') || m.includes('suspenso') || m.includes('⛔') ||
                   m.includes('restrito') || m.includes('bloqueado')) {
            Toast.error(m, 5000);
        } else if (m.includes('⚠️') || m.includes('ATENÇÃO') || m.includes('estoque') ||
                   m.includes('Preencha') || m.includes('preencha') || m.includes('Digite') ||
                   m.includes('Adicione') || m.includes('precisa') || m.includes('ainda')) {
            Toast.warning(m, 4500);
        } else {
            Toast.info(m, 4000);
        }
    };

    window.confirm = function (msg) {
        // confirm() síncrono não pode ser substituído por modal assíncrono
        // Retorna true para não bloquear fluxos, e mostra um Toast informativo
        Toast.info(msg ? String(msg).substring(0, 80) : 'Confirmar ação?', 3000);
        return true;
    };


    // ══════════════════════════════════════════════════════
    // FIX 1: Menu — Retorno e Config somem porque o nav
    // tem 8 itens e a tela não rola. Reduzimos para caber.
    // + showTab aceita (tab) e (tab, el)
    // ══════════════════════════════════════════════════════
    window.showTab = function (tab, el) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const target = document.getElementById('tab-' + tab);
        if (target) { target.classList.add('active'); target.style.animation = 'tabFadeIn 0.25s ease'; }
        if (el) { el.classList.add('active'); }
        else {
            const q = ".nav-item[onclick*=\"'" + tab + "'\"]";
            const navEl = document.querySelector(q);
            if (navEl) navEl.classList.add('active');
        }
        if (tab === 'dashboard') { window.updateDashboard?.(true); window.renderSixMonthChart?.(); window.renderAnnualBalance?.(); }
        if (tab === 'history')   window.renderHistory?.('all');
        if (tab === 'expenses')  { window.renderExpensesList?.(); }
        if (tab === 'catalog')   window.renderCatalogList?.();
        if (tab === 'agenda')    window.renderAgenda?.();
        if (tab === 'crm')       window.renderCRM?.();
    };
    window.clickNewTab = function (el) { window.resetForm?.(); window.setOpType?.('venda'); window.showTab('new', el); };


    // ══════════════════════════════════════════════════════
    // FIX 2: WhatsApp suporte número correto
    // ══════════════════════════════════════════════════════
    setTimeout(() => {
        const fab = document.getElementById('support-fab');
        if (fab) {
            fab.onclick = function () {
                window.open('https://wa.me/5587996523840?text=' + encodeURIComponent('Olá! Preciso de ajuda com o Sistema Authon.'), '_blank');
            };
        }
    }, 1500);


    // ══════════════════════════════════════════════════════
    // FIX 3: App abrindo no recibo em vez da tela inicial
    // O pdf-overlay não tinha display:none no CSS original
    // ══════════════════════════════════════════════════════
    const pdfOverlay = document.getElementById('pdf-overlay');
    if (pdfOverlay) {
        pdfOverlay.style.display = 'none';
    }
    window.closePDF = function () {
        const o = document.getElementById('pdf-overlay');
        if (o) { o.style.display = 'none'; o.scrollTop = 0; }
        window.resetForm?.();
    };
    const _origGen = window.generatePDF;
    window.generatePDF = function (data) {
        const o = document.getElementById('pdf-overlay');
        if (o) { o.style.display = 'block'; o.scrollTop = 0; }
        if (_origGen) _origGen(data);
    };


    // ══════════════════════════════════════════════════════
    // FIX 4 + FIX DESPESAS: Botões de período — só 1 ativo
    // Reescreve expPeriod e histPeriod para limpar todos
    // antes de ativar o clicado
    // ══════════════════════════════════════════════════════
    window.expPeriod = function (btn, range) {
        // Remove active de TODOS os botões de período da aba despesas
        document.querySelectorAll('#tab-expenses .hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
        window.renderExpensesList?.();
    };

    window.histPeriod = function (btn, range) {
        document.querySelectorAll('#tab-history .hist-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const today = new Date();
        const s = document.getElementById('histFilterStart');
        const e = document.getElementById('histFilterEnd');
        if (!s || !e) return;
        if (range === 'today') {
            const str = today.toLocaleDateString('en-CA'); s.value = str; e.value = str;
        } else if (range === 'month') {
            s.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            e.value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        } else { s.value = ''; e.value = ''; }
        window.renderHistory?.(window.currentHistoryFilter || 'all');
    };


    // ══════════════════════════════════════════════════════
    // FIX 5: Nova Despesa — ao abrir, esconde a lista
    // Ao fechar, mostra a lista novamente
    // ══════════════════════════════════════════════════════
    window.toggleExpForm = function (forceClose) {
        const wrapper  = document.getElementById('exp-form-wrapper');
        const icon     = document.getElementById('exp-new-icon');
        const listDiv  = document.getElementById('expense-list-mini');
        const filterRow = document.querySelector('#tab-expenses .hist-status-row');
        if (!wrapper) return;
        const isOpen = wrapper.style.display === 'block';
        if (forceClose || isOpen) {
            // Fecha formulário, mostra lista
            wrapper.style.display = 'none';
            if (icon) icon.className = 'fas fa-plus';
            if (listDiv) listDiv.style.display = 'block';
            if (filterRow) filterRow.style.display = 'flex';
        } else {
            // Abre formulário, esconde lista
            wrapper.style.display = 'block';
            if (icon) icon.className = 'fas fa-times';
            if (listDiv) listDiv.style.display = 'none';
            if (filterRow) filterRow.style.display = 'none';
            setTimeout(() => wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    };

    // Após salvar despesa, reexibe a lista
    const _origSaveExp = window.saveExpense;
    window.saveExpense = async function () {
        if (_origSaveExp) await _origSaveExp();
        // garante que a lista volta a aparecer
        const listDiv = document.getElementById('expense-list-mini');
        const filterRow = document.querySelector('#tab-expenses .hist-status-row');
        if (listDiv) listDiv.style.display = 'block';
        if (filterRow) filterRow.style.display = 'flex';
    };


    // ══════════════════════════════════════════════════════
    // CSS — todos os fixes visuais
    // ══════════════════════════════════════════════════════
    const s = document.createElement('style');
    s.textContent = `
        /* Animação tab */
        @keyframes tabFadeIn { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }

        /* FIX menu: nav compacto para caber 8 itens */
        .bottom-nav { overflow-x: auto; justify-content: flex-start !important; gap: 0; padding-bottom: max(8px, env(safe-area-inset-bottom)); }
        .nav-item { padding: 6px 8px !important; min-width: 52px; font-size: 8px !important; }
        .nav-item i { font-size: 17px !important; }

        /* FIX brand header centralizado e profissional */
        .brand-header {
            background: linear-gradient(135deg,#1e272e 0%,#2d3436 100%) !important;
            padding: 10px 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 10px !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 800 !important;
        }
        .brand-logo {
            font-family: 'Oswald',sans-serif !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            letter-spacing: 2px !important;
            color: white !important;
            text-transform: uppercase !important;
        }

        /* FIX botões período — só .active colorido */
        .hist-period-btn {
            background: transparent !important;
            color: rgba(255,255,255,0.5) !important;
            border: 1px solid rgba(255,255,255,0.15) !important;
        }
        .hist-period-btn.active {
            background: #e74c3c !important;
            border-color: #e74c3c !important;
            color: white !important;
        }

        /* FIX botão Nova Despesa proporcional */
        .exp-new-btn {
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            background: linear-gradient(135deg,#e74c3c,#c0392b) !important;
            color: white !important;
            border: none !important;
            border-radius: 20px !important;
            padding: 8px 16px !important;
            font-family: 'Poppins',sans-serif !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 3px 10px rgba(231,76,60,0.35) !important;
            white-space: nowrap !important;
            width: auto !important;
        }

        /* FIX header despesas */
        .exp-header-label { display: none !important; }
        .exp-header-title {
            font-family: 'Oswald',sans-serif !important;
            font-size: 22px !important;
            color: white !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
        }
        .exp-header-top {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 14px !important;
        }

        /* FIX busca histórico legível */
        .hist-search-input {
            color: #1e272e !important;
            background: rgba(255,255,255,0.95) !important;
        }
        .hist-search-input::placeholder { color: rgba(30,39,46,0.45) !important; }

        /* FIX pdf-overlay: oculto por padrão, fixo quando aberto */
        #pdf-overlay {
            display: none;
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            z-index: 99998 !important;
            background: #f5f6fa !important;
            overflow-y: auto !important;
        }

        /* FIX modal-config (alterar logo) */
        #modal-config {
            display: none;
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
            background: rgba(0,0,0,0.6) !important;
            align-items: center !important;
            justify-content: center !important;
        }
    `;
    document.head.appendChild(s);


    // ══════════════════════════════════════════════════════
    // Brand header centralizado com ícone
    // ══════════════════════════════════════════════════════
    const brandHeader = document.querySelector('.brand-header');
    if (brandHeader) {
        brandHeader.innerHTML = `
            <div style="width:28px;height:28px;background:linear-gradient(135deg,#e74c3c,#c0392b);
                        border-radius:8px;display:flex;align-items:center;justify-content:center;
                        flex-shrink:0;box-shadow:0 2px 8px rgba(231,76,60,0.4);">
                <i class="fas fa-bolt" style="color:white;font-size:14px;"></i>
            </div>
            <span class="brand-logo">SISTEMA AUTHON</span>
        `;
    }

    // ══ FIX Alterar Logo: modal-config oculto e centralizado ══
    const modalConfig = document.getElementById('modal-config');
    if (modalConfig) {
        modalConfig.style.display    = 'none';
        modalConfig.style.position   = 'fixed';
        modalConfig.style.top        = '0';
        modalConfig.style.left       = '0';
        modalConfig.style.width      = '100%';
        modalConfig.style.height     = '100%';
        modalConfig.style.background = 'rgba(0,0,0,0.6)';
        modalConfig.style.zIndex     = '99999';
        modalConfig.style.alignItems = 'center';
        modalConfig.style.justifyContent = 'center';
    }
    // Corrige openModal para usar flex ao abrir
    window.openModal  = function () {
        const m = document.getElementById('modal-config');
        if (m) { m.style.display = 'flex'; }
    };
    window.closeModal = function () {
        const m = document.getElementById('modal-config');
        if (m) { m.style.display = 'none'; }
    };

    // ══════════════════════════════════════════════════════
    // CORREÇÃO CONFIRM() — Deletes e ações críticas
    // Substitui confirm() síncrono por Confirm() assíncrono
    // com modal visual bonito e seguro
    // ══════════════════════════════════════════════════════

    // 1. EXCLUIR ITEM (histórico, agenda, despesas)
    window.deleteItem = async function (docId) {
        if (localStorage.getItem('authon_mode_locked') === 'true') {
            Toast.error('Funcionários não podem excluir registros.');
            return;
        }
        if (!docId || docId === 'undefined') {
            Toast.error('Item sem ID. Recarregue a página.');
            return;
        }
        Confirm(
            'Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.',
            async () => {
                try {
                    await window.deleteDoc(window.doc(window.db, 'operacoes', docId));
                    Toast.success('Registro excluído com sucesso!');
                } catch (e) {
                    console.error(e);
                    Toast.error('Erro ao excluir. Tente novamente.');
                }
            }
        );
    };

    // 2. EXCLUIR DO CATÁLOGO
    window.delCatalog = async function (idx) {
        if (localStorage.getItem('authon_mode_locked') === 'true') {
            Toast.error('Bloqueado para funcionários.');
            return;
        }
        const cat  = JSON.parse(localStorage.getItem('catalog_v1') || '[]');
        const item = cat[idx];
        if (!item?.docId) { Toast.error('Item sem ID. Recarregue a página.'); return; }

        Confirm(
            `Excluir "<strong>${item.name}</strong>" do catálogo permanentemente?`,
            async () => {
                try {
                    await window.deleteDoc(window.doc(window.db, 'catalogo', item.docId));
                    Toast.success('Item excluído do catálogo!');
                } catch (e) {
                    Toast.error('Erro ao excluir: ' + e.message);
                }
            }
        );
    };

    // 3. LOGOUT
    window.logout = function () {
        Confirm(
            'Deseja sair e bloquear o sistema?',
            async () => {
                await window.auth.signOut();
                location.reload();
            }
        );
    };

    // 4. REDEFINIR SENHA
    window.resetPassword = async function () {
        const user = window.auth?.currentUser;
        if (!user) return;
        Confirm(
            `Enviar link de troca de senha para <strong>${user.email}</strong>?`,
            async () => {
                try {
                    const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    await sendPasswordResetEmail(window.auth, user.email);
                    Toast.success('E-mail enviado! Verifique sua caixa de entrada.');
                } catch (e) {
                    Toast.error('Erro: ' + e.message);
                }
            }
        );
    };

    // 5. ATIVAR MODO FUNCIONÁRIO
    window.toggleEmployeeMode = function (activate) {
        if (activate) {
            const pin = localStorage.getItem('authon_cfg_pin');
            Confirm(
                'Ativar modo funcionário? O financeiro e configurações serão bloqueados.',
                () => {
                    localStorage.setItem('authon_mode_locked', 'true');
                    document.body.classList.add('employee-mode');
                    const btn = document.getElementById('unlock-btn');
                    if (btn) btn.style.display = 'flex';
                    Toast.info('Modo funcionário ativado.');
                }
            );
        } else {
            // Desbloquear — pede PIN
            const pin = localStorage.getItem('authon_cfg_pin');
            if (pin) {
                // Cria mini modal de PIN
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';
                modal.innerHTML = `
                    <div style="background:white;border-radius:20px;padding:28px 24px;max-width:300px;width:100%;text-align:center;">
                        <div style="font-size:32px;margin-bottom:12px;">🔐</div>
                        <h3 style="font-family:'Oswald',sans-serif;font-size:18px;color:#1e272e;margin-bottom:8px;">PIN do Proprietário</h3>
                        <p style="font-family:'Poppins',sans-serif;font-size:12px;color:#95a5a6;margin-bottom:16px;">Digite o PIN para desbloquear</p>
                        <input id="pin-input" type="password" inputmode="numeric" maxlength="6"
                            style="width:100%;padding:12px;border:2px solid #e74c3c;border-radius:12px;font-size:20px;text-align:center;font-family:'Poppins',sans-serif;letter-spacing:8px;outline:none;box-sizing:border-box;"
                            placeholder="••••">
                        <div style="display:flex;gap:10px;margin-top:16px;">
                            <button id="pin-cancel" style="flex:1;padding:12px;border-radius:12px;border:2px solid #ecf0f1;background:#f8f9fa;color:#7f8c8d;font-family:'Poppins',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button>
                            <button id="pin-ok" style="flex:1;padding:12px;border-radius:12px;border:none;background:#e74c3c;color:white;font-family:'Poppins',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Desbloquear</button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);
                setTimeout(() => document.getElementById('pin-input')?.focus(), 100);

                document.getElementById('pin-ok').onclick = () => {
                    const entered = document.getElementById('pin-input').value;
                    if (entered === pin) {
                        localStorage.setItem('authon_mode_locked', 'false');
                        document.body.classList.remove('employee-mode');
                        const btn = document.getElementById('unlock-btn');
                        if (btn) btn.style.display = 'none';
                        modal.remove();
                        Toast.success('Sistema desbloqueado!');
                    } else {
                        Toast.error('PIN incorreto. Tente novamente.');
                        document.getElementById('pin-input').value = '';
                        document.getElementById('pin-input').focus();
                    }
                };
                document.getElementById('pin-cancel').onclick = () => modal.remove();
                document.getElementById('pin-input').addEventListener('keyup', e => {
                    if (e.key === 'Enter') document.getElementById('pin-ok').click();
                });
            } else {
                localStorage.setItem('authon_mode_locked', 'false');
                document.body.classList.remove('employee-mode');
                const btn = document.getElementById('unlock-btn');
                if (btn) btn.style.display = 'none';
                Toast.success('Sistema desbloqueado!');
            }
        }
    };

    // 6. BLOQUEAR/LIBERAR CLIENTE (admin)
    window.adminSetStatus = async function (docId, newStatus) {
        const acao = newStatus === 'bloqueado' ? 'BLOQUEAR' : 'LIBERAR';
        Confirm(
            `Tem certeza que deseja <strong>${acao}</strong> esta oficina?`,
            async () => {
                try {
                    await window.updateDoc(window.doc(window.db, 'configuracoes', docId), { status: newStatus });
                    Toast.success(`Oficina ${acao === 'BLOQUEAR' ? 'bloqueada' : 'liberada'} com sucesso!`);
                    window.openSuperAdmin?.();
                } catch (e) {
                    Toast.error('Erro ao alterar status.');
                }
            }
        );
    };
    window.toggleBlockClient = window.adminSetStatus;

    // 7. PREENCHER DADOS DO CLIENTE (fillClientData)
    window.fillClientData = function (input) {
        const name = input.value;
        const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        const last = db.find(i => i.client === name);
        if (last) {
            Confirm(
                `Cliente encontrado! Preencher dados do <strong>${last.vehicle}</strong>?`,
                () => {
                    if (document.getElementById('phone'))   document.getElementById('phone').value   = last.phone   || '';
                    if (document.getElementById('vehicle')) document.getElementById('vehicle').value = last.vehicle || '';
                    if (document.getElementById('plate'))   document.getElementById('plate').value   = last.plate   || '';
                    if (document.getElementById('color'))   document.getElementById('color').value   = last.color   || '';
                    if (last.cpf && document.getElementById('clientCpf')) document.getElementById('clientCpf').value = last.cpf;
                    Toast.success('Dados preenchidos automaticamente!');
                }
            );
        }
    };

    // ── OVERRIDE FINAL: garante renderHistory correto ──
    window.renderHistory = function (filter) {
        window.currentHistoryFilter = filter;
        const db   = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        const list = document.getElementById('history-list');
        if (!list) return;

        const term   = (document.getElementById('historySearch')?.value || '').toLowerCase();
        const hStart = document.getElementById('histFilterStart')?.value || '';
        const hEnd   = document.getElementById('histFilterEnd')?.value   || '';
        const compName = localStorage.getItem('authon_cfg_name') || 'SUA OFICINA';
        const savedPix = localStorage.getItem('authon_cfg_pix') || '';

        list.innerHTML = '';

        let filtered = db.filter(x => x.type !== 'agendamento' && x.type !== 'expense');
        if (filter === 'venda')     filtered = filtered.filter(x => x.type === 'venda');
        if (filter === 'orcamento') filtered = filtered.filter(x => x.type === 'orcamento');
        if (filter === 'pendente')  filtered = filtered.filter(x => x.status === 'pendente');
        if (filter === 'pago')      filtered = filtered.filter(x => x.status === 'pago');
        if (hStart) filtered = filtered.filter(x => x.date >= hStart);
        if (hEnd)   filtered = filtered.filter(x => x.date <= hEnd);
        filtered.sort((a, b) => b.id - a.id);

        if (!filtered.length) {
            list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
                <i class="fas fa-folder-open" style="font-size:40px;margin-bottom:12px;display:block;"></i>
                <div style="font-size:14px;font-weight:600;">Nenhum registro encontrado</div>
                <div style="font-size:12px;margin-top:5px;">Tente mudar o período ou filtro</div>
            </div>`;
            return;
        }

        // Agrupa por data
        const grouped = {};
        filtered.forEach(item => {
            const fullText = ((item.client||'') + ' ' + (item.vehicle||'') + ' ' + (item.plate||'') + ' ' + item.total).toLowerCase();
            if (term && !fullText.includes(term)) return;
            if (!grouped[item.date]) grouped[item.date] = [];
            grouped[item.date].push(item);
        });

        if (!Object.keys(grouped).length) {
            list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
                <i class="fas fa-search" style="font-size:40px;margin-bottom:12px;display:block;"></i>
                <div style="font-size:14px;font-weight:600;">Nenhum resultado para a busca</div>
            </div>`;
            return;
        }

        const today     = new Date().toLocaleDateString('en-CA');
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

        Object.keys(grouped).sort().reverse().forEach(date => {
            let dayLabel = date.split('-').reverse().join('/');
            if (date === today)     dayLabel = '📅 Hoje — ' + dayLabel;
            if (date === yesterday) dayLabel = '📆 Ontem — ' + dayLabel;
            list.innerHTML += '<div class="hist-date-separator">' + dayLabel + '</div>';

            grouped[date].forEach(item => {
                const esc = s => (s || '').replace(/'/g, "\\'");
                const borderColor = item.status === 'pago' ? '#00b894' : item.type === 'orcamento' ? '#95a5a6' : '#f39c12';
                const badgeClass  = item.status === 'pago' ? 'bg-venda' : item.type === 'orcamento' ? 'bg-orcamento' : 'bg-pendente';
                const statusText  = item.status === 'pago' ? 'PAGO' : item.type === 'orcamento' ? 'ORÇAMENTO' : 'PENDENTE';

                const val = (item.netTotal && item.netTotal < item.total) ? item.netTotal : item.total;
                const priceHtml = '<div style="font-family:Oswald,sans-serif;font-size:26px;font-weight:700;color:#1e272e;">R$ ' + val.toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</div>';

                let itemsHtml = '<ul style="margin:8px 0 10px 18px;padding:0;font-size:12px;color:#636e72;line-height:1.7;">';
                (item.items||[]).forEach(i => {
                    let d = i.desc || '';
                    if (d.includes(' - ') && d.includes('(')) { try { d = d.split(' - ')[1].split(' (')[0]; } catch(e){} }
                    itemsHtml += '<li>' + (i.qty > 1 ? i.qty + 'x ' : '') + d + '</li>';
                });
                itemsHtml += '</ul>';

                const plateInfo = item.plate
                    ? ' <span style="background:#f0f3f9;color:#636e72;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">' + item.plate.toUpperCase() + '</span>'
                    : '';

                let payBtn = '';
                let actionBtn = '<button class="btn-card" style="background:#f0f3f9;color:#636e72;flex:1;" onclick="openBeforeAfterModal('' + esc(item.client) + '','' + esc(item.vehicle) + '','' + (item.phone||'') + '','' + esc(item.plate) + '')"><i class="fas fa-camera-retro"></i> Antes & Depois</button>';

                if (item.type === 'venda' && item.status === 'pendente') {
                    let pixText = savedPix ? '\n\n🔑 Pix: ' + savedPix : '';
                    const zapMsg  = '*' + compName + '*\n--------------------------------\nOlá *' + item.client + '*, o serviço no seu *' + (item.vehicle||'veículo') + '* foi finalizado! ✨\n\n💰 *Total:* R$ ' + item.total.toLocaleString('pt-BR',{minimumFractionDigits:2}) + pixText + '\n\nAguardamos! 🤝';
                    const zapLink = 'https://wa.me/55' + (item.phone||'').replace(/\D/g,'') + '?text=' + encodeURIComponent(zapMsg);
                    actionBtn += '<button class="btn-card" style="background:#e8fdf4;color:#00b894;flex:1;" onclick="window.open('' + zapLink + '')"><i class="fab fa-whatsapp"></i> AVISAR</button>';
                    payBtn = '<button class="btn-action" style="background:var(--green-grad);width:100%;margin:12px 0 6px;font-size:13px;padding:14px;border-radius:14px;animation:softPulse 2.5s infinite;box-shadow:0 6px 20px rgba(0,184,148,0.4);" onclick="window.openPayModal('' + item.docId + '',' + item.total + ')"><i class="fas fa-hand-holding-usd" style="margin-right:8px;"></i> RECEBER PAGAMENTO</button>';
                }

                list.innerHTML += '<div class="item-card" style="border-left:4px solid ' + borderColor + ';">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                        '<div>' +
                            '<div style="font-size:17px;font-weight:800;color:#1e272e;">' + (item.client||'') + '</div>' +
                            '<div style="font-size:12px;color:#95a5a6;margin-top:3px;">' + (item.vehicle||'') + plateInfo + ' · ' + (item.phone||'') + '</div>' +
                        '</div>' +
                        '<span class="status-badge ' + badgeClass + '">' + statusText + '</span>' +
                    '</div>' +
                    itemsHtml +
                    '<div style="border-top:1px solid #f5f6fa;padding-top:10px;margin-bottom:6px;">' + priceHtml + '</div>' +
                    payBtn +
                    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
                        '<div style="display:flex;gap:6px;flex:1;">' + actionBtn + '</div>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<button class="btn-card" style="background:#f0f3f9;color:#2d3436;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="generatePDFFromHistory(' + item.id + ')"><i class="fas fa-file-pdf"></i></button>' +
                            '<button class="btn-card" style="background:#e8f4fd;color:#0984e3;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="loadToEdit(' + item.id + ')"><i class="fas fa-pen"></i></button>' +
                            '<button class="btn-card" style="background:#fef0ee;color:#e74c3c;width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="deleteItem('' + item.docId + '')"><i class="fas fa-trash"></i></button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
        });
    };

    console.log('✅ fixes.js v3 — aplicado');
});
