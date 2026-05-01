// ============================================================
// fixes.js v3 — Todas as correções
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

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

    console.log('✅ fixes.js v3 — aplicado');
});
