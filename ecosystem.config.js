// PM2 process definition. On the LAN server run:  pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "device-bridge",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
