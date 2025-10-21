🎵 Soundboard
Um soundboard de desktop de código aberto com atalhos globais e seleção de saída de áudio. Construído com Electron.

🚀 Sobre o Projeto
Este é um aplicativo de soundboard que permite atribuir atalhos de teclado globais a qualquer arquivo de áudio. É perfeito para streaming, jogos, podcasts ou apenas para se divertir em chamadas de voz.

O diferencial deste projeto é a capacidade de:

Adicionar arquivos de áudio locais do seu computador.

Direcionar o áudio para dispositivos de saída específicos (ex: um fone de ouvido, uma mesa de som virtual como o Voicemeeter, ou a saída principal).

✨ Funcionalidades
Atalhos Globais: Atribua e use atalhos de teclado que funcionam em qualquer janela.

Bandeja do Sistema: O aplicativo é minimizado para a bandeja (área de notificação) para não atrapalhar.

Seleção de Saída de Áudio: Escolha exatamente qual dispositivo de som (caixa de som, fone, etc.) deve tocar os áudios.

Controle Avançado de Áudio:

Controle de Volume individual por som.

Ajuste de Velocidade de reprodução.

Corte de Áudio (definir tempo de Início e Fim).

Opção de Loop.

Persistência: Todas as suas configurações e sons são salvas localmente.

🛠️ Tecnologias Utilizadas
Electron

Node.js

HTML5, CSS3 e JavaScript

🏁 Como Começar
1. Para Usuários (Instalação)
Vá até a página de Releases deste repositório.

Linux (.AppImage)
Baixe o arquivo .AppImage.

Bash

# Dê permissão de execução
chmod +x seu-app-1.0.0.AppImage

# (Dependência) AppImages podem exigir o FUSE v2
sudo apt install libfuse2t64
Linux (.deb - Recomendado para Ubuntu/Debian)
Baixe o arquivo .deb.

Bash

# Instale o pacote
sudo dpkg -i seu-app_1.0.0_amd64.deb
2. Para Desenvolvedores (Rodando do Código-Fonte)
Você precisa ter o Node.js instalado.

Bash

# 1. Clone o repositório
git clone https://github.com/[SEU-USUARIO]/[NOME-DO-REPO].git
cd [NOME-DO-REPO]

# 2. Instale as dependências
npm install

# 3. Rode o aplicativo em modo de desenvolvimento
npm start
📦 Como "Buildar" (Criar o AppImage/.deb)
Para empacotar o aplicativo para distribuição, use o comando:

Bash

# Isso irá gerar os pacotes (AppImage, .deb, etc.) na pasta /dist
npm run dist
📄 Licença
Distribuído sob a licença MIT.