// ============================================================
// planos.js — Controle de Planos Authon
// Basic / Pro / Premium
// ============================================================

(function () {

    // ── DEFINIÇÃO DOS PLANOS ──
    const PLANOS = {
        basic: {
            nome: 'Basic',
            cor: '#95a5a6',
            features: {
                rankingEquipe:  false,
                modoVendedor:   false,
                suportePrio:    false,
            }
        },
        pro: {
            nome: 'Pro',
            cor: '#00b894',
            features: {
                rankingEquipe:  true,
                modoVendedor:   true,
                suportePrio:    false,
            }
        },
        premium: {
            nome: 'Premium',
            cor: '#f0a500',
            features: {
                rankingEquipe:  true,
                modoVendedor:   true,
                suportePrio:    true,
            }
        }
    };

    // ── LÊ O PLANO ATUAL ──
    function getPlano() {
        const status = localStorage.getItem('authon_status') || '';
        if (status === 'admin') return 'premium'; // admin tem tudo
        return localStorage.getItem('authon_plano') || 'basic';
    }

    function getFeatures() {
        const plano = getPlano();
        return PLANOS[plano]?.features || PLANOS.basic.features;
    }

    // ── MODAL DE UPGRADE ──
    function mostrarUpgrade(featureNome) {
        const old = document.getElementById('plano-upgrade-modal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'plano-upgrade-modal';
        modal.style.cssText = `
            position:fixed;inset:0;z-index:99999;
            background:rgba(7,13,22,0.92);backdrop-filter:blur(8px);
            display:flex;align-items:center;justify-content:center;padding:20px;
            font-family:'Poppins',sans-serif;
        `;
        modal.innerHTML = `
            <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.08);
                        border-radius:24px;padding:36px 28px;max-width:400px;
                        width:100%;text-align:center;animation:modalIn 0.3s ease;">
                <div style="font-size:44px;margin-bottom:12px;">⭐</div>
                <h2 style="font-family:'Oswald',sans-serif;font-size:24px;color:white;
                           text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                    Recurso Pro
                </h2>
                <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;margin-bottom:24px;">
                    <strong style="color:white;">${featureNome}</strong> está disponível
                    nos planos <strong style="color:#00b894;">Pro</strong> e
                    <strong style="color:#f0a500;">Premium</strong>.<br><br>
                    Faça upgrade para desbloquear esta e outras funcionalidades.
                </p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
                    <div style="background:rgba(0,184,148,0.08);border:1px solid rgba(0,184,148,0.3);
                                border-radius:12px;padding:14px 10px;">
                        <div style="font-size:10px;font-weight:700;color:#00b894;
                                    text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Pro</div>
                        <div style="font-size:24px;font-weight:800;color:white;
                                    font-family:'Oswald',sans-serif;">R$97</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.3);">/mês</div>
                    </div>
                    <div style="background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.3);
                                border-radius:12px;padding:14px 10px;">
                        <div style="font-size:10px;font-weight:700;color:#f0a500;
                                    text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Premium</div>
                        <div style="font-size:24px;font-weight:800;color:white;
                                    font-family:'Oswald',sans-serif;">R$147</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.3);">/mês</div>
                    </div>
                </div>
                <a href="https://sistemaauthon.com.br/#planos" target="_blank"
                   style="display:block;width:100%;padding:14px;background:#D92525;color:white;
                          border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;
                          letter-spacing:0.5px;box-shadow:0 6px 20px rgba(217,37,37,0.35);margin-bottom:10px;">
                    🚀 VER PLANOS E FAZER UPGRADE
                </a>
                <button onclick="document.getElementById('plano-upgrade-modal').remove()"
                    style="background:transparent;border:1px solid rgba(255,255,255,0.1);
                           color:rgba(255,255,255,0.4);padding:11px;width:100%;
                           border-radius:10px;font-size:13px;font-weight:600;
                           font-family:'Poppins',sans-serif;cursor:pointer;">
                    Fechar
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }
    window.mostrarUpgradePlano = mostrarUpgrade;

    // ── BADGE DE PLANO NO HEADER ──
    function injetarBadgePlano() {
        const plano = getPlano();
        const status = localStorage.getItem('authon_status') || '';
        if (status === 'admin') return;

        const cfg = PLANOS[plano] || PLANOS.basic;
        const brandHeader = document.querySelector('.brand-header');
        if (!brandHeader || document.getElementById('badge-plano-atual')) return;

        const badge = document.createElement('div');
        badge.id = 'badge-plano-atual';
        badge.style.cssText = `
            display:inline-flex;align-items:center;gap:5px;
            background:${cfg.cor}22;border:1px solid ${cfg.cor}55;
            color:${cfg.cor};padding:3px 10px;border-radius:20px;
            font-size:10px;font-weight:700;letter-spacing:1px;
            text-transform:uppercase;margin-left:10px;cursor:pointer;
        `;
        badge.innerHTML = `<i class="fas fa-crown"></i> ${cfg.nome}`;
        badge.title = `Seu plano atual: ${cfg.nome}`;
        badge.onclick = () => {
            if (plano !== 'premium') {
                mostrarUpgrade('Upgrade de plano');
            }
        };
        brandHeader.appendChild(badge);
    }

    // ── APLICA RESTRIÇÕES DO BASIC ──
    function aplicarRestricoesBasic() {
        const features = getFeatures();

        // ── 1. RANKING DA EQUIPE ──
        if (!features.rankingEquipe) {
            // Esconde o card e label do ranking
            const teamCard = document.getElementById('stats-team');
            if (teamCard) {
                const card = teamCard.closest('.fin-card');
                const label = card?.previousElementSibling;
                if (card)  card.style.display  = 'none';
                if (label && label.classList.contains('fin-section-label')) {
                    label.style.display = 'none';
                }
            }
        }

        // ── 2. MODO VENDEDOR ──
        if (!features.modoVendedor) {
            // Intercepta o botão de Modo Vendedor nas configurações
            const secBtn = document.querySelector('.settings-btn[onclick*="sec-security"]');
            if (secBtn) {
                // Remove o onclick original e substitui pelo upgrade
                secBtn.removeAttribute('onclick');
                secBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    mostrarUpgrade('Modo Vendedor');
                });

                // Adiciona ícone de cadeado indicando que é Pro
                const span = secBtn.querySelector('span');
                if (span && !secBtn.querySelector('.badge-pro')) {
                    const badgePro = document.createElement('span');
                    badgePro.className = 'badge-pro';
                    badgePro.style.cssText = `
                        background:#00b894;color:white;
                        font-size:9px;font-weight:700;
                        padding:2px 8px;border-radius:10px;
                        letter-spacing:0.5px;margin-left:8px;
                    `;
                    badgePro.textContent = 'PRO';
                    span.appendChild(badgePro);
                }
            }

            // Garante que a seção fique fechada
            const secContent = document.getElementById('sec-security');
            if (secContent) secContent.style.display = 'none';
        }

        // ── 3. BADGE PREMIUM (suporte prioritário) ──
        if (features.suportePrio) {
            injetarBadgePremiumSupporte();
        }
    }

    function injetarBadgePremiumSupporte() {
        // Adiciona indicador visual de suporte prioritário nas configurações
        const existing = document.getElementById('badge-suporte-prio');
        if (existing) return;

        const configTab = document.getElementById('tab-settings');
        if (!configTab) return;

        const badge = document.createElement('div');
        badge.id = 'badge-suporte-prio';
        badge.style.cssText = `
            background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.3);
            border-radius:12px;padding:14px 16px;margin:16px;
            display:flex;align-items:center;gap:12px;
        `;
        badge.innerHTML = `
            <i class="fas fa-headset" style="color:#f0a500;font-size:20px;"></i>
            <div>
                <div style="font-weight:700;font-size:13px;color:#f0a500;">Suporte Prioritário</div>
                <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;">
                    Atendimento preferencial via WhatsApp incluído no seu plano Premium.
                    <a href="https://wa.me/5587996523840" target="_blank"
                       style="color:#f0a500;font-weight:700;"> Chamar agora →</a>
                </div>
            </div>
        `;

        // Insere no topo das configurações
        const firstBtn = configTab.querySelector('.settings-btn');
        if (firstBtn?.parentNode) {
            firstBtn.parentNode.insertBefore(badge, firstBtn.parentNode.firstChild);
        }
    }

    // ── INIT ──
    function init() {
        const plano = getPlano();

        // Injeta badge no header
        injetarBadgePlano();

        // Aplica restrições se for Basic
        if (plano === 'basic') {
            aplicarRestricoesBasic();
        }

        // Premium: badge de suporte
        if (plano === 'premium') {
            setTimeout(injetarBadgePremiumSupporte, 500);
        }
    }

    // Aguarda DOM e dados carregados
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800));
    } else {
        setTimeout(init, 800);
    }

    // Re-aplica quando dados do Firebase chegam (plano pode ter mudado)
    document.addEventListener('authon:dados-carregados', () => setTimeout(init, 300));

    // Expõe para uso externo
    window.Planos = { getPlano, getFeatures, mostrarUpgrade };

})();
