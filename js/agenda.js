// ============================================================
// agenda.js — Agenda, Lembretes WhatsApp
// ============================================================

window.renderAgenda = function () {
    const db         = JSON.parse(localStorage.getItem('oficina_db_master') || '[]');
    const list       = document.getElementById('agenda-list');
    if (!list) return;

    const searchInput = document.getElementById('agendaSearch');
    const term        = searchInput ? searchInput.value.toLowerCase() : '';
    const compName    = localStorage.getItem('authon_cfg_name') || 'Nossa Oficina';

    list.innerHTML = '';

    const agendas = db
        .filter(x => x.type === 'agendamento')
        .sort((a, b) => (a.date + (a.time||'')).localeCompare(b.date + (b.time||'')));

    if (!agendas.length) {
        list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:#bdc3c7;">
            <i class="fas fa-calendar-xmark" style="font-size:40px;margin-bottom:12px;display:block;"></i>
            <div style="font-size:14px;font-weight:600;">Nenhum agendamento</div>
            <div style="font-size:12px;margin-top:5px;">Os agendamentos criados aparecem aqui</div>
        </div>`;
        return;
    }

    // Agrupa por data
    const grouped = {};
    agendas.forEach(item => {
        const fullText = (item.client + ' ' + item.vehicle + ' ' + (item.plate||'') + ' ' + item.date).toLowerCase();
        if (term && !fullText.includes(term)) return;
        const dateKey = item.date;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
    });

    const today    = new Date().toLocaleDateString('en-CA');
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');

    Object.keys(grouped).sort().forEach(dateKey => {
        const items = grouped[dateKey];

        // Label do dia
        let dayLabel = dateKey.split('-').reverse().join('/');
        if (dateKey === today)    dayLabel = `📅 HOJE — ${dayLabel}`;
        if (dateKey === tomorrow) dayLabel = `📆 AMANHÃ — ${dayLabel}`;
        const isPast = dateKey < today;

        list.innerHTML += `<div class="agenda-day" style="color:${isPast ? '#bdc3c7' : '#95a5a6'}">${dayLabel}${isPast ? ' (passado)' : ''}</div>`;

        items.forEach(item => {
            // Monta serviços para a mensagem do WhatsApp
            let servicosAgendados = 'Revisão / Manutenção';
            if (item.items?.length > 0) {
                servicosAgendados = item.items.map(i => {
                    let d = i.desc;
                    if (d.includes(' - ')) { try { d = d.split(' - ')[1].split(' (')[0]; } catch(e){} }
                    return d;
                }).join(', ');
            }

            const msg  = `Olá *${item.client}*, tudo bem? Aqui é da *${compName}*! ⚙️\n\nPassando para confirmar o nosso agendamento para o seu *${item.vehicle}*.\n\n📅 *Data:* ${item.date.split('-').reverse().join('/')}\n⏰ *Horário:* ${item.time || 'A confirmar'}\n🔧 *Serviços:* ${servicosAgendados}\n\nEstamos te esperando! Se houver algum imprevisto, é só nos avisar por aqui. 🤝`;
            const link = `https://wa.me/55${(item.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;

            let itensHtml = '<ul style="margin:5px 0 5px 15px;padding:0;font-size:11px;color:#555;">';
            item.items?.forEach(i => { itensHtml += `<li>${i.desc}</li>`; });
            if (!item.items?.length) itensHtml += '<li>Sem serviços detalhados</li>';
            itensHtml += '</ul>';

            const valorHtml = item.total > 0
                ? `<div style="font-weight:bold;font-size:15px;color:#2c3e50;margin-top:5px;border-top:1px dashed #eee;padding-top:5px;">R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>`
                : '';

            const pastStyle = isPast ? 'opacity:0.6;' : '';

            list.innerHTML += `
            <div class="item-card st-agenda" style="${pastStyle}border-left:4px solid #0984e3;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span class="status-badge" style="background:#e8f4fd;color:#0984e3;">AGENDA</span>
                    <strong style="color:#0984e3;font-size:14px;">${item.time || '—'}</strong>
                </div>
                <div style="font-size:16px;font-weight:700;color:#2c3e50;margin-bottom:4px;">${item.client}</div>
                <div style="font-size:12px;color:#7f8c8d;margin-bottom:6px;">${item.vehicle}${item.plate ? ' · ' + item.plate.toUpperCase() : ''} · ${item.phone || '—'}</div>
                ${itensHtml}
                ${valorHtml}
                <div class="card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <button class="btn-card btn-notify" style="flex:1;background:#25D366;color:white;" onclick="window.open('${link}')">
                        <i class="fab fa-whatsapp"></i> LEMBRAR CLIENTE
                    </button>
                    <button class="btn-card" style="background:#27ae60;color:white;flex:1;" onclick="loadToEdit(${item.id}, true)">
                        <i class="fas fa-check"></i> ATENDER
                    </button>
                    <button class="btn-card" style="color:var(--primary);background:#ffebee;" onclick="deleteItem('${item.docId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        });
    });

    if (!Object.keys(grouped).length && term) {
        list.innerHTML = `<div style="text-align:center;padding:40px;color:#bdc3c7;">
            <div style="font-size:14px;font-weight:600;">Nenhum resultado para "${term}"</div>
        </div>`;
    }
};

console.log('📅 Agenda carregada');
