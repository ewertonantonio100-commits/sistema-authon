// ============================================================
// inspecao.js — Laudo de Avaria, Antes & Depois, Assinatura Digital
// ============================================================

// ── ESTADO GLOBAL ──
window.currentChecklist     = { fuel: 'Reserva', damages: {} };
window.checklistPhotos      = [];
window.tempSelectedPart     = '';
window.tempSelectedDamageType = '';
window.tempDamagePhotoFile  = null;
window.tempDamageQty        = 1;


// ── CHECKLIST / LAUDO ──
window.openChecklist = function () {
    document.getElementById('modal-checklist').style.display = 'flex';
    window.renderCarDamages();
};
window.closeChecklist = function () {
    document.getElementById('modal-checklist').style.display = 'none';
};

window.selectCarPart = function (partName) {
    window.tempSelectedPart = partName;
    window.tempDamageQty    = 1;
    const qtyDisplay = document.getElementById('damage-qty-display');
    if (qtyDisplay) qtyDisplay.innerText = '1';
    document.getElementById('damage-part-name').innerText = partName;
    document.getElementById('damage-type-buttons').style.display = 'block';
    document.getElementById('damage-photo-section').style.display = 'none';
    const camInput = document.getElementById('camera-input');
    if (camInput) camInput.value = '';
    document.getElementById('modal-damage').style.display = 'flex';
};

window.changeDamageQty = function (delta) {
    window.tempDamageQty += delta;
    if (window.tempDamageQty < 1) window.tempDamageQty = 1;
    const el = document.getElementById('damage-qty-display');
    if (el) el.innerText = window.tempDamageQty;
};

window.saveDamage = function (type) {
    if (type === '') {
        delete window.currentChecklist.damages[window.tempSelectedPart];
        document.getElementById('modal-damage').style.display = 'none';
        window.renderCarDamages();
        window.updateChecklistSummary();
        return;
    }
    let finalType = type;
    if (window.tempDamageQty > 1) finalType = `${window.tempDamageQty}x ${type}`;
    window.tempSelectedDamageType = finalType;
    const selType = document.getElementById('damage-selected-type');
    if (selType) selType.innerText = finalType;
    document.getElementById('damage-type-buttons').style.display  = 'none';
    document.getElementById('damage-photo-section').style.display = 'block';
    const prev = document.getElementById('damage-photo-preview');
    const btn  = document.getElementById('btn-save-damage-photo');
    if (prev) prev.style.display = 'none';
    if (btn)  btn.style.display  = 'none';
    window.tempDamagePhotoFile = null;
};

window.handleDamagePhoto = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    window.tempDamagePhotoFile = file;
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.getElementById('damage-photo-preview');
        if (img) { img.src = e.target.result; img.style.display = 'block'; }
        const btn = document.getElementById('btn-save-damage-photo');
        if (btn) btn.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

window.confirmDamageWithPhoto = function () {
    window.currentChecklist.damages[window.tempSelectedPart] = window.tempSelectedDamageType;
    if (window.tempDamagePhotoFile) window.checklistPhotos.push(window.tempDamagePhotoFile);
    _finalizeDamageEntry();
};

window.confirmDamageWithoutPhoto = function () {
    window.currentChecklist.damages[window.tempSelectedPart] = window.tempSelectedDamageType;
    _finalizeDamageEntry();
};

function _finalizeDamageEntry() {
    document.getElementById('modal-damage').style.display = 'none';
    window.renderCarDamages();
    window.updateChecklistSummary();
}

window.renderCarDamages = function () {
    document.querySelectorAll('.car-part').forEach(el => {
        const partName = el.id.replace('part-', '');
        if (window.currentChecklist.damages[partName]) el.classList.add('damaged');
        else el.classList.remove('damaged');
    });
};

window.setFuel = function (level) {
    window.currentChecklist.fuel = level;
    document.querySelectorAll('.btn-fuel').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('fuel-' + level);
    if (btn) btn.classList.add('active');
    window.updateChecklistSummary();
};

window.updateChecklistSummary = function () {
    const parts = Object.keys(window.currentChecklist.damages);
    let sum = `⛽ Combust. ${window.currentChecklist.fuel} <br>`;
    sum += parts.length > 0 ? `⚠️ ${parts.length} avaria(s) registrada(s).` : `✅ Nenhuma avaria na lataria.`;
    const divSummary = document.getElementById('checklist-summary');
    if (divSummary) divSummary.innerHTML = sum;
};

// ── ENVIAR LAUDO VIA WHATSAPP ──
window.sendFullReportWhatsApp = async function () {
    const client   = document.getElementById('clientName')?.value || 'Cliente';
    const phone    = document.getElementById('phone')?.value || '';
    const vehicle  = document.getElementById('vehicle')?.value || 'Veículo';
    const plate    = document.getElementById('plate')?.value || '';
    const compName = localStorage.getItem('authon_cfg_name') || 'Nossa Oficina';

    if (!phone) {
        Toast.warning('Preencha o número de celular do cliente na tela de Nova Venda primeiro!');
        return;
    }

    const damagesKeys = Object.keys(window.currentChecklist.damages);
    if (damagesKeys.length === 0 && window.currentChecklist.fuel === 'Reserva') {
        Toast.warning('Marque alguma avaria ou altere o combustível antes de enviar.');
        return;
    }

    let text = `*${compName.toUpperCase()}*\n--------------------------------\nOlá *${client}*!\n\nRealizamos a inspeção prévia do seu veículo *${vehicle}* ${plate ? '(' + plate.toUpperCase() + ')' : ''} ao chegar.\n\n⛽ *Combustível:* ${window.currentChecklist.fuel}\n`;

    if (damagesKeys.length > 0) {
        text += `\n⚠️ *Avarias Identificadas na Lataria/Vidros:*\n`;
        damagesKeys.forEach(part => { text += `- ${part}: ${window.currentChecklist.damages[part]}\n`; });
    } else {
        text += `\n✅ Nenhuma avaria identificada na lataria.\n`;
    }

    if (window.checklistPhotos.length > 0) {
        text += `\n📸 *As fotos das avarias foram registradas na oficina.*\n`;
    }
    text += `\nEstamos cuidando de tudo! 🤝`;

    if (window.checklistPhotos.length > 0) {
        Toast.info('O sistema vai baixar as fotos. O WhatsApp abrirá em seguida.', 5000);
        window.checklistPhotos.forEach((file, i) => {
            const url = URL.createObjectURL(file);
            const a   = document.createElement('a');
            a.style.display = 'none'; a.href = url;
            a.download = `Avaria_${plate || 'Carro'}_Foto${i + 1}.jpg`;
            document.body.appendChild(a); a.click();
            URL.revokeObjectURL(url); document.body.removeChild(a);
        });
    }

    window.open(`https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`);
    document.getElementById('modal-checklist').style.display = 'none';
};


// ── ANTES & DEPOIS ──
window.ba_clientData = {};
window.ba_photos     = { before: [], after: [] };

window.openBeforeAfterModal = function (client, vehicle, phone, plate) {
    window.ba_clientData = { client, vehicle, phone, plate };
    window.ba_photos     = { before: [], after: [] };
    ['camera-before','camera-after'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['preview-before-container','preview-after-container'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    document.getElementById('modal-before-after').style.display = 'flex';
};

window.closeBeforeAfterModal = function () {
    document.getElementById('modal-before-after').style.display = 'none';
};

window.handleBA_Photo = function (event, type) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    window.ba_photos[type] = window.ba_photos[type].concat(files);
    const container = document.getElementById(`preview-${type}-container`);
    if (!container) return;
    container.innerHTML = '';
    window.ba_photos[type].forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            Object.assign(img.style, { height:'60px', minWidth:'60px', borderRadius:'6px', objectFit:'cover', border:'1px solid #ccc' });
            container.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
};

window.sendBeforeAfterWhatsApp = async function () {
    const { client, vehicle, phone, plate } = window.ba_clientData;
    const totalPhotos = window.ba_photos.before.length + window.ba_photos.after.length;

    if (!phone) { Toast.warning('Este cliente não tem celular cadastrado!'); return; }
    if (!totalPhotos) { Toast.warning('Adicione pelo menos uma foto antes de enviar.'); return; }

    const compName = localStorage.getItem('authon_cfg_name') || 'Nossa Oficina';
    const text = `*${compName.toUpperCase()}*\n--------------------------------\nOlá *${client}*, tudo bem? 😃\n\nO serviço no seu *${vehicle}* ${plate ? '(' + plate.toUpperCase() + ')' : ''} teve um resultado incrível!\n\n✨ *Dá uma olhada nas fotos do Antes e Depois.* ✨\n\nQualquer dúvida, estamos à disposição! 🤝`;
    const todasAsFotos = [...window.ba_photos.before, ...window.ba_photos.after];

    if (navigator.canShare && navigator.canShare({ files: todasAsFotos })) {
        try { await navigator.share({ text, files: todasAsFotos }); window.closeBeforeAfterModal(); return; }
        catch (e) { console.log('Compartilhamento nativo cancelado, usando Plano B.'); }
    }

    Toast.info(`Baixando ${totalPhotos} foto(s). O WhatsApp abrirá logo em seguida.`, 4000);
    let delay = 0;
    todasAsFotos.forEach((file, i) => {
        setTimeout(() => {
            const url = URL.createObjectURL(file);
            const a   = document.createElement('a');
            a.style.display = 'none'; a.href = url;
            a.download = `Authon_${plate || 'Veiculo'}_Foto${i + 1}.jpg`;
            document.body.appendChild(a); a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            document.body.removeChild(a);
        }, delay);
        delay += 800;
    });

    setTimeout(() => {
        window.open(`https://wa.me/55${phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`);
        window.closeBeforeAfterModal();
    }, delay + 500);
};


// ── ASSINATURA DIGITAL ──
let sigCanvas, sigCtx, isDrawing = false;
window.currentSignatureBase64 = null;

function initSignatureEngine() {
    sigCanvas = document.getElementById('sigCanvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 3;
    sigCtx.lineCap   = 'round';
    sigCtx.strokeStyle = '#2c3e50';

    sigCanvas.addEventListener('touchstart', startDrawing, { passive: false });
    sigCanvas.addEventListener('touchmove',  drawSignature, { passive: false });
    sigCanvas.addEventListener('touchend',   stopDrawing,   { passive: false });
    sigCanvas.addEventListener('mousedown',  startDrawing);
    sigCanvas.addEventListener('mousemove',  drawSignature);
    sigCanvas.addEventListener('mouseup',    stopDrawing);
    sigCanvas.addEventListener('mouseout',   stopDrawing);
}

function getPointerPos(e) {
    const rect = sigCanvas.getBoundingClientRect();
    let clientX = e.clientX, clientY = e.clientY;
    if (e.touches?.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrawing(e)  { e.preventDefault(); isDrawing = true; const p = getPointerPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); }
function drawSignature(e) { if (!isDrawing) return; e.preventDefault(); const p = getPointerPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); }
function stopDrawing(e)   { e.preventDefault(); isDrawing = false; }

window.clearSignature = function () {
    if (sigCtx) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    window.currentSignatureBase64 = null;
    const prev = document.getElementById('sigPreview');
    if (prev) prev.style.display = 'none';
};

window.openSignatureModal = function () {
    document.getElementById('signatureModal').style.display = 'flex';
    setTimeout(() => { if (!sigCtx) initSignatureEngine(); window.clearSignature(); }, 100);
};

window.confirmSignature = function () {
    window.currentSignatureBase64 = sigCanvas.toDataURL('image/png');
    const preview = document.getElementById('sigPreview');
    if (preview) { preview.src = window.currentSignatureBase64; preview.style.display = 'block'; }
    document.getElementById('signatureModal').style.display = 'none';
};

console.log('🔍 Inspeção carregada');
