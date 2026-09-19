const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set-welcome-channel")
        .setDescription("Set which channel welcome messages get posted in.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("The channel to post welcome messages in.")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction){
        const channel = interaction.options.getChannel("channel");

        db.prepare(
            `INSERT INTO guild_settings (guild_id, welcome_channel_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET welcome_channel_id = excluded.welcome_channel_id`
        ).run(interaction.guild.id, channel.id)

        await interaction.reply({
            content: `Welcome messages will post in ${channel}`,
            ephemeral: true,
        });
    },
}