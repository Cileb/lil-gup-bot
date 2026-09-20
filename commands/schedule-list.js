const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../db");
const DAY_NAMES = require("../dayNames");

function formatCronExpression(cronExpression) {
    const [minute, hour, , , daysOfWeek] = cronExpression.split(" ");

    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const period = hourNum >= 12 ? "PM" : "AM";
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const displayMinute = minuteNum.toString().padStart(2, "0");
    const timeString = `${displayHour}:${displayMinute} ${period}`;

    const dayNames = daysOfWeek
        .split(",")
        .map((day) => DAY_NAMES[parseInt(day, 10)])
        .join(", ");

    return `${dayNames} at ${timeString}`;
}

function weeksRemaining(endDateString) {
    const endDate = new Date(endDateString);
    const now = new Date();
    const msRemaining = endDate - now;
    const weeks = Math.ceil(msRemaining / (1000 * 60 * 60 * 24 * 7));
    return weeks > 0 ? weeks : 0;
}

function buildScheduleEmbed(rows) {
    const lines = rows.map((row) => {
        const preview = row.message.length > 80 ? `${row.message.slice(0, 80)}...` : row.message;
        return `**#${row.id}** — <#${row.channel_id}> — ${formatCronExpression(row.cron_expression)} (${row.timezone}) — ${weeksRemaining(row.end_date)} week(s) left\n${preview}`;
    });

    return new EmbedBuilder()
        .setColor(0xc9a227)
        .setTitle("Scheduled Announcements")
        .setDescription(lines.join("\n\n"));
}

function buildScheduleComponents(rows, selectedId = null) {
    const options = rows.slice(0, 25).map((row) => {
        const labelPreview = row.message.length > 50 ? `${row.message.slice(0, 50)}...` : row.message;
        return new StringSelectMenuOptionBuilder()
            .setLabel(`#${row.id} — ${labelPreview}`)
            .setValue(String(row.id))
            .setDefault(String(row.id) === selectedId);
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_schedule")
        .setPlaceholder("Select a schedule")
        .addOptions(options);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`schedule_cancel:${selectedId ?? "none"}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!selectedId);

    const editButton = new ButtonBuilder()
        .setCustomId(`schedule_edit:${selectedId ?? "none"}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!selectedId);

    return [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(editButton, cancelButton),
    ];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("schedule-list")
        .setDescription("View and cancel scheduled announcements")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const rows = db
            .prepare("SELECT * FROM scheduled_announcements WHERE guild_id = ?")
            .all(interaction.guild.id);

        if (rows.length === 0) {
            await interaction.reply({
                content: "There are no scheduled announcements for this server.",
                ephemeral: true,
            });
            return;
        }

        await interaction.reply({
            embeds: [buildScheduleEmbed(rows)],
            components: buildScheduleComponents(rows),
            ephemeral: true,
        });
    },

    buildScheduleEmbed,
    buildScheduleComponents,
};