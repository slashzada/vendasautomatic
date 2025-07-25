const { Events } = require('discord.js');
const PREFIX = '!';

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.content.startsWith(PREFIX) || !message.guild) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
        if (!command) return;

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(error);
            await message.reply('Ocorreu um erro ao tentar executar esse comando!');
        }
    },
};