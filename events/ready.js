const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`✅ Bot Finalizado e Pronto! Logado como ${client.user.tag}`);
        client.user.setActivity('Nossa Loja!', { type: 3 }); // ActivityType.Watching
    },
};