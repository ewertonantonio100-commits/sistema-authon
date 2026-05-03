// ============================================================
// funcionarios.js — Sistema de Múltiplos Usuários Authon
// ============================================================

window.isFuncionario = function () {
    return localStorage.getItem('authon_is_funcionario') === 'true';
};

window.getFuncionarioLogado = function () {
    return JSON.parse(localStorage.getItem('authon_funcionario_atual') || 'null');
};

window.getLimiteFuncionarios = function () {
    const email = window.auth?.currentUser?.email || '';
    if (email === 'admin@authon.com') return 999;
    const plano = localStorage.getItem('authon_plano') || '';
    if (plano === 'premium') return 999;
    if (plano === 'pro')     return 3;
    return 0;
};

// ── APLICAR RESTRIÇÕES MÍNIMAS ──
window.aplicarRestricoesFuncionario = function () {
    if (!window.isFuncionario()) return;
    const func = window.getFuncionarioLogado();
    if (!func) return;

    // 1. Badge com nome + botão SAIR no header
    const header = document.querySelector('.brand-header');
    if (header && !document.getElementById('func-logout-btn')) {
        const badge = document.createElement('div');
        badge.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;';
        badge.innerHTML = `
            <span style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.4);
                         border-radius:20px;padding:4px 10px;font-size:10px;font-weight:700;color:#e74c3c;">
                👤 ${func.nome}
            </span>
            <button id="func-logout-btn" onclick="window.logoutFuncionario()"
                style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.4);
                       border-radius:20px;padding:4px 10px;font-size:10px;font-weight:700;
                       color:#e74c3c;cursor:pointer;font-family:Poppins,sans-serif;">
                <i class="fas fa-sign-out-alt"></i> Sair
            </button>`;
        header.appendChild(badge);
    }

    // 2. CSS: esconde editar/excluir mas mantém tudo mais acessível
    if (!document.getElementById('func-mode-css')) {
        const style = document.createElement('style');
        style.id = 'func-mode-css';
        style.textContent = `
            /* Esconde editar e excluir no histórico */
            button[onclick*="loadToEdit"] { display:none !important; }
            button[onclick*="deleteItem"] { display:none !important; }
            button[onclick*="delItem"]    { display:none !important; }

            /* Esconde editar e excluir no estoque */
            button[onclick*="delCatalog"]  { display:none !important; }
            button[onclick*="editCatalog"] { display:none !important; }

            /* Esconde excluir na agenda */
            button[onclick*="deleteAgenda"] { display:none !important; }
            button[onclick*="delAgenda"]    { display:none !important; }
        `;
        document.head.appendChild(style);
    }

    console.log('[Funcionário] Ativo:', func.nome);
};

// ── LOGOUT ──
window.logoutFuncionario = function () {
    if (confirm('Deseja sair do sistema?')) {
        localStorage.removeItem('authon_is_funcionario');
        localStorage.removeItem('authon_funcionario_atual');
        localStorage.removeItem('authon_owner_uid');
        localStorage.removeItem('authon_owner_email');
        localStorage.removeItem('oficina_db_master');
        localStorage.removeItem('catalog_v1');
        location.reload();
    }
};

// ── GERENCIAR FUNCIONÁRIOS (CONFIG) ──
window.renderFuncionariosList = async function () {
    const container = document.getElementById('funcionarios-list');
    if (!container) return;

    const user   = window.auth?.currentUser;
    const limite = window.getLimiteFuncionarios();

    if (limite === 0) {
        container.innerHTML = `
            <div style="background:#fff8e8;border:1px solid #fde8b0;border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:13px;font-weight:700;color:#f39c12;margin-bottom:6px;">⚠️ Plano Basic não inclui funcionários</div>
                <div style="font-size:12px;color:#636e72;">Faça upgrade para o Plano Pro e adicione até 3 funcionários.</div>
            </div>`;
        return;
    }

    container.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        if (!user?.uid) { container.innerHTML = '<div style="color:#e74c3c;padding:12px;font-size:12px;">Faça login primeiro.</div>'; return; }

        const q  = window.query(window.collection(window.db, 'funcionarios'), window.where('ownerUid', '==', user.uid));
        const qs = await window.getDocs(q);

        const funcs = [];
        qs.forEach(d => funcs.push({ ...d.data(), docId: d.id }));

        const limiteLabel = limite === 999 ? '∞' : limite;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-size:11px;color:#95a5a6;font-weight:700;">${funcs.length}/${limiteLabel} funcionários</span>
                ${funcs.length < limite ? `
                <button onclick="window.abrirModalNovoFuncionario()"
                    style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;border:none;
                           border-radius:10px;padding:7px 14px;font-size:11px;font-weight:700;
                           font-family:'Poppins',sans-serif;cursor:pointer;">+ Adicionar</button>` : `
                <span style="font-size:10px;color:#e74c3c;font-weight:700;">Limite atingido</span>`}
            </div>`;

        if (!funcs.length) {
            container.innerHTML += `
                <div style="background:#f5f6fa;border-radius:12px;padding:20px;text-align:center;color:#b2bec3;">
                    <i class="fas fa-users" style="font-size:28px;margin-bottom:8px;display:block;"></i>
                    <div style="font-size:13px;font-weight:600;">Nenhum funcionário cadastrado</div>
                    <div style="font-size:11px;margin-top:4px;">Clique em "Adicionar" para começar</div>
                </div>`;
            return;
        }

        funcs.forEach(f => {
            const ativo = f.ativo !== false;
            container.innerHTML += `
            <div style="background:white;border-radius:14px;padding:14px 16px;margin-bottom:8px;
                        box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:3px solid ${ativo ? '#00b894' : '#bdc3c7'};">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:14px;font-weight:700;color:#1e272e;">${f.nome}</div>
                        <div style="font-size:11px;color:#95a5a6;margin-top:2px;">
                            Último acesso: ${f.lastAccess ? f.lastAccess.split('-').reverse().join('/') : 'Nunca'}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <span style="background:${ativo ? '#e8faf4' : '#f5f6fa'};color:${ativo ? '#00b894' : '#bdc3c7'};
                                     font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;">
                            ${ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
                        <button onclick="window.toggleFuncionario('${f.docId}', ${!ativo})"
                            style="width:32px;height:32px;border-radius:8px;border:none;
                                   background:${ativo ? '#fef0ee' : '#e8faf4'};
                                   color:${ativo ? '#e74c3c' : '#00b894'};cursor:pointer;font-size:13px;">
                            <i class="fas fa-${ativo ? 'ban' : 'check'}"></i>
                        </button>
                        <button onclick="window.removerFuncionario('${f.docId}', '${f.nome}')"
                            style="width:32px;height:32px;border-radius:8px;border:none;
                                   background:#fef0ee;color:#e74c3c;cursor:pointer;font-size:13px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        });

    } catch (e) {
        console.error(e);
        if (e.code === 'permission-denied') {
            container.innerHTML = '<div style="color:#e74c3c;padding:12px;font-size:12px;">🔒 Sem permissão. Verifique as regras do Firestore.</div>';
        } else {
            container.innerHTML = '<div style="color:#e74c3c;padding:12px;font-size:12px;">Erro: ' + (e.message || e.code) + '</div>';
        }
    }
};

window.abrirModalNovoFuncionario = function () {
    const modal = document.createElement('div');
    modal.id    = 'modal-novo-func';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,sans-serif;';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;">
            <h3 style="font-family:Oswald,sans-serif;font-size:18px;color:#1e272e;margin-bottom:4px;">👤 Novo Funcionário</h3>
            <p style="font-size:12px;color:#95a5a6;margin-bottom:20px;">Login: e-mail da oficina + senha que você definir.</p>
            <label style="font-size:10px;font-weight:700;color:#95a5a6;text-transform:uppercase;letter-spacing:1px;">Nome</label>
            <input id="func-nome" type="text" placeholder="Ex: João Mecânico"
                style="width:100%;padding:11px 13px;border:1.5px solid #ecf0f1;border-radius:12px;font-size:13px;margin:6px 0 16px;box-sizing:border-box;font-family:Poppins,sans-serif;">
            <label style="font-size:10px;font-weight:700;color:#95a5a6;text-transform:uppercase;letter-spacing:1px;">Senha</label>
            <input id="func-senha" type="password" placeholder="Mínimo 4 caracteres"
                style="width:100%;padding:11px 13px;border:1.5px solid #ecf0f1;border-radius:12px;font-size:13px;margin:6px 0 20px;box-sizing:border-box;font-family:Poppins,sans-serif;">
            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('modal-novo-func').remove()"
                    style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ecf0f1;background:white;color:#95a5a6;font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
                    Cancelar
                </button>
                <button onclick="window.salvarNovoFuncionario()"
                    style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
                    Cadastrar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('func-nome')?.focus(), 100);
};

window.salvarNovoFuncionario = async function () {
    const nome  = document.getElementById('func-nome')?.value?.trim();
    const senha = document.getElementById('func-senha')?.value;
    if (!nome)               { Toast.warning('Digite o nome do funcionário.'); return; }
    if (!senha || senha.length < 4) { Toast.warning('Senha deve ter pelo menos 4 caracteres.'); return; }

    const user   = window.auth?.currentUser;
    const limite = window.getLimiteFuncionarios();
    const q      = window.query(window.collection(window.db, 'funcionarios'), window.where('ownerUid', '==', user.uid));
    const qs     = await window.getDocs(q);
    if (qs.size >= limite) { Toast.error('Limite de funcionários atingido.'); return; }

    let duplicado = false;
    qs.forEach(d => { if (d.data().nome === nome) duplicado = true; });
    if (duplicado) { Toast.error('Já existe um funcionário com esse nome.'); return; }

    try {
        await window.addDoc(window.collection(window.db, 'funcionarios'), {
            ownerUid:   user.uid,
            ownerEmail: user.email,
            nome,
            senha,   // texto puro
            ativo:   true,
            criadoEm: new Date().toLocaleDateString('en-CA'),
            lastAccess: null,
        });
        document.getElementById('modal-novo-func')?.remove();
        Toast.success(nome + ' cadastrado!');
        window.renderFuncionariosList();
    } catch (e) {
        Toast.error('Erro ao cadastrar: ' + e.message);
    }
};

window.toggleFuncionario = async function (docId, novoEstado) {
    Confirm(novoEstado ? 'Reativar funcionário?' : 'Desativar acesso?', async () => {
        try {
            await window.updateDoc(window.doc(window.db, 'funcionarios', docId), { ativo: novoEstado });
            Toast.success(novoEstado ? 'Reativado!' : 'Desativado.');
            window.renderFuncionariosList();
        } catch (e) { Toast.error('Erro ao atualizar.'); }
    });
};

window.removerFuncionario = async function (docId, nome) {
    Confirm('Remover <strong>' + nome + '</strong>?', async () => {
        try {
            await window.deleteDoc(window.doc(window.db, 'funcionarios', docId));
            Toast.success(nome + ' removido.');
            window.renderFuncionariosList();
        } catch (e) { Toast.error('Erro ao remover.'); }
    });
};

console.log('👥 funcionarios.js carregado');
