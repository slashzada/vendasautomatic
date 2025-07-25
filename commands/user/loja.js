const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
    name: 'loja',
    description: 'Mostra os produtos disponíveis para compra.',
    async execute(message) {
        const products = db.getAllProducts();

        if (products.length === 0) return message.reply('Nossa loja está vazia no momento.');

        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🛒 Bem-vindo à Loja!').setDescription('Selecione um produto no menu abaixo para ver as opções.');
        const selectMenu = new StringSelectMenuBuilder().setCustomId('select_product').setPlaceholder('Clique para escolher um produto')
            .addOptions(products.map(p => ({ label: p.name, description: p.description.slice(0, 100), value: p.id })));
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await message.reply({ embeds: [embed], components: [row] });
    },
};