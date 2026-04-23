FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm config set strict-ssl false
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]