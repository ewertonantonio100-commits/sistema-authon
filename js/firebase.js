// ============================================================
// firebase.js — Auth, Firestore, Cloud Functions, Segurança
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    doc, updateDoc, onSnapshot, query, orderBy, where,
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged,
    signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── CONFIG ──
const firebaseConfig = {
    apiKey:            "AIzaSyBGmuAFUea7Mdbf8T_6phsNV-RfyUoHJ18",
    authDomain:        "sistema-authon-f7045.firebaseapp.com",
    projectId:         "sistema-authon-f7045",
    storageBucket:     "sistema-authon-f7045.firebasestorage.app",
    messagingSenderId: "113445333308",
    appId:             "1:113445333308:web:244a00fa15e5bc63ce9639"
};

// ── INICIALIZAÇÃO ──
const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);

// ── EXPÕE GLOBALMENTE (compatibilidade com código legado) ──
window.auth       = auth;
window.db         = db;
window.collection = collection;
window.addDoc     = addDoc;
window.getDocs    = getDocs;
window.deleteDoc  = deleteDoc;
window.doc        = doc;
window.updateDoc  = updateDoc;
window.onSnapshot = onSnapshot;
window.query      = query;
window.orderBy    = orderBy;
window.where      = where;


// ── CLOUD FUNCTION URLS ──
const CF = {
    enviarEmail:          'https://enviaremail-ndsydp7hna-uc.a.run.app',
    verificarAssinatura:  'https://verificarassinatura-ndsydp7hna-uc.a.run.app',
    mercadopagoWebhook:   'https://mercadopagowebhook-ndsydp7hna-uc.a.run.app',
};


// ── HELPERS CRUD ──
window.saveToCloud = async function (collectionName, data) {
    try {
        const user = auth.currentUser;
        if (!user) { Toast.error('Sessão expirada. Faça login novamente.'); return null; }
        const ref = await addDoc(collection(db, collectionName), {
            ...data, uid: user.uid, userEmail: user.email
        });
        return ref.id;
    } catch (e) {
        console.error('saveToCloud:', e);
        Toast.error('Erro ao salvar. Verifique sua conexão.');
        return null;
    }
};

window.updateInCloud = async function (collectionName, docId, data) {
    try {
        await updateDoc(doc(db, collectionName, docId), data);
        return true;
    } catch (e) {
        console.error('updateInCloud:', e);
        Toast.error('Erro ao atualizar registro.');
        return false;
    }
};

window.deleteFromCloud = async function (collectionName, docId) {
    return new Promise((resolve) => {
        Confirm('Tem certeza que deseja excluir?', async () => {
            try {
                await deleteDoc(doc(db, collectionName, docId));
                Toast.success('Item excluído com sucesso!');
                resolve(true);
            } catch (e) {
                console.error('deleteFromCloud:', e);
                Toast.error('Erro ao excluir. Tente novamente.');
                resolve(false);
            }
        }, () => resolve(false));
    });
};


// ── AUTH: LOGIN ──
window.doLogin = async function () {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    const msg   = document.getElementById('login-msg');

    if (!email || !pass) { msg.innerText = 'Preencha e-mail e senha.'; return; }

    const btn = document.querySelector('#login-screen .btn-action');
    if (btn) window.setLoading(btn, true, 'Verificando...');
    msg.innerText = '';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged cuida do redirecionamento
    } catch (e) {
        // Tenta login como funcionário antes de mostrar erro
        if (window.tentarLoginFuncionario) {
            try {
                const isFuncLogin = await window.tentarLoginFuncionario(email, pass);
                if (isFuncLogin) {
                    if (btn) window.setLoading(btn, false, 'ACESSAR SISTEMA');
                    // Esconde tela de login e mostra sistema
                    const loginScreen = document.getElementById('login-screen');
                    if (loginScreen) loginScreen.style.display = 'none';
                    const nav = document.querySelector('.bottom-nav');
                    if (nav) nav.style.display = 'flex';
                    setTimeout(() => {
                        window.aplicarRestricoesFuncionario?.();
                        window.showTab('new');
                    }, 300);
                    return;
                }
            } catch (funcErr) {
                console.error('[Funcionário] Erro:', funcErr);
            }
        }

        const msgs = {
            'auth/invalid-credential': 'E-mail ou senha incorretos.',
            'auth/wrong-password':     'E-mail ou senha incorretos.',
            'auth/user-not-found':     'E-mail não cadastrado.',
            'auth/too-many-requests':  'Muitas tentativas. Aguarde alguns minutos.',
            'auth/invalid-email':      'E-mail inválido.',
        };
        msg.innerText = msgs[e.code] || 'Erro ao entrar. Verifique seus dados.';
        if (btn) window.setLoading(btn, false, 'ACESSAR SISTEMA');
    }
};

window.forgotPassword = async function () {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
        Toast.warning('Digite seu e-mail no campo acima primeiro.');
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        Toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (e) {
        Toast.error('Não foi possível enviar o e-mail. Verifique o endereço.');
    }
};

window.logout = function () {
    Confirm('Deseja sair e bloquear o sistema?', async () => {
        await signOut(auth);
        location.reload();
    });
};

window.resetPassword = async function () {
    const user = auth.currentUser;
    if (!user) return;
    Confirm(`Enviar link de troca de senha para ${user.email}?`, async () => {
        try {
            await sendPasswordResetEmail(auth, user.email);
            Toast.success('E-mail enviado! Verifique sua caixa de entrada.');
        } catch (e) {
            Toast.error('Erro: ' + e.message);
        }
    });
};


// ── VERIFICAÇÃO DE ASSINATURA APÓS RETORNO DO MP ──
async function verificarAssinaturaAposRetorno(user) {
    try {
        const res = await fetch(CF.verificarAssinatura, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid })
        });
        const data = await res.json();
        if (data.ativa && data.primeiraAtivacao) {
            await enviarEmailBoasVindas(user.email, data.nome || '');
        }
    } catch (err) {
        console.error('Erro ao verificar assinatura:', err);
    }
}

async function enviarEmailBoasVindas(email, nome) {
    try {
        await fetch(CF.enviarEmail, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nome })
        });
    } catch (err) {
        console.error('Erro ao enviar e-mail:', err);
    }
}


// ── VERIFICAÇÃO DO MP (quando trial expira) ──
window.verificarAssinaturaMP = async function (email, docId) {
    try {
        const res = await fetch(CF.verificarAssinatura, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.ativa) {
            await updateDoc(doc(db, 'configuracoes', docId), {
                status: 'ativo',
                planoExpira: data.expira || ''
            });
        } else {
            window.mostrarTelaUpgrade(null, true);
        }
    } catch (err) {
        console.error('Erro ao verificar MP:', err);
    }
};


// ── VERIFICAÇÃO MANUAL ("Já pagou?") ──
window.verificarPagamentoManual = async function () {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('btn-verificar-pagamento');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        btn.style.pointerEvents = 'none';
    }

    await verificarAssinaturaAposRetorno(user);
    setTimeout(() => location.reload(), 1500);
};


// ── TELA PENDENTE ──
window.mostrarTelaPendente = function (plano, periodicidade) {
    const old = document.getElementById('pendente-overlay');
    if (old) old.remove();

    const MP_LINKS = {
        'basic-mensal':   'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=f47ea36711654ac7b021e0f4fb982b98',
        'pro-mensal':     'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=9db7664f39544635b106c3c8c698bfc9',
        'premium-mensal': 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=348e0997d98f4dc8abff550913835af5',
        'basic-anual':    'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=5f932fa5347f4d019b7439bccd9e4fb5',
        'pro-anual':      'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=ab697bfec3824c0bad8e4ebcb9590f5b',
        'premium-anual':  'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=b77880bd637a4f229e7ab29fbe55274e',
    };

    const link = MP_LINKS[`${plano}-${periodicidade}`] || 'https://sistemaauthon.com.br';
    const overlay = document.createElement('div');
    overlay.id = 'pendente-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:linear-gradient(160deg,#070f1a 0%,#0d1b2a 100%);
        display:flex;align-items:center;justify-content:center;padding:20px;
        font-family:'Poppins',sans-serif;
    `;
    overlay.innerHTML = `
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.08);
                    border-radius:24px;padding:40px 32px;max-width:440px;
                    width:100%;text-align:center;">
            <div style="font-size:52px;margin-bottom:16px;">⏳</div>
            <h2 style="font-family:'Oswald',sans-serif;font-size:26px;color:white;
                       text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                Finalize seu pagamento
            </h2>
            <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;margin-bottom:28px;">
                Sua conta foi criada! Para acessar o sistema, finalize a assinatura.<br><br>
                <strong style="color:#00b894;">Você terá 7 dias grátis</strong> após confirmar o cartão.
            </p>
            <a href="${link}" style="display:flex;align-items:center;justify-content:center;
               gap:10px;width:100%;padding:16px;background:#D92525;color:white;
               border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;
               letter-spacing:0.5px;box-shadow:0 8px 24px rgba(217,37,37,0.35);margin-bottom:12px;">
                <i class="fas fa-lock"></i> FINALIZAR PAGAMENTO
            </a>
            <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:12px 0;">
                Já pagou?
                <a id="btn-verificar-pagamento" style="color:#00b894;cursor:pointer;">
                    Clique aqui para verificar
                </a>
            </p>
            <button onclick="window.auth.signOut().then(()=>window.location.href='index.html')"
                style="background:transparent;border:1px solid rgba(255,255,255,0.1);
                       color:rgba(255,255,255,0.4);padding:12px;width:100%;
                       border-radius:10px;font-size:13px;font-weight:600;
                       font-family:'Poppins',sans-serif;cursor:pointer;margin-top:8px;">
                Sair da conta
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-verificar-pagamento')
        ?.addEventListener('click', () => window.verificarPagamentoManual());
};


// ── TELA DE UPGRADE / TRIAL EXPIRADO ──
window.mostrarTelaUpgrade = function (trialExpira, planoVencido = false) {
    const old = document.getElementById('upgrade-overlay');
    if (old) old.remove();

    const titulo    = planoVencido ? '⚠️ Seu plano venceu' : '🎉 Seu período de teste encerrou!';
    const subtitulo = planoVencido
        ? 'Renove agora para continuar usando o Authon e não perder nenhum dado.'
        : 'Você aproveitou 7 dias grátis. Assine agora para continuar com acesso completo.';

    const overlay = document.createElement('div');
    overlay.id = 'upgrade-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:linear-gradient(160deg,#070f1a 0%,#0d1b2a 100%);
        display:flex;align-items:center;justify-content:center;
        padding:20px;font-family:'Poppins',sans-serif;
    `;
    overlay.innerHTML = `
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.08);
                    border-radius:24px;padding:40px 32px;max-width:480px;
                    width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="font-size:52px;margin-bottom:16px;">🔒</div>
            <h2 style="font-family:'Oswald',sans-serif;font-size:28px;color:white;
                       text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                ${titulo}
            </h2>
            <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;margin-bottom:28px;">
                ${subtitulo}
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px;">
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                            border-radius:12px;padding:16px 10px;text-align:center;">
                    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);
                                text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Basic</div>
                    <div style="font-size:22px;font-weight:800;color:white;font-family:'Oswald',sans-serif;">R$67</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">/mês</div>
                </div>
                <div style="background:rgba(0,184,148,0.08);border:1px solid rgba(0,184,148,0.3);
                            border-radius:12px;padding:16px 10px;position:relative;text-align:center;">
                    <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
                                background:#00b894;color:white;font-size:8px;font-weight:700;
                                padding:3px 10px;border-radius:20px;white-space:nowrap;">⭐ POPULAR</div>
                    <div style="font-size:10px;font-weight:700;color:#00b894;
                                text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Pro</div>
                    <div style="font-size:22px;font-weight:800;color:white;font-family:'Oswald',sans-serif;">R$97</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">/mês</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                            border-radius:12px;padding:16px 10px;text-align:center;">
                    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);
                                text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Premium</div>
                    <div style="font-size:22px;font-weight:800;color:white;font-family:'Oswald',sans-serif;">R$147</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">/mês</div>
                </div>
            </div>
            <a href="https://sistemaauthon.com.br/#planos"
               style="display:block;width:100%;padding:16px;background:#D92525;color:white;
                      border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;
                      letter-spacing:0.5px;box-shadow:0 8px 24px rgba(217,37,37,0.35);margin-bottom:12px;">
                🚀 VER PLANOS E ASSINAR
            </a>
            <button onclick="window.auth.signOut().then(()=>window.location.href='index.html')"
                style="background:transparent;border:1px solid rgba(255,255,255,0.1);
                       color:rgba(255,255,255,0.4);padding:12px;width:100%;
                       border-radius:10px;font-size:13px;font-weight:600;
                       font-family:'Poppins',sans-serif;cursor:pointer;">
                Sair da conta
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
};


// ── EMAIL DO ADMINISTRADOR ──
const ADMIN_EMAIL = 'admin@authon.com';
window.ADMIN_EMAIL = ADMIN_EMAIL;

// ── CARREGAMENTO DO SISTEMA ──
function iniciarSistema() {
    const user = auth.currentUser;
    if (!user) return;

    // Operações
    const q = query(collection(db, 'operacoes'), where('uid', '==', user.uid), orderBy('id', 'desc'));
    onSnapshot(q, (snapshot) => {
        const dbLocal = [];
        snapshot.forEach((d) => dbLocal.push({ ...d.data(), docId: d.id }));
        localStorage.setItem('oficina_db_master', JSON.stringify(dbLocal));
        if (window.renderHistory)       window.renderHistory('all');
        if (window.renderAgenda)        window.renderAgenda();
        if (window.renderCRM)           window.renderCRM();
        // Dispara evento para outros módulos saberem que dados chegaram
        document.dispatchEvent(new Event('authon:dados-carregados'));
        if (window.updateDashboard)     window.updateDashboard();
        if (window.renderExpensesList)  window.renderExpensesList();
    });

    // Configurações
    const qConfig = query(collection(db, 'configuracoes'), where('uid', '==', user.uid));
    onSnapshot(qConfig, (snapshot) => {
        snapshot.forEach((docSnap) => {
            const cfg = docSnap.data();
            const hoje = new Date();

            // ── ADMIN: mostra botão e define plano ANTES de qualquer verificação ──
            if (user.email === ADMIN_EMAIL) {
                const btnAdmin = document.getElementById('btn-super-admin');
                if (btnAdmin) { btnAdmin.style.display = 'block'; console.log('[Admin] Botão exibido'); }
                localStorage.setItem('authon_plano', 'premium');
                localStorage.setItem('authon_status', 'admin');
            }

            // Bloqueio
            if (cfg.status === 'bloqueado' && user.email !== ADMIN_EMAIL) {
                Toast.error('Acesso suspenso. Entre em contato com o suporte.');
                setTimeout(() => window.auth.signOut().then(() => location.reload()), 3000);
                return;
            }

            // Status do plano
            if (cfg.status === 'admin') {
                // acesso total
            } else if (cfg.status === 'trial') {
                const criadoEm  = cfg.criadoEm ? new Date(cfg.criadoEm) : null;
                const diasTrial = criadoEm ? Math.floor((hoje - criadoEm) / 86400000) : 8;
                if (diasTrial >= 7) {
                    window.verificarAssinaturaMP(user.email, docSnap.id);
                    return;
                }
                window.showTrialBadge(7 - diasTrial);
            } else if (cfg.status === 'ativo') {
                if (cfg.planoExpira && new Date(cfg.planoExpira) < hoje && user.email !== ADMIN_EMAIL) {
                    window.verificarAssinaturaMP(user.email, docSnap.id);
                    return;
                }
            } else if (cfg.status === 'pendente') {
                window.mostrarTelaPendente(cfg.plano, cfg.periodicidade);
                return;
            }

            // Atualiza último acesso
            const todayStr = hoje.toLocaleDateString('en-CA');
            if (cfg.lastAccess !== todayStr) {
                updateDoc(doc(db, 'configuracoes', docSnap.id), {
                    lastAccess: todayStr,
                    email: user.email
                }).catch(() => {});
            }

            // Botão admin
            if (user.email === ADMIN_EMAIL) {
                const btnAdmin = document.getElementById('btn-super-admin');
                if (btnAdmin) btnAdmin.style.display = 'block';
            }

            // Salva localmente
            const fields = ['name','nomeOficina','plano','status','cnpj','addr','phone','team','pix','warranty','pin','logo'];
            const lsKeys = { name:'authon_cfg_name', nomeOficina:'authon_cfg_name', plano:'authon_plano',
                             status:'authon_status', cnpj:'authon_cfg_cnpj', addr:'authon_cfg_addr',
                             phone:'authon_cfg_phone', team:'authon_cfg_team', pix:'authon_cfg_pix',
                             warranty:'authon_cfg_warranty', pin:'authon_cfg_pin', logo:'oficina_logo' };
            fields.forEach(f => { if (cfg[f]) localStorage.setItem(lsKeys[f], cfg[f]); });

            const feeMap = { feeDeb:'authon_fee_deb', feeC1:'authon_fee_c1', feeC2:'authon_fee_c2',
                             feeC3:'authon_fee_c3', feeC4:'authon_fee_c4', feeC5:'authon_fee_c5', feeC6:'authon_fee_c6' };
            Object.entries(feeMap).forEach(([k,lk]) => localStorage.setItem(lk, cfg[k] || '0'));

            localStorage.setItem('authon_config_doc_id', docSnap.id);

            // Preenche campos de settings
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            setVal('cfgName', cfg.name);
            setVal('cfgCnpj', cfg.cnpj);
            setVal('cfgAddr', cfg.addr);
            setVal('cfgPhone', cfg.phone);
            setVal('cfgPix', cfg.pix);
            setVal('cfgWarranty', cfg.warranty);
            setVal('cfgPin', cfg.pin);
            setVal('cfgTeam', cfg.team);

            if (window.updateSellerSelect) window.updateSellerSelect();
        });
    });

    // Catálogo
    const qCat = query(collection(db, 'catalogo'), where('uid', '==', user.uid));
    onSnapshot(qCat, (snapshot) => {
        const catLocal = [];
        snapshot.forEach((d) => catLocal.push({ ...d.data(), docId: d.id }));
        localStorage.setItem('catalog_v1', JSON.stringify(catLocal));
        if (window.renderCatalogList) window.renderCatalogList();
        if (window.updateDatalist)    window.updateDatalist();

        if (snapshot.empty && localStorage.getItem('authon_onboarding_done') !== 'true') {
            if (window.injectStarterCatalog) window.injectStarterCatalog(user);
        } else if (!snapshot.empty) {
            localStorage.setItem('authon_onboarding_done', 'true');
        }
    });
}


// ── AUTH STATE OBSERVER ──
function mostrarToastSucesso() {
    Toast.success('Pagamento confirmado! Ativando sua conta...', 5000);
}

onAuthStateChanged(auth, async (user) => {
    const splash      = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const appNav      = document.querySelector('.bottom-nav');

    if (user) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('sucesso') === '1') {
            window.history.replaceState({}, '', 'app.html');
            mostrarToastSucesso();
            await new Promise(r => setTimeout(r, 3000));
            await verificarAssinaturaAposRetorno(user);
        }

        iniciarSistema();

        if (loginScreen) loginScreen.style.display = 'none';
        if (appNav)      appNav.style.display = 'flex';
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }

        // Inicia onboarding se for primeira vez
        setTimeout(() => { if (window.Onboarding) window.Onboarding.show(); }, 1200);

    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appNav)      appNav.style.display = 'none';
        if (splash)      splash.style.display = 'none';
    }
});

console.log('🚀 Authon Firebase iniciado!');
