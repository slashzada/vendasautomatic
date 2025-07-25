const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'panel',
    aliases: ['admin', 'painel', 'dashboard'], 
    description: 'Abre o painel de controle administrativo da loja.',
    adminOnly: true,
    
    async execute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Você não tem permissão para usar este comando.');
        }

        const mainEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚙️ Painel de Controle Administrativo')
            .setDescription('Bem-vindo ao painel de controle da sua loja. Utilize os botões abaixo para gerenciar todas as funcionalidades do bot.')
            .setFooter({ text: 'Todas as respostas do painel serão enviadas de forma privada para você.' })
            .setTimestamp();

        const mainRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('adminpanel_main_products').setLabel('Gerenciar Produtos').setStyle(ButtonStyle.Primary).setEmoji('📦'),
                new ButtonBuilder().setCustomId('adminpanel_main_coupons').setLabel('Gerenciar Cupons').setStyle(ButtonStyle.Primary).setEmoji('🎟️'),
                new ButtonBuilder().setCustomId('adminpanel_main_sales').setLabel('Ver Vendas').setStyle(ButtonStyle.Success).setEmoji('📊'),
                new ButtonBuilder().setCustomId('adminpanel_main_setup').setLabel('Configurações').setStyle(ButtonStyle.Secondary).setEmoji('🛠️')
            );
        
        await message.reply({ embeds: [mainEmbed], components: [mainRow] });
    },
};