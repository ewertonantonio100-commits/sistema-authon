// ============================================================
// fixes.js v2 — Todas as correções visuais e funcionais
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // ══ FIX 1: showTab aceita (tab) e (tab, el) — corrige Config no menu ══
    window.showTab = function (tab, el) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const target = document.getElementById('tab-' + tab);
        if (target) { target.classList.add('active'); target.style.animation = 'tabFadeIn 0.25s ease'; }
        if (el) { el.classList.add('active'); }
        else {
            const navEl = document.querySelector(".nav-item[onclick*=\"'" + tab + "'\"]");
            if (navEl) navEl.classList.add('active');
        }
        if (tab === 'dashboard') { window.updateDashboard?.(true); window.renderSixMonthChart?.(); window.renderAnnualBalance?.(); }
        if (tab === 'history')   window.renderHistory?.('all');
        if (tab === 'expenses')  window.renderExpensesList?.();
        if (tab === 'catalog')   window.renderCatalogList?.();
        if (tab === 'agenda')    window.renderAgenda?.();
        if (tab === 'crm')       window.renderCRM?.();
    };
    window.clickNewTab = function (el) { window.resetForm?.(); window.setOpType?.('venda'); window.showTab('new', el); };

    // ══ FIX 2: WhatsApp suporte — número correto 87996523840 ══
    setTimeout(() => {
        const fab = document.getElementById('support-fab');
        if (fab) {
            fab.onclick = function () {
                window.open('https://wa.me/5587996523840?text=' + encodeURIComponent('Olá! Preciso de ajuda com o Sistema Authon.'), '_blank');
            };
        }
    }, 1500);

    // ══ CSS: Fix 3,4,5,6 e outros visuais ══
    const s = document.createElement('style');
    s.textContent = `
        /* FIX 3: botões período — só o .active fica colorido */
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

        /* FIX 4: botão Nova Despesa — tamanho proporcional ao texto */
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

        /* FIX 5: header despesas — remove label genérico, título bonito */
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

        /* FIX 6: brand-header profissional */
        .brand-header {
            background: linear-gradient(135deg,#1e272e 0%,#2d3436 100%) !important;
            padding: 10px 16px !important;
            display: flex !important;
            align-items: center !important;
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

        /* Campo busca histórico legível */
        .hist-search-input {
            color: #1e272e !important;
            background: rgba(255,255,255,0.95) !important;
        }
        .hist-search-input::placeholder { color: rgba(30,39,46,0.45) !important; }

        /* PDF overlay correto */
        #pdf-overlay {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            z-index: 99998 !important;
            background: #f5f6fa !important;
            overflow-y: auto !important;
        }

        /* Animação tab */
        @keyframes tabFadeIn { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
    `;
    document.head.appendChild(s);

    // ══ FIX 6 JS: Brand header com logo e versão ══
    const brandHeader = document.querySelector('.brand-header');
    if (brandHeader) {
        brandHeader.innerHTML = `
            <div style="width:28px;height:28px;background:linear-gradient(135deg,#e74c3c,#c0392b);
                        border-radius:8px;display:flex;align-items:center;justify-content:center;
                        flex-shrink:0;box-shadow:0 2px 8px rgba(231,76,60,0.4);">
                <i class="fas fa-bolt" style="color:white;font-size:14px;"></i>
            </div>
            <span class="brand-logo">SISTEMA AUTHON</span>
            <span style="margin-left:auto;font-size:9px;font-weight:600;
                         color:rgba(255,255,255,0.35);letter-spacing:1px;">v2.0</span>
        `;
    }

    // ══ toggleExpForm com ID correto ══
    window.toggleExpForm = function (forceClose) {
        const wrapper = document.getElementById('exp-form-wrapper');
        const icon    = document.getElementById('exp-new-icon');
        if (!wrapper) return;
        const isOpen = wrapper.style.display === 'block';
        if (forceClose || isOpen) {
            wrapper.style.display = 'none';
            if (icon) icon.className = 'fas fa-plus';
        } else {
            wrapper.style.display = 'block';
            if (icon) icon.className = 'fas fa-times';
            setTimeout(() => wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    };

    // ══ PDF sem vazar ══
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

    console.log('✅ fixes.js v2 — aplicado');
});
