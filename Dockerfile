FROM node:22-alpine

WORKDIR /app

# bcrypt tem binding nativo — no alpine (musl) às vezes precisa compilar em
# vez de usar um binário pré-buildado.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
