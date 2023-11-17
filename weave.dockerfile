FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Bundle app source
COPY . .

ARG GHP_TOKEN
ENV GHP_TOKEN=$GHP_TOKEN
RUN npm run preinstall
RUN npm install
RUN npm run build
RUN npm run load-revisions

EXPOSE 3001
CMD ["npm", "run", "start-prod"]
