FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

ARG GITHUB_PACKAGES_TOKEN
ENV GITHUB_PACKAGES_TOKEN=$GITHUB_PACKAGES_TOKEN
RUN npm run preinstall

RUN npm install

# Bundle app source
COPY . .

RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "start-prod"]
