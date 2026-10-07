const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");
const { buildCountdownEmbed } = require("../countdown");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("forever-countdown")
        .setDescription("Post a live countdown to the WoW Forever launch")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.reply({ embeds: [buildCountdownEmbed()] });
        const message = await interaction.fetchReply();

        db.prepare(
            "INSERT INTO countdown_messages (message_id, guild_id, channel_id) VALUES (?, ?, ?)"
        ).run(message.id, interaction.guild.id, interaction.channel.id);
    },
};
