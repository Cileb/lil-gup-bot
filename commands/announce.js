const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
} = require("discord.js");

const { execute } = require("./ping");

module.exports = {
    data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Posts an announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const modal = new ModalBuilder()
        .setCustomId("announcement")
        .setTitle("New Announcement");

        const messageInput = new TextInputBuilder()
        .setCustomId("messageInput")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

        const messageLabel = new LabelBuilder()
        .setLabel("Announcement text")
        .setDescription("Shown exactly as typed, supports multiple lines")
        .setTextInputComponent(messageInput);
        
        const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId("channelSelect")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true);

        const channelLabel = new LabelBuilder()
        .setLabel("Channel to post in")
        .setDescription("Where the announcement will appear")
        .setChannelSelectMenuComponent(channelSelect);

        const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId("roleSelect")
        .setRequired(false);

        const roleLabel = new LabelBuilder()
        .setLabel("Role to ping (optional)")
        .setDescription("Leave blank to post without pinging anyone")
        .setRoleSelectMenuComponent(roleSelect);

    modal.addLabelComponents(messageLabel, channelLabel, roleLabel);

    await interaction.showModal(modal);
    },
 
};

