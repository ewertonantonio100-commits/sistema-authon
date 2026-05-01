// ============================================================
// fixes.js — Correções dos 6 bugs reportados
// Carregar APÓS todos os outros módulos
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ══════════════════════════════════════════════════════
    // FIX 1: PDF overlay vazando em outras telas
    // Garante que o pdf-overlay fica escondido e isolado
    // ══════════════════════════════════════════════════════
    const pdfOverlay = document.getElementById('pdf-overlay');
    if (pdfOverlay) {
        pdfOverlay.style.display   = 'none';
        pdfOverlay.style.position  = 'fixed';
        pdfOverlay.style.top       = '0';
        pdfOverlay.style.left      = '0';
        pdfOverlay.style.width     = '100%';
        pdfOverlay.style.height    = '100%';
        pdfOverlay.style.zIndex    = '99998';
        pdfOverlay.style.background = '#fff';
        pdfOverlay.style.overflowY = 'auto';
        pdfOverlay.style.padding   = '0';
    }

    // Corrige o closePDF para garantir que some mesmo
    window.closePDF = function () {
        const o = document.getElementById('pdf-overlay');
        if (o) o.style.display = 'none';
        window.resetForm && window.resetForm();
    };


    // ══════════════════════════════════════════════════════
    // FIX 2: Número do WhatsApp de suporte correto
    // ══════════════════════════════════════════════════════
    const fab = document.getElementById('support-fab');
    if (fab) {
        fab.onclick = function () {
            const msg = encodeURIComponent('Olá! Preciso de ajuda com o Sistema Authon.');
            window.open('https://wa.me/5587996523840?text=' + msg, '_blank');
        };
    }


    // ══════════════════════════════════════════════════════
    // FIX 3: Campo de busca do Histórico com texto legível
    // ══════════════════════════════════════════════════════
    const histSearch = document.getElementById('historySearch');
    if (histSearch) {
        histSearch.style.color       = '#1e272e';
        histSearch.style.background  = 'rgba(255,255,255,0.95)';
        histSearch.style.border      = '1.5px solid rgba(255,255,255,0.3)';
        histSearch.style.borderRadius = '12px';
        histSearch.style.padding     = '11px 14px';
        histSearch.style.fontFamily  = "'Poppins', sans-serif";
        histSearch.style.fontSize    = '13px';
        histSearch.style.width       = '100%';

        // Placeholder visível
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            #historySearch::placeholder { color: rgba(30,39,46,0.5) !important; }
            #historySearch:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(styleEl);
    }


    // ══════════════════════════════════════════════════════
    // FIX 4: Botão "Nova Despesa" bonito + formulário abre
    // ══════════════════════════════════════════════════════
    const btnNovaDespesa = document.querySelector('#tab-expenses [onclick*="toggleExpForm"]');
    if (btnNovaDespesa) {
        btnNovaDespesa.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white; border: none; border-radius: 14px;
            padding: 12px 20px; font-family: 'Poppins', sans-serif;
            font-size: 13px; font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 16px rgba(231,76,60,0.35);
            margin: 15px 15px 0; width: calc(100% - 30px);
            transition: transform 0.15s;
        `;
    }

    // Garante que o wrapper do formulário existe e funciona
    window.toggleExpForm = function (forceClose) {
        // Tenta os dois IDs possíveis
        const wrapper = document.getElementById('exp-form-wrapper') 
                     || document.getElementById('exp-form-card');
        const icon    = document.getElementById('exp-new-icon');

        if (!wrapper) return;
        const isOpen = wrapper.style.display === 'block';

        if (forceClose || isOpen) {
            wrapper.style.display = 'none';
            if (icon) icon.className = 'fas fa-plus';
        } else {
            wrapper.style.display = 'block';
            if (icon) icon.className = 'fas fa-times';
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };


    // ══════════════════════════════════════════════════════
    // FIX 5: PDF com botão de baixar visível e sem vazar
    // ══════════════════════════════════════════════════════
    const invoicePaper = document.getElementById('invoice-paper');
    if (invoicePaper) {
        invoicePaper.style.maxWidth  = '100%';
        invoicePaper.style.width     = '100%';
        invoicePaper.style.overflowX = 'hidden';
    }

    // Rebinda o generatePDF para garantir que o overlay aparece corretamente
    const _origGeneratePDF = window.generatePDF;
    window.generatePDF = function (data) {
        const o = document.getElementById('pdf-overlay');
        if (o) {
            o.style.display  = 'block';
            o.style.position = 'fixed';
            o.style.top      = '0';
            o.style.left     = '0';
            o.style.width    = '100%';
            o.style.height   = '100%';
            o.style.zIndex   = '99998';
            o.style.overflowY = 'auto';
            o.style.background = '#f5f6fa';
            // Scroll ao topo para mostrar os botões
            o.scrollTop = 0;
        }
        if (_origGeneratePDF) _origGeneratePDF(data);
    };


    // ══════════════════════════════════════════════════════
    // FIX 6: Aba de Configurações sumiu do menu
    // Garante que o nav-item de settings existe e funciona
    // ══════════════════════════════════════════════════════
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
        // Verifica se existe item de settings
        const hasSettings = bottomNav.querySelector('[onclick*="settings"]');
        if (!hasSettings) {
            // Adiciona o botão de configurações se não existir
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'nav-item';
            settingsBtn.onclick   = function () { window.showTab('settings'); };
            settingsBtn.innerHTML = '<i class="fas fa-cog"></i><span>CONFIG.</span>';
            bottomNav.appendChild(settingsBtn);
        }
    }

    // Garante que showTab de settings funciona
    const _origShowTab = window.showTab;
    window.showTab = function (tab) {
        // Chama o original
        if (_origShowTab) _origShowTab(tab);

        // Fallback manual caso o original falhe
        const target = document.getElementById('tab-' + tab);
        if (target && !target.classList.contains('active')) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            target.classList.add('active');
        }
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navEl = document.querySelector(`.nav-item[onclick*="${tab}"]`);
        if (navEl) navEl.classList.add('active');

        // Callbacks específicos
        if (tab === 'settings' && window.saveSettingsCustom) {
            // aba aberta — nada extra necessário
        }
        if (tab === 'expenses' && window.renderExpensesList) window.renderExpensesList();
    };

    console.log('✅ fixes.js aplicado — 6 correções ativas');
});
