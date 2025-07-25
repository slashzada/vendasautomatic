const { Events, EmbedBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const db = require('../database');
require('dotenv').config();

const clientMP = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Função de verificação de pagamento (estável e completa)
async function checkPaymentStatus(interaction, paymentId) {
    const maxAttempts = 20;
    let attempts = 0;
    const interval = setInterval(async () => {
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            db.updateTransactionStatus(paymentId.toString(), 'EXPIRED');
            try { await interaction.followUp({ content: 'Seu tempo para pagamento expirou.', flags: [MessageFlags.Ephemeral] }); }
            catch (e) { console.error("Não foi possível editar a resposta de expiração."); }
            return;
        }
        try {
            const payment = new Payment(clientMP);
            const paymentInfo = await payment.get({ id: paymentId });
            if (paymentInfo.status === 'approved') {
                clearInterval(interval);
                const transaction = db.getTransactionByPaymentId(paymentId.toString());
                if (!transaction) return clearInterval(interval);
                db.updateTransactionStatus(paymentId.toString(), 'APPROVED');
                const variation = db.getVariation(transaction.variation_id);
                const product = db.getProduct(variation.product_id);
                db.decreaseStock(variation.id);
                const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID);
                const logEmbed = new EmbedBuilder().setTitle('✅ Venda Aprovada').setColor(0x00FF00).addFields({ name: 'Produto', value: `${product.name} - ${variation.name}` }, { name: 'Comprador', value: `<@${interaction.user.id}> (${interaction.user.tag})` }, { name: 'Valor Pago', value: `R$ ${transaction.final_price.toFixed(2)}` }, { name: 'Data', value: new Date().toLocaleString('pt-BR') });
                if (logChannel) await logChannel.send({ embeds: [logEmbed] });
                try {
                    const deliveryEmbed = new EmbedBuilder().setTitle('🎉 Compra Aprovada!').setColor(0x57F287).setDescription(`Obrigado por comprar conosco, ${interaction.user.username}!`).addFields({ name: 'Produto Adquirido', value: `${product.name} - ${variation.name}` }, { name: 'Seu Conteúdo', value: `\`\`\`${variation.digital_content}\`\`\`` }).setTimestamp().setFooter({ text: 'Agradecemos a preferência!' });
                    await interaction.user.send({ embeds: [deliveryEmbed] });
                    await interaction.followUp({ content: 'Pagamento aprovado! Seu produto foi enviado na sua DM.', flags: [MessageFlags.Ephemeral] });
                } catch {
                    await interaction.followUp({ content: `Pagamento aprovado, mas não consegui te enviar DM! Seu produto está abaixo:\n\`\`\`${variation.digital_content}\`\`\``, flags: [MessageFlags.Ephemeral] });
                }
            } else {
                attempts++;
            }
        } catch (error) {
            console.error('Erro ao verificar status do pagamento:', error);
            attempts++;
        }
    }, 15000);
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // --- PAINEL DE CONTROLE DE ADMIN ---
        if (interaction.isButton() && interaction.customId.startsWith('adminpanel_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para usar este painel.', ephemeral: true });
            }
            
            const action = interaction.customId;

            // NAVEGAÇÃO
            if (action === 'adminpanel_back_main') {
                const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('⚙️ Painel de Controle Administrativo').setDescription('Utilize os botões abaixo para gerenciar todas as funcionalidades do bot.');
                const row = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('adminpanel_main_products').setLabel('Gerenciar Produtos').setStyle(ButtonStyle.Primary).setEmoji('📦'), new ButtonBuilder().setCustomId('adminpanel_main_coupons').setLabel('Gerenciar Cupons').setStyle(ButtonStyle.Primary).setEmoji('🎟️'), new ButtonBuilder().setCustomId('adminpanel_main_sales').setLabel('Ver Vendas').setStyle(ButtonStyle.Success).setEmoji('📊'), new ButtonBuilder().setCustomId('adminpanel_main_setup').setLabel('Configurações').setStyle(ButtonStyle.Secondary).setEmoji('🛠️') );
                return interaction.update({ embeds: [embed], components: [row] });
            }

            // --- MENUS PRINCIPAIS DO PAINEL ---
            if (action === 'adminpanel_main_products') {
                const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('📦 Gerenciamento de Produtos').setDescription('O que você gostaria de fazer?');
                const row1 = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('adminpanel_products_addbase').setLabel('Add Produto Base').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('adminpanel_products_addvar').setLabel('Add Variação').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('adminpanel_products_addstock').setLabel('Adicionar Estoque').setStyle(ButtonStyle.Success).setEmoji('➕') );
                const row2 = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('adminpanel_products_list').setLabel('Listar Variações').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('adminpanel_products_post').setLabel('Postar Anúncio').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('adminpanel_products_deletevar').setLabel('Apagar Variação').setStyle(ButtonStyle.Danger) );
                const row3 = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('adminpanel_products_deletebase').setLabel('Apagar Produto Base').setStyle(ButtonStyle.Danger) );
                const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('adminpanel_back_main').setLabel('Voltar').setStyle(ButtonStyle.Danger));
                return interaction.update({ embeds: [embed], components: [row1, row2, row3, backRow] });
            }
            if (action === 'adminpanel_main_coupons') {
                 const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎟️ Gerenciamento de Cupons').setDescription('O que você gostaria de fazer?');
                 const row = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId('adminpanel_coupons_add').setLabel('Add Cupom').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('adminpanel_coupons_list').setLabel('Listar Cupons').setStyle(ButtonStyle.Secondary) );
                 const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('adminpanel_back_main').setLabel('Voltar').setStyle(ButtonStyle.Danger));
                 return interaction.update({ embeds: [embed], components: [row, backRow] });
            }
            if (action === 'adminpanel_main_sales') {
                 const transactions = db.getRecentTransactions();
                 if (transactions.length === 0) return interaction.reply({ content: 'Nenhuma venda registrada.', ephemeral: true });
                 const embed = new EmbedBuilder().setTitle('📊 Últimas Vendas').setColor(0xADD8E6);
                 for(const t of transactions) {
                    const variation = db.getVariation(t.variation_id);
                    if (!variation) continue;
                    const product = db.getProduct(variation.product_id);
                    if (!product) continue;
                    embed.addFields({ name: `Venda #${t.payment_id}`, value: `**Produto:** ${product.name} - ${variation.name}\n**Comprador:** <@${t.user_id}>\n**Valor:** R$ ${t.final_price.toFixed(2)}\n**Status:** ${t.status}`});
                }
                 return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            if (action === 'adminpanel_main_setup') {
                 const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🛠️ Configurações').setDescription('Selecione uma opção.');
                 const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('adminpanel_setup_ticket').setLabel('Postar Painel de Ticket').setStyle(ButtonStyle.Primary));
                 const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('adminpanel_back_main').setLabel('Voltar').setStyle(ButtonStyle.Danger));
                 return interaction.update({ embeds: [embed], components: [row, backRow] });
            }

            // --- AÇÕES ESPECÍFICAS (ABREM MODAIS OU NOVAS RESPOSTAS) ---
            if (action === 'adminpanel_products_addbase') {
                const modal = new ModalBuilder().setCustomId('add_product_modal').setTitle('Adicionar Novo Produto Base');
                const idInput = new TextInputBuilder().setCustomId('productId').setLabel("ID Único (ex: 'nitro')").setStyle(TextInputStyle.Short).setRequired(true);
                const nameInput = new TextInputBuilder().setCustomId('productName').setLabel("Nome do Produto").setStyle(TextInputStyle.Short).setRequired(true);
                const descInput = new TextInputBuilder().setCustomId('productDesc').setLabel("Descrição (use \\n para quebras de linha)").setStyle(TextInputStyle.Paragraph);
                modal.addComponents(new ActionRowBuilder().addComponents(idInput), new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descInput));
                return interaction.showModal(modal);
            }
            if (action === 'adminpanel_products_addvar') {
                const products = db.getAllBaseProducts();
                if (products.length === 0) return interaction.reply({ content: 'Crie um produto base primeiro!', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('➕ Adicionar Variação').setDescription('Selecione o produto base para esta variação.');
                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_product_for_variation').setPlaceholder('Escolha o produto base').addOptions(products.map(p => ({ label: p.name, value: p.id })));
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }
            if (action === 'adminpanel_products_addstock') {
                const variations = db.getAllVariationsWithProductInfo();
                if (variations.length === 0) return interaction.reply({ content: 'Não há variações para adicionar estoque.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('➕ Adicionar Estoque').setDescription('Selecione a variação para a qual deseja adicionar mais estoque.').setColor(0x00BFFF);
                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_variation_to_addstock').setPlaceholder('Escolha a variação').addOptions(variations.map(v => ({ label: `${v.product_name} - ${v.variation_name} (Estoque atual: ${v.stock})`, value: v.id.toString() })));
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }
            if (action === 'adminpanel_products_list') {
                const variations = db.getAllVariationsWithProductInfo();
                if (variations.length === 0) return interaction.reply({ content: 'Nenhuma variação encontrada.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('📋 Lista de Variações').setColor(0xDAA520);
                embed.setDescription(variations.map(v => `**ID:** \`${v.id}\` | **Produto:** ${v.product_name} - ${v.variation_name} | **Estoque:** ${v.stock}`).join('\n\n'));
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            if (action === 'adminpanel_products_post') {
                const variations = db.getAllVariationsWithProductInfo();
                if (variations.length === 0) return interaction.reply({ content: 'Nenhuma variação para postar.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('📢 Postar Anúncio').setDescription('Selecione a variação que deseja postar.');
                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_variation_to_post').setPlaceholder('Escolha a variação').addOptions(variations.map(v => ({ label: `${v.product_name} - ${v.variation_name}`, value: v.id.toString() })));
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }
            if (action === 'adminpanel_products_deletevar') {
                const variations = db.getAllVariationsWithProductInfo();
                if (variations.length === 0) return interaction.reply({ content: 'Não há variações para apagar.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('🗑️ Apagar Variação').setDescription('Selecione a variação que deseja apagar. Esta ação não pode ser desfeita.').setColor(0xFF0000);
                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_variation_to_delete').setPlaceholder('Escolha a variação para apagar').addOptions(variations.map(v => ({ label: `${v.product_name} - ${v.variation_name}`, description: `ID: ${v.id}`, value: v.id.toString() })));
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }
            if (action === 'adminpanel_products_deletebase') {
                const products = db.getAllBaseProducts();
                if (products.length === 0) return interaction.reply({ content: 'Não há produtos base para apagar.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('🗑️ Apagar Produto Base').setDescription('Selecione o produto base que deseja apagar. **Atenção: todas as suas variações também serão apagadas!**').setColor(0xFF0000);
                const selectMenu = new StringSelectMenuBuilder().setCustomId('select_product_to_delete').setPlaceholder('Escolha o produto para apagar').addOptions(products.map(p => ({ label: p.name, description: `ID: ${p.id}`, value: p.id })));
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }
            if (action === 'adminpanel_coupons_add') {
                const modal = new ModalBuilder().setCustomId('add_coupon_modal').setTitle('Adicionar Novo Cupom');
                const codeInput = new TextInputBuilder().setCustomId('couponCode').setLabel("Código (ex: BEMVINDO10)").setStyle(TextInputStyle.Short).setRequired(true);
                const typeInput = new TextInputBuilder().setCustomId('couponType').setLabel("Tipo (percentage ou fixed)").setStyle(TextInputStyle.Short).setRequired(true);
                const valueInput = new TextInputBuilder().setCustomId('couponValue').setLabel("Valor (ex: 10 para 10% ou R$10)").setStyle(TextInputStyle.Short).setRequired(true);
                const usesInput = new TextInputBuilder().setCustomId('couponUses').setLabel("Usos (padrão: 1)").setStyle(TextInputStyle.Short).setRequired(false);
                modal.addComponents(new ActionRowBuilder().addComponents(codeInput), new ActionRowBuilder().addComponents(typeInput), new ActionRowBuilder().addComponents(valueInput), new ActionRowBuilder().addComponents(usesInput));
                return interaction.showModal(modal);
            }
            if (action === 'adminpanel_coupons_list') {
                const coupons = db.getAllCoupons();
                if (coupons.length === 0) return interaction.reply({ content: 'Nenhum cupom encontrado.', ephemeral: true });
                const embed = new EmbedBuilder().setTitle('🎟️ Lista de Cupons').setColor(0xFFFF00);
                embed.setDescription(coupons.map(c => `**Código:** \`${c.code}\` | **Desconto:** ${c.discount_type === 'percentage' ? `${c.discount_value}%` : `R$${c.discount_value.toFixed(2)}`} | **Usos:** ${c.uses_left}`).join('\n'));
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            if (action === 'adminpanel_setup_ticket') {
                const embed = new EmbedBuilder().setTitle('🎫 Suporte ao Cliente').setDescription('Precisa de ajuda? Clique no botão abaixo para abrir um ticket.').setColor(0x00BFFF);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket_button').setLabel('Abrir Ticket').setStyle(ButtonStyle.Success).setEmoji('📩'));
                await interaction.channel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: 'Painel de ticket postado com sucesso neste canal!', ephemeral: true });
            }
        }
        
        // --- INTERAÇÕES DE USUÁRIO E SUB-FLUXOS DE ADMIN ---
        if (interaction.isButton() && interaction.customId === 'create_ticket_button') {
            await interaction.deferReply({ ephemeral: true });
            const supportRoleId = process.env.SUPPORT_ROLE_ID;
            if (!supportRoleId) return interaction.editReply('O sistema de ticket não está configurado.');
            const supportRole = interaction.guild.roles.cache.get(supportRoleId);
            if (!supportRole) return interaction.editReply('O cargo de suporte configurado não foi encontrado.');
            const existingTicket = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existingTicket) return interaction.editReply(`Você já possui um ticket aberto em ${existingTicket}!`);
            try {
                const ticketChannel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username.toLowerCase()}`, type: ChannelType.GuildText, parent: interaction.channel.parent, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] });
                const embed = new EmbedBuilder().setColor(0x00BFFF).setTitle('🎫 Ticket de Suporte Aberto').setDescription(`Olá ${interaction.user}, bem-vindo ao seu ticket.\n\nPor favor, descreva seu problema ou dúvida em detalhes. Um membro da equipe ${supportRole} irá te ajudar em breve.`);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
                await ticketChannel.send({ content: `${interaction.user} ${supportRole}`, embeds: [embed], components: [row] });
                return interaction.editReply(`✅ Seu ticket foi criado com sucesso em ${ticketChannel}!`);
            } catch (error) { console.error("Erro ao criar ticket:", error); return interaction.editReply("Houve um erro ao tentar criar seu ticket."); }
        }
        
        if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
            const variationId = interaction.customId.split('_')[1];
            const variation = db.getVariation(variationId);
            if (!variation || variation.stock <= 0) return interaction.reply({ content: 'Este produto está fora de estoque ou não existe mais.', ephemeral: true });
            const embed = new EmbedBuilder().setTitle(`🛒 Revisão do Carrinho`).setDescription(`Você está prestes a comprar **${variation.name}** por **R$ ${variation.price.toFixed(2)}**.`).setColor(0xFFA500);
            const row = new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId(`pay_now_${variationId}`).setLabel('Pagar Agora').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`apply_coupon_button_${variationId}`).setLabel('Aplicar Cupom').setStyle(ButtonStyle.Secondary) );
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
        
        if (interaction.isButton() && interaction.customId.startsWith('refresh_stock_')) {
            const variationId = interaction.customId.split('_').pop();
            const variation = db.getVariation(variationId);
            if (!variation) {
                const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
                disabledRow.components.forEach(c => c.setDisabled(true));
                return interaction.update({ components: [disabledRow] });
            }
            const originalEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(originalEmbed).setFields(
                { name: 'Valor à vista', value: originalEmbed.fields[0].value, inline: true },
                { name: 'Restam', value: `${variation.stock}`, inline: true }
            );
            await interaction.update({ embeds: [newEmbed] });
        }

        // --- MENUS DE SELEÇÃO ---
        if (interaction.isStringSelectMenu()) {
            // Admin
            if (interaction.customId === 'select_product_for_variation') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
                const productId = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`add_variation_modal_${productId}`).setTitle(`Nova Variação para ${productId}`);
                const nameInput = new TextInputBuilder().setCustomId('variationName').setLabel("Nome da Variação").setStyle(TextInputStyle.Short).setRequired(true);
                const priceInput = new TextInputBuilder().setCustomId('variationPrice').setLabel("Preço (ex: 15.50)").setStyle(TextInputStyle.Short).setRequired(true);
                const stockInput = new TextInputBuilder().setCustomId('variationStock').setLabel("Estoque").setStyle(TextInputStyle.Short).setRequired(true);
                const contentInput = new TextInputBuilder().setCustomId('variationContent').setLabel("Conteúdo a ser entregue").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(priceInput), new ActionRowBuilder().addComponents(stockInput), new ActionRowBuilder().addComponents(contentInput));
                await interaction.showModal(modal);
            }
            if (interaction.customId === 'select_variation_to_post') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
                const variationId = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`post_product_modal_${variationId}`).setTitle('Postar Anúncio de Produto');
                const imageUrlInput = new TextInputBuilder().setCustomId('imageUrlInput').setLabel("URL da Imagem do Banner").setPlaceholder("https://cdn.discordapp.com/...").setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
                await interaction.showModal(modal);
            }
            if (interaction.customId === 'select_variation_to_delete') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
                const variationId = parseInt(interaction.values[0]);
                db.deleteVariation(variationId);
                return interaction.update({ content: `✅ Variação com ID ${variationId} foi apagada com sucesso!`, embeds: [], components: [] });
            }
             if (interaction.customId === 'select_product_to_delete') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
                const productId = interaction.values[0];
                db.deleteProduct(productId);
                return interaction.update({ content: `✅ Produto com ID **${productId}** e todas as suas variações foram apagados!`, embeds: [], components: [] });
            }
            if (interaction.customId === 'select_variation_to_addstock') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
                const variationId = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`add_stock_modal_${variationId}`).setTitle('Adicionar Estoque');
                const quantityInput = new TextInputBuilder().setCustomId('stockQuantityInput').setLabel("Quantidade a ser ADICIONADA").setPlaceholder("Ex: 10").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
                await interaction.showModal(modal);
            }
            // Usuário
            if (interaction.customId === 'select_product') {
                await interaction.deferUpdate();
                const productId = interaction.values[0];
                const product = db.getProduct(productId);
                const variations = db.getVariationsForProduct(productId);
                const embed = new EmbedBuilder().setTitle(`Variações para: ${product.name}`).setColor(0x5865F2);
                const row = new ActionRowBuilder();
                variations.forEach(v => { embed.addFields({ name: v.name, value: `Preço: R$ ${v.price.toFixed(2)} | Estoque: ${v.stock}` }); row.addComponents(new ButtonBuilder().setCustomId(`buy_${v.id}`).setLabel(v.name).setStyle(ButtonStyle.Primary)); });
                await interaction.editReply({ embeds: [embed], components: [row] });
            }
        }

        // --- MODAIS ---
        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ ephemeral: true });

            if (interaction.customId === 'add_product_modal') {
                const id = interaction.fields.getTextInputValue('productId');
                const name = interaction.fields.getTextInputValue('productName');
                const description = interaction.fields.getTextInputValue('productDesc');
                try { db.addProduct(id, name, description); await interaction.editReply({ content: `✅ Produto base **${name}** criado!` }); }
                catch (e) { await interaction.editReply({ content: `❌ Erro! Um produto com o ID **${id}** provavelmente já existe.` }); }
            }
            if (interaction.customId.startsWith('add_variation_modal_')) {
                const productId = interaction.customId.split('_').pop();
                const name = interaction.fields.getTextInputValue('variationName');
                const price = parseFloat(interaction.fields.getTextInputValue('variationPrice').replace(',', '.'));
                const stock = parseInt(interaction.fields.getTextInputValue('variationStock'));
                const content = interaction.fields.getTextInputValue('variationContent');
                if (isNaN(price) || isNaN(stock)) return interaction.editReply({ content: 'Preço e Estoque devem ser números válidos.' });
                try { db.addVariation(productId, name, price, stock, content); await interaction.editReply({ content: `✅ Variação **${name}** adicionada ao produto **${productId}**!` }); }
                catch (e) { await interaction.editReply({ content: `❌ Ocorreu um erro.` }); }
            }
            if (interaction.customId.startsWith('add_stock_modal_')) {
                const variationId = parseInt(interaction.customId.split('_').pop());
                const quantity = parseInt(interaction.fields.getTextInputValue('stockQuantityInput'));
                if (isNaN(quantity) || quantity <= 0) return interaction.editReply({ content: 'Por favor, insira uma quantidade numérica válida e maior que zero.' });
                db.addStock(variationId, quantity);
                const updatedVariation = db.getVariation(variationId);
                return interaction.editReply({ content: `✅ ${quantity} unidades adicionadas com sucesso! O novo estoque de **${updatedVariation.name}** é **${updatedVariation.stock}**.` });
            }
            if (interaction.customId.startsWith('post_product_modal_')) {
                const variationId = interaction.customId.split('_').pop();
                const imageUrl = interaction.fields.getTextInputValue('imageUrlInput');
                const variation = db.getVariation(parseInt(variationId));
                if (!variation) return interaction.editReply({ content: 'Erro: Variação não encontrada.' });
                const product = db.getProduct(variation.product_id);
                const embed = new EmbedBuilder().setTitle(variation.name).setColor(0x0099FF).setDescription(product.description).addFields({ name: 'Valor à vista', value: `R$ ${variation.price.toFixed(2)}`, inline: true }, { name: 'Restam', value: `${variation.stock}`, inline: true }).setImage(imageUrl).setFooter({ text: `${interaction.guild.name} • Sua loja de confiança!`, iconURL: interaction.guild.iconURL() });
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`buy_${variation.id}`).setLabel('Comprar').setStyle(ButtonStyle.Success).setEmoji('🛒'), new ButtonBuilder().setCustomId(`refresh_stock_${variation.id}`).setLabel('Atualizar Estoque').setStyle(ButtonStyle.Secondary).setEmoji('🔄'));
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: '✅ Anúncio postado com sucesso!' });
            }
            if (interaction.customId === 'add_coupon_modal') {
                const code = interaction.fields.getTextInputValue('couponCode');
                const type = interaction.fields.getTextInputValue('couponType').toLowerCase();
                const value = parseFloat(interaction.fields.getTextInputValue('couponValue').replace(',', '.'));
                const uses = parseInt(interaction.fields.getTextInputValue('couponUses') || '1');
                if (!['percentage', 'fixed'].includes(type) || isNaN(value) || isNaN(uses)) return interaction.editReply('Dados inválidos. Tipo deve ser "percentage" ou "fixed", e valor/usos devem ser números.');
                try { db.addCoupon(code, type, value, uses); await interaction.editReply(`✅ Cupom '${code}' criado!`); }
                catch(e) { await interaction.editReply(`❌ Erro! Um cupom com o código '${code}' já existe.`); }
            }
            if (interaction.customId.startsWith('apply_coupon_modal_')) {
                const variationId = interaction.customId.split('_').pop();
                const couponCode = interaction.fields.getTextInputValue('couponCodeInput');
                const coupon = db.getCoupon(couponCode);
                const variation = db.getVariation(variationId);
                if (!coupon) return interaction.editReply({ content: '❌ Cupom inválido ou já utilizado.' });
                let finalPrice = variation.price;
                let discountText = '';
                if (coupon.discount_type === 'percentage') { finalPrice *= (1 - coupon.discount_value / 100); discountText = `${coupon.discount_value}%`; } 
                else { finalPrice -= coupon.discount_value; discountText = `R$ ${coupon.discount_value.toFixed(2)}`; }
                finalPrice = Math.max(0.01, finalPrice);
                const embed = new EmbedBuilder().setTitle(`✅ Cupom Aplicado!`).setDescription(`Você está comprando: **${variation.name}**`).addFields({ name: 'Preço Original', value: `R$ ${variation.price.toFixed(2)}`, inline: true },{ name: 'Desconto', value: discountText, inline: true },{ name: 'Preço Final', value: `**R$ ${finalPrice.toFixed(2)}**`, inline: true }).setColor(0x00FF00);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`pay_with_coupon_${variation.id}_${coupon.code}`).setLabel('Pagar com Desconto').setStyle(ButtonStyle.Success));
                await interaction.editReply({ embeds: [embed], components: [row] });
            }
        }
        
        // --- BOTÕES DE PAGAMENTO, CUPOM, ETC ---
        if(interaction.isButton()) {
            const [action, ...params] = interaction.customId.split('_');
            
            if (action === 'pay') {
                await interaction.deferReply({ ephemeral: true });
                let variationId, couponCode;
                if(params[0] === 'now') { variationId = params[1]; } 
                else if (params[0] === 'with' && params[1] === 'coupon') { variationId = params[2]; couponCode = params[3]; }
                const variation = db.getVariation(variationId);
                let finalPrice = variation.price;
                if(couponCode) {
                    const coupon = db.getCoupon(couponCode);
                    if(coupon) {
                         if (coupon.discount_type === 'percentage') { finalPrice *= (1 - coupon.discount_value / 100); } 
                         else { finalPrice -= coupon.discount_value; }
                        finalPrice = Math.max(0.01, finalPrice);
                        db.useCoupon(couponCode);
                    }
                }
                const paymentData = { body: { transaction_amount: Number(finalPrice.toFixed(2)), description: `${db.getProduct(variation.product_id).name} - ${variation.name}`, payment_method_id: 'pix', payer: { email: `${interaction.user.id}@discord.bot`, first_name: interaction.user.username } } };
                try {
                    const payment = new Payment(clientMP);
                    const result = await payment.create(paymentData);
                    const paymentId = result.id;
                    db.addTransaction(paymentId.toString(), interaction.user.id, variationId, finalPrice);
                    const buffer = Buffer.from(result.point_of_interaction.transaction_data.qr_code_base64, 'base64');
                    const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });
                    const embed = new EmbedBuilder().setColor(0x00FF00).setTitle(`💸 Pague para receber seu produto!`).setImage('attachment://qrcode.png').addFields({ name: 'PIX Copia e Cola', value: `\`\`\`${result.point_of_interaction.transaction_data.qr_code}\`\`\`` });
                    await interaction.editReply({ embeds: [embed], files: [attachment], components: [] });
                    await checkPaymentStatus(interaction, paymentId);
                } catch(e) { console.error("Erro MP:", e); await interaction.editReply({content: 'Houve um erro com o sistema de pagamentos.'}); }
            }
            if (action === 'apply' && params[0] === 'coupon' && params[1] === 'button') {
                const variationId = params[2];
                const modal = new ModalBuilder().setCustomId(`apply_coupon_modal_${variationId}`).setTitle('Aplicar Cupom de Desconto');
                const couponInput = new TextInputBuilder().setCustomId('couponCodeInput').setLabel("Digite seu código de cupom").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(couponInput));
                await interaction.showModal(modal);
            }
            if (action === 'close' && params[0] === 'ticket') {
                await interaction.reply({content: 'Este ticket será fechado em 5 segundos...'});
                setTimeout(() => interaction.channel.delete().catch(e => console.error("Não foi possível deletar o canal do ticket:", e)), 5000);
            }
        }
    },
};