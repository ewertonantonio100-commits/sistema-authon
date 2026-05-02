// ============================================================
// funcionarios.js — Sistema de Múltiplos Usuários Authon
// ============================================================

// ── VERIFICAR SE É FUNCIONÁRIO LOGADO ──
window.isFuncionario = function () {
    return localStorage.getItem('authon_is_funcionario') === 'true';
};

window.getFuncionarioLogado = function () {
    return JSON.parse(localStorage.getItem('authon_funcionario_atual') || 'null');
};

// ── LIMITES POR PLANO ──
window.getLimiteFuncionarios = function () {
    const plano = localStorage.getItem('authon_plano') || '';
    const email = window.auth?.currentUser?.email || '';

    // Admin sempre tem acesso ilimitado
    if (email === window.ADMIN_EMAIL) return 999;

    // Plano premium ou indefinido = ilimitado por padrão seguro
    if (plano === 'premium' || !plano || plano === 'undefined') return 999;
    if (plano === 'pro')     return 3;
    return 0; // basic não tem funcionários
};

// ── LOGIN DE FUNCIONÁRIO ──
// Busca funcionários pelo e-mail da oficina — sem precisar de autenticação Firebase
window.tentarLoginFuncionario = async function (email, senha) {
    try {
        // Busca funcionários pelo e-mail do dono (campo ownerEmail)
        const qF  = window.query(
            window.collection(window.db, 'funcionarios'),
            window.where('ownerEmail', '==', email),
            window.where('ativo', '!=', false)
        );
        const qFs = await window.getDocs(qF);

        if (qFs.empty) return false;

        let funcionarioEncontrado = null;
        let cfg = null;
        let docId = null;

        qFs.forEach(d => {
            const f = d.data();
            if (f.senha === btoa(senha)) {
                funcionarioEncontrado = { ...f, docId: d.id };
            }
        });

        if (!funcionarioEncontrado) return false;

        // Busca configurações do dono pelo ownerUid
        const qC  = window.query(
            window.collection(window.db, 'configuracoes'),
            window.where('uid', '==', funcionarioEncontrado.ownerUid)
        );
        const qCs = await window.getDocs(qC);
        if (qCs.empty) return false;
        cfg   = qCs.docs[0].data();
        docId = qCs.docs[0].id;

        // Salva sessão de funcionário
        localStorage.setItem('authon_is_funcionario', 'true');
        localStorage.setItem('authon_funcionario_atual', JSON.stringify(funcionarioEncontrado));
        localStorage.setItem('authon_owner_uid', cfg.uid);
        localStorage.setItem('authon_owner_doc_id', docId);

        // Copia configurações da oficina para o funcionário ver
        const lsKeys = { name:'authon_cfg_name', plano:'authon_plano', pix:'authon_cfg_pix', phone:'authon_cfg_phone' };
        Object.entries(lsKeys).forEach(([k, lk]) => { if (cfg[k]) localStorage.setItem(lk, cfg[k]); });

        // Salva catálogo
        const qCat  = window.query(window.collection(window.db, 'catalogo'), window.where('uid', '==', cfg.uid));
        const qCats = await window.getDocs(qCat);
        const catLocal = [];
        qCats.forEach(d => catLocal.push({ ...d.data(), docId: d.id }));
        localStorage.setItem('catalog_v1', JSON.stringify(catLocal));

        // Carrega operações DO FUNCIONÁRIO (só as dele)
        const qOp  = window.query(
            window.collection(window.db, 'operacoes'),
            window.where('uid', '==', cfg.uid),
            window.where('seller', '==', funcionarioEncontrado.nome)
        );
        const qOps = await window.getDocs(qOp);
        const ops = [];
        qOps.forEach(d => ops.push({ ...d.data(), docId: d.id }));
        localStorage.setItem('oficina_db_master', JSON.stringify(ops));

        // Registra último acesso do funcionário
        await window.updateDoc(window.doc(window.db, 'funcionarios', funcionarioEncontrado.docId), {
            lastAccess: new Date().toLocaleDateString('en-CA')
        });

        Toast.success('Bem-vindo, ' + funcionarioEncontrado.nome + '! 👋');
        return true;

    } catch (e) {
        console.error('[Funcionário] Erro no login:', e);
        return false;
    }
};


// ── APLICAR RESTRIÇÕES DE FUNCIONÁRIO ──
window.aplicarRestricoesFuncionario = function () {
    if (!window.isFuncionario()) return;

    const func = window.getFuncionarioLogado();
    if (!func) return;

    // Mostra badge do funcionário
    const brandHeader = document.querySelector('.brand-header');
    if (brandHeader) {
        const badge = document.createElement('div');
        badge.style.cssText = 'margin-left:auto;background:rgba(231,76,60,0.2);border:1px solid rgba(231,76,60,0.4);border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:#e74c3c;white-space:nowrap;';
        badge.innerHTML = '👤 ' + func.nome;
        brandHeader.appendChild(badge);
    }

    // Bloqueia abas restritas
    const abasRestritas = ['dashboard', 'expenses', 'crm', 'settings'];
    abasRestritas.forEach(aba => {
        const navItem = document.querySelector(`.nav-item[onclick*="'${aba}'"]`);
        if (navItem) {
            navItem.style.opacity = '0.3';
            navItem.style.pointerEvents = 'none';
        }
    });

    // Remove aba CONFIG do nav
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.textContent.includes('CONFIG')) {
            item.style.display = 'none';
        }
    });

    // No histórico, remove botões de editar e excluir
    // (aplicado via CSS global)
    const style = document.createElement('style');
    style.textContent = `
        /* Funcionário não pode editar/excluir */
        .func-mode .btn-card[onclick*="loadToEdit"],
        .func-mode .btn-card[onclick*="deleteItem"],
        .func-mode .btn-card[onclick*="delCatalog"] {
            display: none !important;
        }
        /* Funcionário não pode editar/excluir despesas */
        .func-mode #tab-expenses .btn-card[onclick*="delete"],
        .func-mode #tab-expenses button[onclick*="markExpensePaid"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add('func-mode');

    // Sobrescreve renderHistory para mostrar só do funcionário
    const _origRender = window.renderHistory;
    window.renderHistory = function (filter) {
        // Funcionário só vê os dele
        const db = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
        localStorage.setItem('_func_db_backup', JSON.stringify(db));
        // já está filtrado pelo login — apenas renderiza normalmente
        if (_origRender) _origRender(filter);
    };

    console.log('[Funcionário] Restrições aplicadas para:', func.nome);
};


// ── LOGOUT DE FUNCIONÁRIO ──
window.logoutFuncionario = function () {
    localStorage.removeItem('authon_is_funcionario');
    localStorage.removeItem('authon_funcionario_atual');
    localStorage.removeItem('authon_owner_uid');
    localStorage.removeItem('authon_owner_doc_id');
    localStorage.removeItem('oficina_db_master');
    location.reload();
};


// ── GERENCIAR FUNCIONÁRIOS (tela de settings) ──
window.renderFuncionariosList = async function () {
    const container = document.getElementById('funcionarios-list');
    if (!container) return;

    const user    = window.auth?.currentUser;
    const plano   = localStorage.getItem('authon_plano') || 'basic';
    const limite  = window.getLimiteFuncionarios();

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
        if (!user?.uid) {
            container.innerHTML = '<div style="color:#e74c3c;padding:12px;font-size:12px;">Usuário não autenticado.</div>';
            return;
        }

        const q  = window.query(
            window.collection(window.db, 'funcionarios'),
            window.where('ownerUid', '==', user.uid)
        );
        const qs = await window.getDocs(q);

        const funcs = [];
        qs.forEach(d => funcs.push({ ...d.data(), docId: d.id }));

        const limiteLabel = limite === 999 ? 'Ilimitados' : limite;
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-size:11px;color:#95a5a6;font-weight:700;">
                    ${funcs.length}/${limiteLabel === 'Ilimitados' ? '∞' : limite} funcionários
                </span>
                ${funcs.length < limite ? `
                <button onclick="window.abrirModalNovoFuncionario()"
                    style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;border:none;
                           border-radius:10px;padding:7px 14px;font-size:11px;font-weight:700;
                           font-family:'Poppins',sans-serif;cursor:pointer;">
                    + Adicionar
                </button>` : `
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
        console.error('[Funcionários] Erro:', e.code, e.message);
        if (e.code === 'permission-denied') {
            container.innerHTML = `<div style="background:#fff0f0;border:1px solid #ffd5d5;border-radius:12px;padding:14px;font-size:12px;color:#c0392b;">
                🔒 Permissão negada no Firestore.<br><br>
                <strong>Solução:</strong> Adicione esta regra no Firebase Console → Firestore → Regras:<br><br>
                <code style="background:#f5f5f5;padding:4px 8px;border-radius:6px;font-size:11px;display:block;margin-top:6px;">
                match /funcionarios/{id} {<br>
                &nbsp;&nbsp;allow read, write: if request.auth != null;<br>
                }
                </code>
            </div>`;
        } else {
            container.innerHTML = '<div style="color:#e74c3c;padding:12px;font-size:12px;">Erro: ' + (e.message || e.code || 'desconhecido') + '</div>';
        }
    }
};


// ── MODAL NOVO FUNCIONÁRIO ──
window.abrirModalNovoFuncionario = function () {
    const modal = document.createElement('div');
    modal.id    = 'modal-novo-func';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,sans-serif;';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;">
            <h3 style="font-family:Oswald,sans-serif;font-size:18px;color:#1e272e;margin-bottom:4px;letter-spacing:0.5px;">
                👤 Novo Funcionário
            </h3>
            <p style="font-size:12px;color:#95a5a6;margin-bottom:20px;">
                O funcionário vai logar com o e-mail da oficina e a senha que você definir.
            </p>
            <label style="font-size:10px;font-weight:700;color:#95a5a6;text-transform:uppercase;letter-spacing:1px;">Nome</label>
            <input id="func-nome" type="text" placeholder="Ex: João Mecânico"
                style="width:100%;padding:11px 13px;border:1.5px solid #ecf0f1;border-radius:12px;
                       font-size:13px;margin:6px 0 16px;box-sizing:border-box;font-family:Poppins,sans-serif;">
            <label style="font-size:10px;font-weight:700;color:#95a5a6;text-transform:uppercase;letter-spacing:1px;">Senha</label>
            <input id="func-senha" type="password" placeholder="Mínimo 4 caracteres"
                style="width:100%;padding:11px 13px;border:1.5px solid #ecf0f1;border-radius:12px;
                       font-size:13px;margin:6px 0 20px;box-sizing:border-box;font-family:Poppins,sans-serif;">
            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('modal-novo-func').remove()"
                    style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ecf0f1;
                           background:white;color:#95a5a6;font-family:Poppins,sans-serif;
                           font-size:13px;font-weight:700;cursor:pointer;">
                    Cancelar
                </button>
                <button onclick="window.salvarNovoFuncionario()"
                    style="flex:1;padding:12px;border-radius:12px;border:none;
                           background:linear-gradient(135deg,#e74c3c,#c0392b);color:white;
                           font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
                    Cadastrar
                </button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('func-nome')?.focus(), 100);
};


// ── SALVAR NOVO FUNCIONÁRIO ──
window.salvarNovoFuncionario = async function () {
    const nome  = document.getElementById('func-nome')?.value?.trim();
    const senha = document.getElementById('func-senha')?.value;

    if (!nome)         { Toast.warning('Digite o nome do funcionário.'); return; }
    if (!senha || senha.length < 4) { Toast.warning('Senha deve ter pelo menos 4 caracteres.'); return; }

    const user   = window.auth?.currentUser;
    const limite = window.getLimiteFuncionarios();

    // Verifica limite
    const q  = window.query(window.collection(window.db, 'funcionarios'), window.where('ownerUid', '==', user.uid));
    const qs = await window.getDocs(q);
    if (qs.size >= limite) {
        Toast.error('Limite de funcionários do seu plano atingido.');
        return;
    }

    // Verifica nome duplicado
    let duplicado = false;
    qs.forEach(d => { if (d.data().nome === nome) duplicado = true; });
    if (duplicado) { Toast.error('Já existe um funcionário com esse nome.'); return; }

    try {
        await window.addDoc(window.collection(window.db, 'funcionarios'), {
            ownerUid:   user.uid,
            ownerEmail: user.email,
            nome,
            senha:      btoa(senha), // encode base64 básico
            ativo:      true,
            criadoEm:   new Date().toLocaleDateString('en-CA'),
            lastAccess: null,
        });

        document.getElementById('modal-novo-func')?.remove();
        Toast.success(nome + ' cadastrado com sucesso!');
        window.renderFuncionariosList();

        // Atualiza select de vendedor no form de nova operação
        const team = localStorage.getItem('authon_cfg_team') || '';
        const names = team.split(',').map(s => s.trim()).filter(Boolean);
        if (!names.includes(nome)) {
            const newTeam = [...names, nome].join(', ');
            localStorage.setItem('authon_cfg_team', newTeam);
            window.updateSellerSelect?.();
        }

    } catch (e) {
        console.error(e);
        Toast.error('Erro ao cadastrar. Tente novamente.');
    }
};


// ── ATIVAR/DESATIVAR FUNCIONÁRIO ──
window.toggleFuncionario = async function (docId, novoEstado) {
    Confirm(
        novoEstado ? 'Reativar este funcionário?' : 'Desativar acesso deste funcionário?',
        async () => {
            try {
                await window.updateDoc(window.doc(window.db, 'funcionarios', docId), { ativo: novoEstado });
                Toast.success(novoEstado ? 'Funcionário reativado!' : 'Acesso desativado.');
                window.renderFuncionariosList();
            } catch (e) { Toast.error('Erro ao atualizar.'); }
        }
    );
};


// ── REMOVER FUNCIONÁRIO ──
window.removerFuncionario = async function (docId, nome) {
    Confirm(
        'Remover <strong>' + nome + '</strong> permanentemente?',
        async () => {
            try {
                await window.deleteDoc(window.doc(window.db, 'funcionarios', docId));
                Toast.success(nome + ' removido.');
                window.renderFuncionariosList();
            } catch (e) { Toast.error('Erro ao remover.'); }
        }
    );
};


console.log('👥 Módulo de funcionários carregado');
