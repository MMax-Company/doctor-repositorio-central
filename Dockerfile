FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar pasta para dados
RUN mkdir -p /app/data

# Expor porta
EXPOSE 3002

# Iniciar servidor
CMD ["npm", "start"]