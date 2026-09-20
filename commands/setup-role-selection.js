const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require("discord.js")
const db = require("../db");
const REACTION_ROLE_CATEGORIES = require("../reactionRoles");

function buildCategoryEmbed(category, guild) {
    const lines = category.options.map((opt) => {
        const emoji = guild.emojis.cache.find((e) => e.name === opt.emojiName);
        return `${emoji ? emoji.toString() : `${opt.emojiName}:`} - ${opt.roleName}`;
    });

    return new EmbedBuilder()
        .setColor(0xc9a227)
        .setTitle(category.title)
        .setDescription(`${category.description}\n\n${lines.join("\n")}`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-role-selection")
        .setDescription("Post the reaction-role embeds for game version, role, and professions.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption((option) => 
            option
                .setName("channel")
                .setDescription("Channel to post the role-selection embeds in (defaults to this channel)")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),
    
    async execute(interaction){
        await interaction.deferReply({ephemeral: true}); /*this will take longer than 3 seconds, defering the reply from Discord until finished*/

        const targetChannel = interaction.options.getChannel("channel") ?? interaction.channel;
        
        for(const category of REACTION_ROLE_CATEGORIES){
            const embed = buildCategoryEmbed(category, interaction.guild);
            const message = await targetChannel.send({embeds: [embed]});

            for(const opt of category.options){
                const emoji = interaction.guild.emojis.cache.find((e) => e.name === opt.emojiName);
                if(emoji){
                    await message.react(emoji);
                } else {
                    console.warn(`Custom emoji "${opt.emojiName}:" not found in this server.`)
                }
            }

            db.prepare(
                `INSERT INTO reaction_role_messages (message_id, guild_id, channel_id, category_slug)
                VALUES (?, ?, ?, ?)`
            ).run(message.id, interaction.guild.id, targetChannel.id, category.slug);
        }

        //editing the initial defered reply
        await interaction.editReply({
            content: `Posted ${REACTION_ROLE_CATEGORIES.length} role-selection embeds in ${targetChannel}.`
        })
    }
}