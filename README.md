# 🎵 Soundboard Pro

Um **soundboard de desktop de código aberto** com **atalhos globais** e **seleção de saída de áudio** — perfeito para streamers, gamers, podcasters ou qualquer pessoa que queira se divertir em chamadas de voz.  
Construído com **Electron** 🖥️

---

## 🚀 Sobre o Projeto

O **Soundboard Pro** permite atribuir **atalhos de teclado globais** a qualquer arquivo de áudio do seu computador.  
Você pode escolher **para onde o som será reproduzido**, seja um fone, uma placa de som virtual (ex: Voicemeeter) ou a saída principal do sistema.

### 🔊 Diferenciais:
- Adição simples de **arquivos de áudio locais**.  
- **Direcionamento de áudio** para dispositivos específicos.  
- Interface limpa e fácil de usar.

---

## ✨ Funcionalidades

✅ **Atalhos Globais** – Reproduza sons em qualquer janela.  
✅ **Bandeja do Sistema** – O app pode ser minimizado e continuar rodando em segundo plano.  
✅ **Seleção de Saída de Áudio** – Escolha qual dispositivo de som vai reproduzir o áudio.  
✅ **Controle Avançado de Áudio**
  - Volume individual por som.  
  - Ajuste de velocidade de reprodução.  
  - Corte de áudio (início e fim).  
  - Modo loop.  
✅ **Persistência** – Todas as configurações e sons são salvos localmente.

---

## 🛠️ Tecnologias Utilizadas

- [Electron](https://www.electronjs.org/)  
- [Node.js](https://nodejs.org/)  
- HTML5, CSS3 e JavaScript

---

## 🏁 Como Começar

### 🧑‍💻 1. Para Usuários (Instalação)

#### **Linux (.AppImage)**
1. Baixe o arquivo `.AppImage` na aba **[Releases](../../releases)**.
2. Dê permissão de execução:
   ```bash
   chmod +x soundboard-pro-1.0.0.AppImage
3. (Dependência) AppImages podem exigir o FUSE v2:
   ```bash
   sudo apt install libfuse2t64
4. Execute o arquivo para iniciar o aplicativo.

---
### 🧑‍🔬 2. Para Desenvolvedores (Rodando do Código-Fonte)
**Pré-requisito**: Node.js instalado.

```bash
# 1. Clone o repositório
git clone https://github.com/marcosviniciuscl/soundboard.git
cd soundboard

# 2. Instale as dependências
npm install

# 3. Rode o aplicativo em modo de desenvolvimento
npm start
```

#### 📦 Como "Buildar" (Gerar AppImage / .deb / .exe)
Para empacotar o aplicativo para distribuição:
```bash
# Isso irá gerar os pacotes na pasta /dist
npm run dist
```

### 📄 Licença

Distribuído sob a licença MIT.

### 💡 Contribuindo

Contribuições são bem-vindas!
Sinta-se à vontade para abrir issues, enviar pull requests ou sugerir novas funcionalidades.

### 🖤 Créditos

Desenvolvido com 💻, ☕ e 🎶 por Marcos Vinicius Cruz Lima.