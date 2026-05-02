// ============================================================
// configuracoes.js — Settings, Admin, Modo Funcionário
// ============================================================

// ── SALVAR CONFIGURAÇÕES ──
window.saveSettingsCustom = async function () {
    const user = window.auth?.currentUser;
    if (!user) { Toast.error('Login não detectado. Recarregue a página.'); return; }

    const btn = document.getElementById('btn-save-settings');
    window.setLoading(btn, true, 'Sincronizando...');

    const fees = ['Deb','C1','C2','C3','C4','C5','C6'].reduce((acc, k) => {
        acc[`fee${k}`] = document.getElementById(`fee${k}`)?.value || '0';
        return acc;
    }, {});

    const cfgData = {
        uid:      user.uid,
        name:     document.getElementById('cfgName')?.value     || '',
        cnpj:     document.getElementById('cfgCnpj')?.value     || '',
        addr:     document.getElementById('cfgAddr')?.value     || '',
        phone:    document.getElementById('cfgPhone')?.value    || '',
        team:     document.getElementById('cfgTeam')?.value     || '',
        pix:      document.getElementById('cfgPix')?.value      || '',
        warranty: document.getElementById('cfgWarranty')?.value || '',
        pin:      document.getElementById('cfgPin')?.value      || '',
        logo:     localStorage.getItem('oficina_logo') || '',
        ...fees,
    };

    // Salva local imediatamente
    Object.entries({
        authon_cfg_name:     cfgData.name,
        authon_cfg_cnpj:     cfgData.cnpj,
        authon_cfg_addr:     cfgData.addr,
        authon_cfg_phone:    cfgData.phone,
        authon_cfg_pix:      cfgData.pix,
        authon_cfg_warranty: cfgData.warranty,
        authon_cfg_pin:      cfgData.pin,
        authon_cfg_team:     cfgData.team,
        authon_fee_deb: fees.feeDeb,
        authon_fee_c1:  fees.feeC1,
        authon_fee_c2:  fees.feeC2,
        authon_fee_c3:  fees.feeC3,
        authon_fee_c4:  fees.feeC4,
        authon_fee_c5:  fees.feeC5,
        authon_fee_c6:  fees.feeC6,
    }).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); });

    try {
        const q  = window.query(window.collection(window.db, 'configuracoes'), window.where('uid', '==', user.uid));
        const qs = await window.getDocs(q);

        if (!qs.empty) {
            const cloudDocId = qs.docs[0].id;
            await window.updateDoc(window.doc(window.db, 'configuracoes', cloudDocId), cfgData);
            localStorage.setItem('authon_config_doc_id', cloudDocId);
        } else {
            const newDoc = await window.addDoc(window.collection(window.db, 'configuracoes'), cfgData);
            localStorage.setItem('authon_config_doc_id', newDoc.id);
        }

        Toast.success('Dados salvos e sincronizados em todos os aparelhos!');
    } catch (e) {
        console.error('Erro config:', e);
        Toast.warning('Salvo no celular. Sincronizaremos quando houver internet.');
    }

    window.setLoading(btn, false, 'SALVAR DADOS');
};


// ── SEÇÕES EM SANFONA ──
window.toggleSettingsSection = function (id) {
    document.querySelectorAll('.settings-content').forEach(el => {
        if (el.id !== id) el.style.display = 'none';
    });
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};


// ── MODO FUNCIONÁRIO ──
window.activateEmployeeMode = function () {
    localStorage.setItem('authon_mode_locked', 'true');
    document.body.classList.add('employee-mode');
    const unlockBtn = document.getElementById('unlock-btn');
    if (unlockBtn) unlockBtn.style.display = 'flex';
    Toast.info('Modo funcionário ativado. Configurações bloqueadas.');
};

window.deactivateEmployeeMode = function () {
    const pin = localStorage.getItem('authon_cfg_pin');
    if (pin) {
        const input = prompt('Digite o PIN do proprietário para desbloquear:');
        if (input !== pin) { Toast.error('PIN incorreto.'); return; }
    }
    localStorage.setItem('authon_mode_locked', 'false');
    document.body.classList.remove('employee-mode');
    const unlockBtn = document.getElementById('unlock-btn');
    if (unlockBtn) unlockBtn.style.display = 'none';
    Toast.success('Sistema desbloqueado!');
};


// ── SELECT DE VENDEDOR ──
window.updateSellerSelect = function () {
    const teamStr = localStorage.getItem('authon_cfg_team') || '';
    const select  = document.getElementById('sellerName');
    if (!select) return;
    const members = teamStr.split(',').map(s => s.trim()).filter(Boolean);
    select.innerHTML = '<option value="">— Selecionar —</option>';
    members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = m;
        select.appendChild(opt);
    });
};


// ── PAINEL SUPER ADMIN ──
window.openSuperAdmin = async function () {
    const user = window.auth?.currentUser;
    if (!user || user.email !== window.ADMIN_EMAIL) return;

    const modal = document.getElementById('modal-super-admin') || _createAdminModal();
    modal.style.display = 'flex';

    modal.querySelector('#admin-body').innerHTML =
        '<div style="text-align:center;padding:40px;color:#95a5a6;"><i class="fas fa-spinner fa-spin" style="font-size:24px;"></i></div>';

    try {
        const qs = await window.getDocs(window.collection(window.db, 'configuracoes'));
        const clientes = [];
        qs.forEach(d => clientes.push({ id: d.id, ...d.data() }));
        _renderAdminCards(clientes, modal);
    } catch (e) {
        modal.querySelector('#admin-body').innerHTML =
            '<p style="color:#e74c3c;padding:20px;">Erro ao carregar dados.</p>';
    }
};

function _createAdminModal() {
    const modal = document.createElement('div');
    modal.id = 'modal-super-admin';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);
        backdrop-filter:blur(6px);display:none;flex-direction:column;
        font-family:'Poppins',sans-serif;overflow-y:auto;
    `;
    modal.innerHTML = `
        <div style="background:#0d1b2a;min-height:100%;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2 style="color:white;font-family:'Oswald',sans-serif;font-size:22px;letter-spacing:1px;">
                    🛡️ PAINEL ADMIN
                </h2>
                <button onclick="document.getElementById('modal-super-admin').style.display='none'"
                    style="background:rgba(255,255,255,0.1);border:none;color:white;
                           padding:8px 16px;border-radius:8px;font-family:'Poppins',sans-serif;
                           font-size:13px;cursor:pointer;">
                    ✕ Fechar
                </button>
            </div>
            <input id="admin-search" placeholder="🔍 Buscar por nome, e-mail ou plano..."
                style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);
                       background:rgba(255,255,255,0.07);color:white;font-family:'Poppins',sans-serif;
                       font-size:13px;margin-bottom:16px;box-sizing:border-box;"
                oninput="window._adminFilter(this.value)">
            <div id="admin-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;"></div>
            <div id="admin-body"></div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function _renderAdminCards(clientes, modal) {
    window._adminAllClients = clientes;

    // Stats
    const total  = clientes.length;
    const ativos = clientes.filter(c => c.status === 'ativo').length;
    const trial  = clientes.filter(c => c.status === 'trial').length;

    const statsEl = modal.querySelector('#admin-stats');
    statsEl.innerHTML = `
        <div style="background:rgba(0,184,148,0.1);border:1px solid rgba(0,184,148,0.2);
                    border-radius:14px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#00b894;">${total}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Total</div>
        </div>
        <div style="background:rgba(9,132,227,0.1);border:1px solid rgba(9,132,227,0.2);
                    border-radius:14px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#0984e3;">${ativos}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Ativos</div>
        </div>
        <div style="background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.2);
                    border-radius:14px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#f39c12;">${trial}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Trial</div>
        </div>
    `;

    _renderAdminList(clientes, modal);
}

function _renderAdminList(clientes, modal) {
    const body = (modal || document.getElementById('modal-super-admin')).querySelector('#admin-body');
    if (!clientes.length) {
        body.innerHTML = '<p style="color:#95a5a6;text-align:center;padding:40px;">Nenhum resultado.</p>';
        return;
    }

    const statusColor = { ativo:'#00b894', trial:'#f39c12', pendente:'#e67e22',
                          bloqueado:'#e74c3c', admin:'#6c5ce7' };

    body.innerHTML = clientes.map(c => `
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.07);
                    border-radius:16px;padding:18px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                    <div style="font-weight:700;color:white;font-size:15px;">
                        ${c.nomeOficina || c.name || 'Sem nome'}
                    </div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:3px;">
                        ${c.email || '—'} · ${c.plano || '—'}
                    </div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px;">
                        Último acesso: ${c.lastAccess || 'nunca'}
                    </div>
                </div>
                <span style="background:${statusColor[c.status]||'#7f8c8d'}22;
                             color:${statusColor[c.status]||'#7f8c8d'};
                             padding:4px 12px;border-radius:20px;font-size:10px;
                             font-weight:700;text-transform:uppercase;letter-spacing:1px;
                             white-space:nowrap;">
                    ${c.status || 'desconhecido'}
                </span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${c.status !== 'bloqueado' ? `
                <button onclick="window.adminSetStatus('${c.id}','bloqueado')"
                    style="flex:1;padding:8px;border-radius:10px;border:1px solid rgba(231,76,60,0.3);
                           background:rgba(231,76,60,0.08);color:#e74c3c;font-family:'Poppins',sans-serif;
                           font-size:11px;font-weight:700;cursor:pointer;">
                    🔒 Bloquear
                </button>` : `
                <button onclick="window.adminSetStatus('${c.id}','ativo')"
                    style="flex:1;padding:8px;border-radius:10px;border:1px solid rgba(0,184,148,0.3);
                           background:rgba(0,184,148,0.08);color:#00b894;font-family:'Poppins',sans-serif;
                           font-size:11px;font-weight:700;cursor:pointer;">
                    ✅ Liberar
                </button>`}
                <button onclick="window.adminExtendPlan('${c.id}','${c.plano||'pro'}')"
                    style="flex:1;padding:8px;border-radius:10px;border:1px solid rgba(9,132,227,0.3);
                           background:rgba(9,132,227,0.08);color:#0984e3;font-family:'Poppins',sans-serif;
                           font-size:11px;font-weight:700;cursor:pointer;">
                    📅 Renovar
                </button>
            </div>
        </div>
    `).join('');
}

window._adminFilter = function (term) {
    const all = window._adminAllClients || [];
    const t   = term.toLowerCase();
    const filtered = t
        ? all.filter(c =>
            (c.nomeOficina||'').toLowerCase().includes(t) ||
            (c.email||'').toLowerCase().includes(t) ||
            (c.plano||'').toLowerCase().includes(t) ||
            (c.status||'').toLowerCase().includes(t))
        : all;
    _renderAdminList(filtered);
};

window.adminSetStatus = async function (docId, newStatus) {
    const acao = newStatus === 'bloqueado' ? 'BLOQUEAR' : 'LIBERAR';
    Confirm(`Tem certeza que deseja ${acao} esta oficina?`, async () => {
        await window.updateDoc(window.doc(window.db, 'configuracoes', docId), { status: newStatus });
        Toast.success(`Oficina ${acao === 'BLOQUEAR' ? 'bloqueada' : 'liberada'} com sucesso!`);
        window.openSuperAdmin();
    });
};

window.adminExtendPlan = async function (docId, plano) {
    const meses = prompt('Renovar por quantos meses?', '1');
    if (!meses || isNaN(meses)) return;
    const hoje = new Date();
    hoje.setMonth(hoje.getMonth() + parseInt(meses));
    const novaData = hoje.toLocaleDateString('en-CA');
    await window.updateDoc(window.doc(window.db, 'configuracoes', docId), {
        status: 'ativo',
        plano,
        planoExpira: novaData
    });
    Toast.success(`Plano renovado até ${novaData.split('-').reverse().join('/')}!`);
    window.openSuperAdmin();
};

window.toggleBlockClient = window.adminSetStatus;



// ══════════════════════════════════════════════════════
// BACKUP & RESTAURAÇÃO
// ══════════════════════════════════════════════════════

window.exportarBackup = async function () {
    const plano = localStorage.getItem('authon_plano') || 'basic';

    // Verifica plano — backup disponível para Pro e Premium
    if (plano === 'basic') {
        // Mostra lock
        const lock = document.getElementById('backup-premium-lock');
        if (lock) lock.style.display = 'block';
        Toast.warning('Backup disponível nos planos Pro e Premium.');
        return;
    }

    try {
        Toast.info('Preparando backup...', 2000);

        const user = window.auth?.currentUser;

        // Coleta todos os dados
        const backup = {
            versao:    '2.0',
            geradoEm:  new Date().toISOString(),
            oficina:   localStorage.getItem('authon_cfg_name') || '',
            email:     user?.email || '',
            operacoes: JSON.parse(localStorage.getItem('oficina_db_master') || '[]'),
            catalogo:  JSON.parse(localStorage.getItem('catalog_v1') || '[]'),
            config: {
                name:     localStorage.getItem('authon_cfg_name')    || '',
                cnpj:     localStorage.getItem('authon_cfg_cnpj')    || '',
                addr:     localStorage.getItem('authon_cfg_addr')    || '',
                phone:    localStorage.getItem('authon_cfg_phone')   || '',
                pix:      localStorage.getItem('authon_cfg_pix')     || '',
                warranty: localStorage.getItem('authon_cfg_warranty')|| '',
                team:     localStorage.getItem('authon_cfg_team')    || '',
            }
        };

        // Gera arquivo JSON
        const json     = JSON.stringify(backup, null, 2);
        const blob     = new Blob([json], { type: 'application/json' });
        const url      = URL.createObjectURL(blob);
        const link     = document.createElement('a');
        const date     = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nome     = (backup.oficina || 'authon').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]/g,'_');
        link.href      = url;
        link.download  = `backup_${nome}_${date}.json`;
        link.click();
        URL.revokeObjectURL(url);

        Toast.success(`Backup gerado! ${backup.operacoes.length} registros exportados.`);

    } catch (e) {
        console.error(e);
        Toast.error('Erro ao gerar backup. Tente novamente.');
    }
};


window.importarBackup = async function (input) {
    const file = input.files[0];
    if (!file) return;

    const plano = localStorage.getItem('authon_plano') || 'basic';
    if (plano === 'basic') {
        Toast.warning('Restauração disponível nos planos Pro e Premium.');
        return;
    }

    Confirm(
        '⚠️ Restaurar este backup substituirá <strong>todos os dados atuais</strong>. Tem certeza?',
        async () => {
            try {
                const text   = await file.text();
                const backup = JSON.parse(text);

                // Valida formato
                if (!backup.versao || !backup.operacoes) {
                    Toast.error('Arquivo inválido. Use um backup gerado pelo Authon.');
                    return;
                }

                Toast.info('Restaurando backup...', 3000);

                // Restaura no localStorage
                localStorage.setItem('oficina_db_master', JSON.stringify(backup.operacoes));
                if (backup.catalogo?.length) localStorage.setItem('catalog_v1', JSON.stringify(backup.catalogo));
                if (backup.config?.name)     localStorage.setItem('authon_cfg_name',    backup.config.name);
                if (backup.config?.pix)      localStorage.setItem('authon_cfg_pix',     backup.config.pix);
                if (backup.config?.team)     localStorage.setItem('authon_cfg_team',    backup.config.team);
                if (backup.config?.warranty) localStorage.setItem('authon_cfg_warranty',backup.config.warranty);

                // Salva no Firestore também
                const user = window.auth?.currentUser;
                if (user) {
                    const batch = backup.operacoes.slice(0, 20); // primeiros 20 para não sobrecarregar
                    for (const op of batch) {
                        if (!op.uid) op.uid = user.uid;
                    }
                }

                Toast.success(`Backup restaurado! ${backup.operacoes.length} registros recuperados.`);
                setTimeout(() => location.reload(), 2000);

            } catch (e) {
                console.error(e);
                Toast.error('Erro ao restaurar. Verifique o arquivo.');
            }
        }
    );

    // Reset input
    input.value = '';
};

console.log('⚙️ Configurações carregadas');
