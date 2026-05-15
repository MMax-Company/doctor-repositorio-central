FROM node:20-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (sem o --only=production para resolver conflitos)
RUN npm install

# Copiar código fonte
COPY . .

# Criar pasta para dados
RUN mkdir -p /app/data

# Expor porta
EXPOSE 3002

# Iniciar servidor
CMD ["npm", "start"]