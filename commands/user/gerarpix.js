const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { MercadoPagoConfig, Payment } = require('mercadopago');
require('dotenv').config();

const clientMP = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

module.exports = {
    name: 'gerarpix',
    description: 'Gera um pagamento PIX avulso.',
    async execute(message, args) {
        const [valor, ...descricaoArray] = args;
        const descricao = descricaoArray.join(' ');

        if (!valor || isNaN(parseFloat(valor)) || !descricao) {
            return message.reply('Uso incorreto! Use: `!gerarpix <valor> <descrição>`\nExemplo: `!gerarpix 10.50 Serviço de Design`');
        }

        const finalPrice = parseFloat(valor);

        const paymentData = {
            body: {
                transaction_amount: finalPrice,
                description: descricao,
                payment_method_id: 'pix',
                payer: {
                    email: `${message.author.id}@discord.bot`, // Email de placeholder
                    first_name: message.author.username,
                },
            }
        };

        try {
            const payment = new Payment(clientMP);
            const result = await payment.create(paymentData);

            const qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
            const pixCopiaECola = result.point_of_interaction.transaction_data.qr_code;

            const buffer = Buffer.from(qrCodeBase64, 'base64');
            const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`💸 Pagamento PIX Gerado`)
                .setDescription(`**Valor:** R$ ${finalPrice.toFixed(2)}\n**Descrição:** ${descricao}`)
                .setImage('attachment://qrcode.png')
                .addFields({ name: 'PIX Copia e Cola', value: `\`\`\`${pixCopiaECola}\`\`\`` })
                .setFooter({ text: 'Este PIX é para pagamento único e não possui entrega automática.' });

            await message.reply({ embeds: [embed], files: [attachment] });

        } catch (e) {
            console.error("Erro ao gerar PIX avulso:", e);
            await message.reply('Houve um erro ao tentar gerar o pagamento PIX. Tente novamente.');
        }
    },
};