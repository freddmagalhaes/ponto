# PontoApp Mobile (Expo)

Aplicativo mobile oficial do **PontoApp**, construído com **Expo** e **React Native WebView**, permitindo rodar 100% das funcionalidades do sistema no celular via **Expo Go** ou compilação nativa, com:

- Detecção dinâmica de IP da máquina de desenvolvimento
- Geolocalização nativa para batida de ponto
- Suporte a navegação pelo botão voltar físico do Android
- Indicador de carregamento e tela de fallback com opção de alterar URL

---

## Como Rodar no Celular via Expo Go

### 1. Iniciar o servidor web
Na raiz do projeto (`ponto`), inicie o Vite com acesso à rede local:
```bash
npm run dev:host
```

### 2. Iniciar o aplicativo Expo
Em outro terminal (ou na pasta `mobile`):
```bash
npm run mobile
# ou: cd mobile && npx expo start
```

### 3. Abrir no celular
1. Instale o aplicativo **Expo Go** na Google Play Store (Android) ou App Store (iOS).
2. Certifique-se de que o celular e o computador estejam conectados na **mesma rede Wi-Fi**.
3. **No Android**: Abra o app Expo Go e selecione *"Scan QR Code"* para ler o código QR do terminal.
4. **No iPhone**: Abra o aplicativo da Câmera nativa e aponte para o QR Code.

---

## Configuração de URL
Por padrão, o app detecta o IP do seu computador na rede local e conecta a `http://<SEU_IP>:5173`.

Se você publicar a versão web na Vercel, Netlify ou outro servidor de produção (ex: `https://ponto.suaempresa.com`), você pode simplesmente tocar em **"Alterar URL do Servidor"** no topo da tela do app e inserir o link de produção!
