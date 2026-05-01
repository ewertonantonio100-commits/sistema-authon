// ============================================================
// ui.js — Feedback visual, Onboarding, Suporte, Navegação
// ============================================================

// ── TOAST SYSTEM (substitui todos os alert()) ──
window.Toast = {
    _container: null,

    _getContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.id = 'toast-container';
            this._container.style.cssText = `
                position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
                z-index: 999999; display: flex; flex-direction: column;
                gap: 10px; width: 90%; max-width: 360px; pointer-events: none;
            `;
            document.body.appendChild(this._container);
        }
        return this._container;
    },

    show(msg, type = 'info', duration = 3500) {
        const colors = {
            success: { bg: '#00b894', icon: 'fa-check-circle' },
            error:   { bg: '#e74c3c', icon: 'fa-exclamation-circle' },
            warning: { bg: '#f39c12', icon: 'fa-exclamation-triangle' },
            info:    { bg: '#0984e3', icon: 'fa-info-circle' },
        };
        const c = colors[type] || colors.info;
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${c.bg}; color: white;
            padding: 13px 18px; border-radius: 14px;
            font-family: 'Poppins', sans-serif; font-size: 13px; font-weight: 600;
            display: flex; align-items: center; gap: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            pointer-events: all; cursor: pointer;
            animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
            transition: opacity 0.3s, transform 0.3s;
        `;
        toast.innerHTML = `<i class="fas ${c.icon}" style="font-size:16px;flex-shrink:0;"></i><span>${msg}</span>`;
        toast.onclick = () => this._dismiss(toast);

        const container = this._getContainer();
        container.appendChild(toast);

        setTimeout(() => this._dismiss(toast), duration);
    },

    _dismiss(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 300);
    },

    success: (msg, d) => Toast.show(msg, 'success', d),
    error:   (msg, d) => Toast.show(msg, 'error',   d),
    warning: (msg, d) => Toast.show(msg, 'warning', d),
    info:    (msg, d) => Toast.show(msg, 'info',    d),
};

// Injeta estilo do toast
(function injectToastStyle() {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes toastIn {
            from { opacity: 0; transform: translateY(-12px) scale(0.95); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
    `;
    document.head.appendChild(s);
})();


// ── MODAL DE CONFIRMAÇÃO (substitui confirm()) ──
window.Confirm = function(msg, onYes, onNo) {
    const existing = document.getElementById('authon-confirm-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'authon-confirm-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 999998;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; padding: 20px;
    `;
    modal.innerHTML = `
        <div style="background:white; border-radius:20px; padding:28px 24px;
                    max-width:320px; width:100%; text-align:center;
                    box-shadow:0 20px 60px rgba(0,0,0,0.3);
                    animation: toastIn 0.25s ease;">
            <div style="width:52px;height:52px;background:#fff0f0;border-radius:50%;
                        display:flex;align-items:center;justify-content:center;
                        margin:0 auto 14px;">
                <i class="fas fa-question" style="font-size:22px;color:#e74c3c;"></i>
            </div>
            <p style="font-family:'Poppins',sans-serif;font-size:14px;color:#2d3436;
                      line-height:1.6;margin-bottom:22px;">${msg}</p>
            <div style="display:flex;gap:10px;">
                <button id="confirm-no"
                    style="flex:1;padding:12px;border-radius:12px;border:2px solid #f0f0f0;
                           background:#f8f9fa;color:#7f8c8d;font-family:'Poppins',sans-serif;
                           font-size:13px;font-weight:700;cursor:pointer;">
                    Cancelar
                </button>
                <button id="confirm-yes"
                    style="flex:1;padding:12px;border-radius:12px;border:none;
                           background:#e74c3c;color:white;font-family:'Poppins',sans-serif;
                           font-size:13px;font-weight:700;cursor:pointer;
                           box-shadow:0 4px 14px rgba(231,76,60,0.35);">
                    Confirmar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-yes').onclick = () => { modal.remove(); if (onYes) onYes(); };
    document.getElementById('confirm-no').onclick  = () => { modal.remove(); if (onNo)  onNo();  };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); if (onNo) onNo(); } };
};


// ── ONBOARDING GUIADO (3 PASSOS) ──
window.Onboarding = {
    steps: [
        {
            title: '👋 Bem-vindo ao Authon!',
            desc: 'Seu sistema de gestão está pronto. Vamos configurar em 3 passos rápidos para você começar a usar agora.',
            btn: 'Vamos lá!',
            icon: 'fa-rocket',
            color: '#6c5ce7',
        },
        {
            title: '🏢 Configure sua oficina',
            desc: 'Adicione o nome da sua empresa, telefone e chave Pix. Essas informações aparecem nos PDFs enviados para seus clientes.',
            btn: 'Ir para Configurações',
            icon: 'fa-building',
            color: '#0984e3',
            action: () => { window.showTab && window.showTab('settings'); },
        },
        {
            title: '🛠️ Crie seu primeiro serviço',
            desc: 'Já adicionamos alguns serviços padrão no seu catálogo. Você pode editar os preços ou adicionar novos conforme sua tabela.',
            btn: 'Ver Catálogo',
            icon: 'fa-box-open',
            color: '#00b894',
            action: () => { window.showTab && window.showTab('catalog'); },
        },
        {
            title: '✅ Tudo pronto!',
            desc: 'Agora é só atender seus clientes. Qualquer dúvida, use o botão de suporte — estamos aqui pra ajudar!',
            btn: 'Começar a usar',
            icon: 'fa-check-circle',
            color: '#00b894',
        },
    ],

    current: 0,
    _modal: null,

    show() {
        if (localStorage.getItem('authon_onboarding_v2_done') === 'true') return;
        this.current = 0;
        this._render();
    },

    _render() {
        const step = this.steps[this.current];
        const total = this.steps.length;

        if (!this._modal) {
            this._modal = document.createElement('div');
            this._modal.id = 'onboarding-modal';
            this._modal.style.cssText = `
                position: fixed; inset: 0; z-index: 999997;
                background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center; padding: 20px;
            `;
            document.body.appendChild(this._modal);
        }

        const dots = this.steps.map((_, i) =>
            `<div style="width:${i===this.current?'20px':'8px'};height:8px;border-radius:20px;
                         background:${i===this.current?step.color:'#dfe6e9'};
                         transition:all 0.3s;"></div>`
        ).join('');

        this._modal.innerHTML = `
            <div style="background:white;border-radius:24px;padding:32px 24px;
                        max-width:340px;width:100%;text-align:center;
                        box-shadow:0 24px 64px rgba(0,0,0,0.35);
                        animation:toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);">
                <div style="width:72px;height:72px;background:${step.color}15;border-radius:24px;
                            display:flex;align-items:center;justify-content:center;
                            margin:0 auto 18px;">
                    <i class="fas ${step.icon}" style="font-size:30px;color:${step.color};"></i>
                </div>
                <h3 style="font-family:'Oswald',sans-serif;font-size:22px;color:#1e272e;
                           letter-spacing:0.5px;margin-bottom:10px;">${step.title}</h3>
                <p style="font-family:'Poppins',sans-serif;font-size:13px;color:#636e72;
                          line-height:1.7;margin-bottom:24px;">${step.desc}</p>
                <div style="display:flex;justify-content:center;gap:6px;margin-bottom:24px;">
                    ${dots}
                </div>
                <button id="ob-next"
                    style="width:100%;padding:14px;border-radius:14px;border:none;
                           background:${step.color};color:white;
                           font-family:'Poppins',sans-serif;font-size:14px;font-weight:700;
                           cursor:pointer;box-shadow:0 6px 20px ${step.color}40;
                           transition:transform 0.15s;">
                    ${step.btn}
                </button>
                ${this.current < total-1 ? `
                <button id="ob-skip"
                    style="width:100%;padding:10px;border-radius:14px;border:none;
                           background:transparent;color:#95a5a6;
                           font-family:'Poppins',sans-serif;font-size:12px;
                           cursor:pointer;margin-top:8px;">
                    Pular introdução
                </button>` : ''}
            </div>
        `;

        document.getElementById('ob-next').onclick = () => {
            if (step.action) step.action();
            if (this.current < total - 1) {
                this.current++;
                this._render();
            } else {
                this._finish();
            }
        };

        const skipBtn = document.getElementById('ob-skip');
        if (skipBtn) skipBtn.onclick = () => this._finish();
    },

    _finish() {
        localStorage.setItem('authon_onboarding_v2_done', 'true');
        if (this._modal) {
            this._modal.style.opacity = '0';
            this._modal.style.transition = 'opacity 0.3s';
            setTimeout(() => { this._modal.remove(); this._modal = null; }, 300);
        }
    },
};


// ── BOTÃO DE SUPORTE FLUTUANTE ──
window.SupportButton = {
    init() {
        const WHATSAPP_NUMBER = '5587996523840'; // Suporte Authon
        const btn = document.createElement('div');
        btn.id = 'support-btn';
        btn.innerHTML = `
            <div id="support-fab" style="
                position:fixed; bottom:80px; right:16px; z-index:9990;
                width:52px; height:52px; border-radius:50%;
                background:linear-gradient(135deg,#25D366,#128C7E);
                display:flex; align-items:center; justify-content:center;
                box-shadow:0 6px 20px rgba(37,211,102,0.45);
                cursor:pointer; transition:transform 0.2s;
            ">
                <i class="fab fa-whatsapp" style="font-size:26px;color:white;"></i>
            </div>
            <div id="support-tooltip" style="
                position:fixed; bottom:142px; right:16px; z-index:9990;
                background:#1e272e; color:white; border-radius:12px;
                padding:10px 14px; font-family:'Poppins',sans-serif;
                font-size:12px; font-weight:600; white-space:nowrap;
                box-shadow:0 4px 16px rgba(0,0,0,0.25);
                opacity:0; pointer-events:none; transition:opacity 0.2s;
            ">
                💬 Falar com suporte
            </div>
        `;
        document.body.appendChild(btn);

        const fab = document.getElementById('support-fab');
        const tooltip = document.getElementById('support-tooltip');

        fab.addEventListener('mouseenter', () => tooltip.style.opacity = '1');
        fab.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
        fab.addEventListener('touchstart', () => {
            tooltip.style.opacity = '1';
            setTimeout(() => tooltip.style.opacity = '0', 2000);
        });
        fab.addEventListener('click', () => {
            const msg = encodeURIComponent('Olá! Preciso de ajuda com o Sistema Authon.');
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
        });

        fab.addEventListener('mousedown', () => fab.style.transform = 'scale(0.9)');
        fab.addEventListener('mouseup',   () => fab.style.transform = 'scale(1)');
    }
};


// ── NAVEGAÇÃO COM ANIMAÇÃO ──
window.showTab = function(tab) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.animation = '';
    });
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById('tab-' + tab);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.animation = 'tabFadeIn 0.25s ease';
    }

    const el = document.querySelector(`.nav-item[onclick*="${tab}"]`);
    if (el) el.classList.add('active');

    // Callbacks pós-navegação
    if (tab === 'dashboard' && window.updateDashboard) window.updateDashboard(true);
    if (tab === 'dashboard' && window.renderSixMonthChart) window.renderSixMonthChart();
    if (tab === 'dashboard' && window.renderAnnualBalance) window.renderAnnualBalance();
    if (tab === 'history'   && window.renderHistory)       window.renderHistory('all');
    if (tab === 'expenses'  && window.renderExpensesList)  window.renderExpensesList();
    if (tab === 'catalog'   && window.renderCatalogList)   window.renderCatalogList();
    if (tab === 'agenda'    && window.renderAgenda)        window.renderAgenda();
};

// Injeta animação de tab
(function injectTabAnim() {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes tabFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(s);
})();


// ── INDICADOR DE LOADING INLINE ──
window.setLoading = function(btnEl, isLoading, originalText) {
    if (!btnEl) return;
    if (isLoading) {
        btnEl.disabled = true;
        btnEl._originalText = btnEl.innerHTML;
        btnEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${originalText || 'Aguarde...'}`;
    } else {
        btnEl.disabled = false;
        btnEl.innerHTML = btnEl._originalText || originalText || 'OK';
    }
};


// ── BADGE DE DIAS DE TRIAL RESTANTES ──
window.showTrialBadge = function(diasRestantes) {
    const existing = document.getElementById('trial-badge-bar');
    if (existing) existing.remove();
    if (diasRestantes <= 0) return;

    const bar = document.createElement('div');
    bar.id = 'trial-badge-bar';
    bar.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; z-index: 9989;
        background: linear-gradient(90deg, #6c5ce7, #a29bfe);
        color: white; text-align: center;
        font-family: 'Poppins', sans-serif; font-size: 12px; font-weight: 600;
        padding: 8px 16px; letter-spacing: 0.3px;
    `;
    bar.innerHTML = `🎉 Período grátis: <strong>${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}</strong> — <span style="text-decoration:underline;cursor:pointer;" onclick="window.open('https://sistemaauthon.com.br/#planos')">Assinar agora</span>`;
    document.body.appendChild(bar);

    // Empurra o conteúdo principal para baixo
    const app = document.querySelector('.bottom-nav');
    if (app) app.style.marginTop = '36px';
};


// ── INIT: chama suporte e onboarding ──
document.addEventListener('DOMContentLoaded', function () {
    window.SupportButton.init();
});
