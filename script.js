// CONFIGURAÇÃO DO BANCO DE DADOS ONLINE (Conexão Segura e Gratuita)
const DB_URL = "https://public-db-motos.supabase.co/rest/v1/triagens";
const DB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1YmxpYy1kYi1tb3RvcyIsImV4cCI6MjA5MjYwMDAwMH0.demo-key-motoestetica";

let clienteAtual = null;
let statusAtual = 1;
let checadorStatus = null;

// FUNÇÃO AO ENVIAR O FORMULÁRIO (Pode ser feito pelo cliente no celular dele)
document.getElementById('form-triagem').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btnSalvar = this.querySelector('.btn-primary');
    btnSalvar.innerText = "CADASTRANDO...";
    btnSalvar.disabled = true;

    const whatsappLimpo = document.getElementById('whatsapp').value.replace(/\D/g, '');
    const placaTexto = document.getElementById('placa').value.toUpperCase().trim();

    let checklist = [];
    if(document.getElementById('chk-riscado').checked) checklist.push("Riscado");
    if(document.getElementById('chk-amassado').checked) checklist.push("Amassado");
    if(document.getElementById('chk-sujeira').checked) checklist.push("Sujeira Pesada");

    clienteAtual = {
        placa: placaTexto,
        nome: document.getElementById('nome').value.trim(),
        whatsapp: whatsappLimpo,
        modelo: document.getElementById('modelo').value.trim(),
        checklist: checklist.join(', '),
        status: 1,
        atualizado_em: new Date().toISOString()
    };

    try {
        // Envia direto para o banco de dados online
        await fetch(DB_URL, {
            method: 'POST',
            headers: {
                'apikey': DB_KEY,
                'Authorization': `Bearer ${DB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(clienteAtual)
        });

        mostrarTelaCliente();
        iniciarMonitoramentoStatus();
    } catch (error) {
        alert("Erro ao conectar com o banco online. Verifique sua internet.");
    } finally {
        btnSalvar.innerHTML = '<i class="fa-solid fa-bolt"></i> CADASTRAR E INICIAR';
        btnSalvar.disabled = false;
    }
});

// EXIBE OS DADOS NA TELA
function mostrarTelaCliente() {
    if (!clienteAtual) return;

    document.getElementById('view-nome').innerText = clienteAtual.nome;
    document.getElementById('view-modelo').innerText = clienteAtual.modelo;
    document.getElementById('view-placa').innerText = clienteAtual.placa;
    
    renderizarBotoesEVisual(clienteAtual.status);

    document.getElementById('tela-triagem').classList.add('hidden');
    document.getElementById('tela-cliente').classList.remove('hidden');
}

// RENDERIZA O VISUAL (Sem atualizar o banco de dados de forma infinita)
function renderizarBotoesEVisual(status) {
    statusAtual = status;
    const botoes = document.querySelectorAll('.btn-status');
    botoes.forEach((btn, idx) => {
        if (idx === (status - 1)) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    for (let i = 1; i <= 4; i++) {
        const item = document.getElementById(`step-${i}`);
        item.classList.remove('active', 'current-status');
        if (i < status) item.classList.add('active');
        else if (i === status) item.classList.add('active', 'current-status');
    }

    const saudar = `Olá, *${clienteAtual.nome}*! 👋\nSua *${clienteAtual.modelo}* (${clienteAtual.placa}) `;
    let textoMsg = "";
    switch(status) {
        case 1: textoMsg = saudar + "está na fila *Aguardando o início*! 🗓️"; break;
        case 2: textoMsg = saudar + "entrou para o box de *Lavagem Detalhada*! 🧼✨"; break;
        case 3: textoMsg = saudar + "está na fase de *Finalização e Inspeção*. 🏁🔍"; break;
        case 4: textoMsg = saudar + "está *PRONTA e brilhando*! 🎉"; break;
    }

    document.getElementById('btn-suporte').href = `https://api.whatsapp.com/send?phone=55${clienteAtual.whatsapp}&text=${encodeURIComponent(textoMsg)}`;
}

// MUDA O STATUS (Feito por você no computador da loja)
async function mudarStatus(status) {
    if (!clienteAtual) return;
    clienteAtual.status = status;
    renderizarBotoesEVisual(status);

    // Atualiza o status na nuvem para o cliente ver no celular dele
    await fetch(`${DB_URL}?placa=eq.${clienteAtual.placa}`, {
        method: 'PATCH',
        headers: {
            'apikey': DB_KEY,
            'Authorization': `Bearer ${DB_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: status, atualizado_em: new Date().toISOString() })
    });
}

// ATUALIZA A TELA DO CLIENTE SOZINHA SE O STATUS MUDAR
function iniciarMonitoramentoStatus() {
    if(checadorStatus) clearInterval(checadorStatus);
    checadorStatus = setInterval(async () => {
        if (!clienteAtual) return;
        try {
            const res = await fetch(`${DB_URL}?placa=eq.${clienteAtual.placa}&select=status`, {
                headers: { 'apikey': DB_KEY, 'Authorization': `Bearer ${DB_KEY}` }
            });
            const dados = await res.json();
            if(dados && dados[0] && dados[0].status !== statusAtual) {
                renderizarBotoesEVisual(dados[0].status);
            }
        } catch (e) {}
    }, 4000); // Checa a cada 4 segundos se você mudou o status
}

// BUSCA AUTOMÁTICA SE DIGITAR UMA PLACA JÁ CADASTRADA
document.getElementById('placa').addEventListener('blur', async function() {
    const placaBusca = this.value.toUpperCase().trim();
    if(placaBusca.length < 4) return;

    try {
        const res = await fetch(`${DB_URL}?placa=eq.${placaBusca}`, {
            headers: { 'apikey': DB_KEY, 'Authorization': `Bearer ${DB_KEY}` }
        });
        const dados = await res.json();
        if (dados && dados[0]) {
            document.getElementById('nome').value = dados[0].nome;
            document.getElementById('whatsapp').value = dados[0].whatsapp;
            document.getElementById('modelo').value = dados[0].modelo;
            this.style.borderColor = "#34c759";
            clienteAtual = dados[0];
            alert(`⚡ Moto já cadastrada antes! Dados preenchidos.`);
        }
    } catch(e) {}
});

function voltarTriagem() {
    if(checadorStatus) clearInterval(checadorStatus);
    document.getElementById('form-triagem').reset();
    document.getElementById('placa').style.borderColor = "";
    document.getElementById('tela-cliente').classList.add('hidden');
    document.getElementById('tela-triagem').classList.remove('hidden');
    clienteAtual = null;
}